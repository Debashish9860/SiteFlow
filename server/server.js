// Load .env before anything reads process.env.
require('dotenv').config({ path: __dirname + '/.env' });

const dns = require('dns');
// Set reliable DNS servers to resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e);
}

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5050;

// Credentials come from server/.env only - never hardcode them here.
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'siteflow_db';

if (!MONGODB_URI) {
  console.warn('[Config] MONGODB_URI is not set. Please set MONGODB_URI in environment variables or .env file.');
}

// Cost factor for password hashing.
const BCRYPT_ROUNDS = 12;
// Maximum wrong OTP guesses before a reset code is burned.
const MAX_OTP_ATTEMPTS = 5;

/**
 * Constant-time string compare. Compares byte length first because
 * timingSafeEqual throws on buffers of differing length.
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let client;
let db;

async function connectToMongo() {
  if (db) return db;
  const uri = process.env.MONGODB_URI || MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured in environment variables.');
  }
  const dbName = process.env.DB_NAME || DB_NAME;
  try {
    console.log('[MongoDB Atlas] Connecting to Cluster0...');
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
      },
      connectTimeoutMS: 15000,
    });
    await client.connect();
    db = client.db(dbName);
    console.log(`[MongoDB Atlas] Connected successfully to database: ${dbName}`);
    return db;
  } catch (err) {
    console.error('[MongoDB Atlas] Connection error:', err);
    throw err;
  }
}

// Ensure connection on start
connectToMongo().catch(err => {
  console.warn('[MongoDB Atlas] Initial connection failed, will retry on request:', err.message);
});

/**
 * Remove bills and record tombstones for them.
 *
 * Deletion has to outlive the delete itself: every device keeps its own copy of
 * the bills, so without a durable record of "this was deleted" the next device
 * to sync simply uploads its stale copy again and the bill comes back.
 */
async function recordDeletions(database, ids, userEmail) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return { removed: 0 };

  const deletedCol = database.collection('deleted_bills');
  const billsCol = database.collection('bills');

  await deletedCol.bulkWrite(
    unique.map(id => ({
      updateOne: {
        filter: { _id: id },
        update: { $setOnInsert: { _id: id, deletedAt: new Date(), deletedBy: userEmail } },
        upsert: true,
      },
    }))
  );

  const result = await billsCol.deleteMany({ _id: { $in: unique } });
  return { removed: result.deletedCount };
}

/** Set of every bill id that has been deleted. */
/**
 * Store a batch of bills, skipping any whose copy in Atlas is already newer.
 *
 * Devices upload everything they hold, including copies untouched since another
 * phone edited the same bill. Upserting those unconditionally lets the stale
 * copy win and the edit vanishes, which is what made bills revert after the
 * second person synced. `updatedAt` is stamped by the app on every local write,
 * so the higher stamp is the later edit.
 *
 * Bills from a build that never stamped anything score 0 and lose to any
 * stamped copy, which is the right direction: only the newer app stamps, and
 * only it can have made the edit.
 *
 * Costs one read and one write for the whole batch rather than two round trips
 * per bill. Doing it per bill was fine at a handful of them, but every sync
 * sends the device's entire collection, so the time grew with the business and
 * would eventually have run into the serverless execution limit.
 *
 * Two devices writing the same bill in the same instant can still interleave
 * between the read and the write. For a few devices sharing one book of bills
 * that is not worth a transaction, and it replaces a clobber that was certain.
 */
async function upsertBillsIfNewer(billsCol, bills, userEmail, tombstoned) {
  // One entry per id: a device can send the same bill twice, so keep the later.
  const best = new Map();
  for (const bill of bills) {
    if (!bill || !bill.id) continue;
    if (tombstoned.has(bill.id)) continue;
    const prior = best.get(bill.id);
    if (!prior || (Number(bill.updatedAt) || 0) >= (Number(prior.updatedAt) || 0)) {
      best.set(bill.id, bill);
    }
  }
  if (best.size === 0) return 0;

  const storedRows = await billsCol
    .find({ _id: { $in: Array.from(best.keys()) } }, { projection: { updatedAt: 1 } })
    .toArray();
  const storedStamps = new Map(storedRows.map(r => [r._id, Number(r.updatedAt) || 0]));

  const syncedAt = new Date();
  const operations = [];
  for (const [id, bill] of best) {
    const stored = storedStamps.get(id);
    if (stored !== undefined && stored > (Number(bill.updatedAt) || 0)) continue;

    // `_id` is set by the filter, and on an upsert it comes from there too, so
    // it never appears in the update and can never be written as a field.
    const { _id, ...fields } = bill;
    operations.push({
      updateOne: {
        filter: { _id: id },
        update: { $set: { ...fields, id, lastSyncedBy: userEmail, syncedAt } },
        upsert: true,
      },
    });
  }
  if (operations.length === 0) return 0;

  // Unordered: one rejected bill must not stop the rest of the batch.
  await billsCol.bulkWrite(operations, { ordered: false });
  return operations.length;
}

async function getDeletedIds(database) {
  const rows = await database.collection('deleted_bills').find({}, { projection: { _id: 1 } }).toArray();
  return new Set(rows.map(r => r._id));
}

/**
 * Root endpoint for quick uptime/browser check
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    name: 'SiteFlow Sync Server',
    message: 'SiteFlow MongoDB Atlas Sync Server is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
  try {
    const database = await connectToMongo();
    await database.command({ ping: 1 });
    res.json({
      status: 'ok',
      database: 'connected',
      cluster: 'Cluster0 (orqhcqp.mongodb.net)',
      dbName: DB_NAME,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: err.message,
    });
  }
});

/**
 * Status & stats endpoint
 */
app.get('/api/sync/status', async (req, res) => {
  try {
    const database = await connectToMongo();
    const userEmail = req.query.userEmail || 'default';
    
    const billsCol = database.collection('bills');
    const billCount = await billsCol.countDocuments({ userEmail });

    const snapshotsCol = database.collection('backup_snapshots');
    const lastSnapshot = await snapshotsCol
      .find({ userEmail })
      .sort({ backupDate: -1 })
      .limit(1)
      .toArray();

    res.json({
      connected: true,
      cluster: 'Cluster0',
      userEmail,
      billCount,
      lastBackup: lastSnapshot[0]?.backupDate || null,
    });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

/**
 * Backup / Sync endpoint - Pushes bills and profile from mobile to Atlas
 */
app.post('/api/sync/backup', async (req, res) => {
  try {
    const database = await connectToMongo();
    const { userEmail = 'default', bills = [], profile = null, presets = [], deletedIds = [] } = req.body;

    // Propagate deletions on this path too, so a backup-only sync still removes them.
    if (Array.isArray(deletedIds) && deletedIds.length > 0) {
      await recordDeletions(database, deletedIds, userEmail);
    }

    const billsCol = database.collection('bills');
    const profilesCol = database.collection('profiles');
    const snapshotsCol = database.collection('backup_snapshots');

    let upsertedBills = 0;

    // Never re-create a bill that was deleted; a device syncing a stale copy
    // must not resurrect it.
    const tombstoned = await getDeletedIds(database);

    // 1. Upsert each bill into the shared company database
    if (Array.isArray(bills) && bills.length > 0) {
      upsertedBills = await upsertBillsIfNewer(billsCol, bills, userEmail, tombstoned);
    }

    // 2. Upsert profile
    if (profile) {
      const profileKey = 'company_profile';
      await profilesCol.updateOne(
        { _id: profileKey },
        {
          $set: {
            ...profile,
            _id: profileKey,
            lastUpdatedBy: userEmail,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    // 3. Create historical snapshot for disaster recovery
    const backupRecord = {
      userEmail,
      backupDate: new Date(),
      billCount: bills.length,
      totalRevenue: bills
        .filter(b => b.billType !== 'quotation')
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      totalReceived: bills
        .filter(b => b.billType !== 'quotation')
        .reduce((sum, b) => sum + (b.advancePaid || 0), 0),
      billsSnapshot: bills,
      profileSnapshot: profile,
      presetsSnapshot: presets,
    };
    await snapshotsCol.insertOne(backupRecord);

    console.log(`[Sync Backup] Backed up ${upsertedBills} bills for user: ${userEmail}`);

    res.json({
      success: true,
      message: 'Cloud backup completed successfully in MongoDB Atlas.',
      syncedBills: upsertedBills,
      totalBillsInCloud: bills.length,
      timestamp: backupRecord.backupDate.toISOString(),
    });
  } catch (err) {
    console.error('[Sync Backup Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Two-way Sync & Merge endpoint
 * Uploads local bills and returns all shared company bills from Atlas
 * Allows Brother A and Brother B to instantly see each other's bills
 */
app.post('/api/sync/merge', async (req, res) => {
  try {
    const database = await connectToMongo();
    const { userEmail = 'default', localBills = [], deletedIds = [] } = req.body;

    const billsCol = database.collection('bills');

    // 1. Apply deletions first. A deleted bill is recorded as a tombstone so that
    // other devices that still hold it locally drop it instead of re-uploading it.
    const incomingDeletes = Array.isArray(deletedIds) ? deletedIds.filter(Boolean) : [];
    if (incomingDeletes.length > 0) {
      await recordDeletions(database, incomingDeletes, userEmail);
    }

    // Every id ever deleted, so a stale device cannot resurrect one.
    const tombstoned = await getDeletedIds(database);

    // 2. Upsert local bills into Atlas, skipping anything already deleted.
    if (Array.isArray(localBills) && localBills.length > 0) {
      await upsertBillsIfNewer(billsCol, localBills, userEmail, tombstoned);
    }

    // 3. Fetch all shared bills from Atlas
    const allBills = await billsCol.find({}).sort({ createdAt: -1 }).toArray();
    const cleanedBills = allBills
      .filter(b => !tombstoned.has(b._id) && !tombstoned.has(b.id))
      .map(b => {
        const { _id, ...rest } = b;
        return { ...rest, id: rest.id || _id };
      });

    res.json({
      success: true,
      bills: cleanedBills,
      // Returned so each device can prune bills deleted on another device.
      deletedIds: Array.from(tombstoned),
      totalCount: cleanedBills.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Sync Merge Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete a single bill / quotation and tombstone it.
 */
app.delete('/api/bills/:id', async (req, res) => {
  try {
    const database = await connectToMongo();
    const billId = req.params.id;
    const userEmail = req.query.userEmail || 'default';

    if (!billId) {
      return res.status(400).json({ success: false, message: 'Missing bill id.' });
    }

    const result = await recordDeletions(database, [billId], userEmail);
    console.log(`[Bill Delete] ${billId} removed by ${userEmail} (matched ${result.removed})`);

    res.json({ success: true, id: billId, removed: result.removed });
  } catch (err) {
    console.error('[Bill Delete Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Restore endpoint - Pulls latest data from MongoDB Atlas to restore mobile local storage
 */
app.get('/api/sync/restore', async (req, res) => {
  try {
    const database = await connectToMongo();
    const userEmail = req.query.userEmail || 'default';

    const billsCol = database.collection('bills');
    const profilesCol = database.collection('profiles');
    const snapshotsCol = database.collection('backup_snapshots');

    // 1. Fetch all shared company bills
    let bills = await billsCol.find({}).sort({ createdAt: -1 }).toArray();

    // If empty, check snapshots
    if (bills.length === 0) {
      const lastSnapshot = await snapshotsCol
        .find({})
        .sort({ backupDate: -1 })
        .limit(1)
        .toArray();
      if (lastSnapshot.length > 0 && Array.isArray(lastSnapshot[0].billsSnapshot)) {
        bills = lastSnapshot[0].billsSnapshot;
      }
    }

    // Drop anything deleted. This matters most for the snapshot fallback above,
    // whose historical billsSnapshot still contains bills deleted since.
    const tombstoned = await getDeletedIds(database);

    // Clean up MongoDB _id
    const cleanedBills = bills
      .filter(b => !tombstoned.has(b._id) && !tombstoned.has(b.id))
      .map(b => {
        const { _id, ...rest } = b;
        return { ...rest, id: rest.id || _id };
      });

    // 2. Get profile
    let profile = await profilesCol.findOne({ _id: 'company_profile' });
    if (!profile) {
      profile = await profilesCol.findOne({});
    }

    let cleanedProfile = null;
    if (profile) {
      const { _id, ...restProfile } = profile;
      cleanedProfile = restProfile;
    }

    console.log(`[Sync Restore] Restored ${cleanedBills.length} bills from Atlas for ${userEmail}`);

    res.json({
      success: true,
      bills: cleanedBills,
      deletedIds: Array.from(tombstoned),
      profile: cleanedProfile,
      restoredAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Sync Restore Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const nodemailer = require('nodemailer');

const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD;

if (!SMTP_EMAIL || !SMTP_APP_PASSWORD) {
  console.warn('[Config] SMTP_EMAIL / SMTP_APP_PASSWORD are not set - password reset emails will fail.');
}

// Gmail SMTP Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_APP_PASSWORD,
  },
});

// Verify SMTP connection on startup
transporter.verify((error) => {
  if (error) {
    console.warn('[SMTP Notice] Gmail transporter setup error:', error.message);
  } else {
    console.log(`[SMTP Connected] Gmail OTP Service ready using: ${SMTP_EMAIL}`);
  }
});

/**
 * Generate beautifully styled HTML email template for 6-digit OTP
 */
function generateOtpEmailHtml(userName, otpCode) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SiteFlow Verification Code</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #F8FAFC;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0F172A;
        }
        .wrapper {
          max-width: 520px;
          margin: 30px auto;
          background: #FFFFFF;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          border: 1px solid #E2E8F0;
        }
        .header {
          background: linear-gradient(135deg, #7C1034 0%, #500820 100%);
          padding: 32px 24px;
          text-align: center;
        }
        .brand-title {
          color: #FFFFFF;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: 2.5px;
          margin: 0;
        }
        .brand-subtitle {
          color: #F5A623;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          margin-top: 6px;
          text-transform: uppercase;
        }
        .content {
          padding: 36px 32px;
        }
        .heading {
          font-size: 20px;
          font-weight: 800;
          color: #0F172A;
          margin: 0 0 12px 0;
        }
        .subtext {
          font-size: 14px;
          color: #475569;
          line-height: 1.6;
          margin: 0 0 24px 0;
        }
        .otp-box {
          background: #FFFDF5;
          border: 2px dashed #F5A623;
          border-radius: 14px;
          padding: 24px 16px;
          text-align: center;
          margin: 24px 0;
        }
        .otp-label {
          font-size: 11px;
          font-weight: 800;
          color: #D97706;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .otp-code {
          font-size: 40px;
          font-weight: 900;
          color: #7C1034;
          letter-spacing: 8px;
          font-family: 'Courier New', Courier, monospace;
          margin: 8px 0;
        }
        .timer-pill {
          display: inline-block;
          background: #FEE2E2;
          color: #DC2626;
          font-size: 12px;
          font-weight: 800;
          padding: 6px 14px;
          border-radius: 20px;
          margin-top: 10px;
        }
        .security-note {
          background: #F8FAFC;
          border-left: 4px solid #7C1034;
          padding: 12px 16px;
          border-radius: 4px;
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
          margin-top: 24px;
        }
        .footer {
          background: #F8FAFC;
          border-top: 1px solid #E2E8F0;
          padding: 20px;
          text-align: center;
          font-size: 11px;
          color: #94A3B8;
        }
        .powered-by {
          font-weight: 800;
          color: #7C1034;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1 class="brand-title">SITEFLOW</h1>
          <div class="brand-subtitle">Contractor Billing & Invoicing Suite</div>
        </div>
        <div class="content">
          <h2 class="heading">Password Reset Verification</h2>
          <p class="subtext">
            Hello <strong>${userName}</strong>,<br>
            We received a request to reset the password for your SiteFlow contractor account. Use the 6-digit verification code below to complete your password reset:
          </p>

          <div class="otp-box">
            <div class="otp-label">YOUR 6-DIGIT VERIFICATION CODE (OTP)</div>
            <div class="otp-code">${otpCode}</div>
            <div class="timer-pill">⏱️ Valid for 5 minutes only</div>
          </div>

          <div class="security-note">
            <strong>🔒 Security Notice:</strong> Never share this code with anyone. If you did not initiate this request, you can safely ignore this email. Your account remains protected.
          </div>
        </div>
        <div class="footer">
          <div>This is an automated security verification email sent from SiteFlow.</div>
          <div style="margin-top: 6px;">
            Powered by <span class="powered-by">Debashish Raut</span> &bull; SiteFlow Mobile Invoicing
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * ==========================================
 * USER AUTHENTICATION & OTP REGISTRATION ROUTES
 * ==========================================
 */

/**
 * Send 6-Digit OTP to User's Google Email (5-Minute Expiration)
 */
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const database = await connectToMongo();
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please enter a valid Google email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const usersCol = database.collection('users');
    const otpCol = database.collection('password_resets');

    // 1. Verify user exists in Atlas
    const userDoc = await usersCol.findOne({ _id: cleanEmail });
    if (!userDoc) {
      return res.status(404).json({
        success: false,
        message: 'No registered account found with this email. Please register a new account.',
      });
    }

    // 2. Generate secure 6-digit numeric OTP.
    // crypto.randomInt, not Math.random: reset codes must not be predictable.
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    // Invalidate previous unused OTPs for this email
    await otpCol.updateMany({ email: cleanEmail, used: false }, { $set: { used: true } });

    // Store new active OTP in MongoDB
    await otpCol.insertOne({
      email: cleanEmail,
      otp: otpCode,
      createdAt: new Date(),
      expiresAt,
      used: false,
      attempts: 0,
    });

    // 3. Dispatch Email via Gmail SMTP
    const userName = userDoc.name || 'Contractor';
    const emailHtml = generateOtpEmailHtml(userName, otpCode);

    await transporter.sendMail({
      from: `"SiteFlow Security" <${SMTP_EMAIL}>`,
      to: cleanEmail,
      subject: `${otpCode} is your SiteFlow Password Reset Code`,
      html: emailHtml,
    });

    console.log(`[OTP Sent] 6-digit OTP sent to ${cleanEmail} (Expires in 5 mins)`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. It is valid for 5 minutes.`,
      expiresInSeconds: 300,
    });
  } catch (err) {
    console.error('[Send OTP Error]', err);
    res.status(500).json({ success: false, message: `Could not send OTP email: ${err.message}` });
  }
});

/**
 * Verify 6-Digit OTP and Reset User Password
 */
app.post('/api/auth/verify-otp-and-reset', async (req, res) => {
  try {
    const database = await connectToMongo();
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, 6-digit OTP, and your new password.',
      });
    }

    if (newPassword.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const otpCol = database.collection('password_resets');
    const usersCol = database.collection('users');

    // Find latest active OTP for this email
    const otpRecord = await otpCol
      .find({ email: cleanEmail, used: false })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (!otpRecord || otpRecord.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP request found. Please request a new verification code.',
      });
    }

    const activeOtp = otpRecord[0];

    // Check if expired (5 minutes)
    if (new Date() > new Date(activeOtp.expiresAt)) {
      await otpCol.updateOne({ _id: activeOtp._id }, { $set: { used: true } });
      return res.status(400).json({
        success: false,
        message: 'This OTP has expired (5-minute time limit). Please tap Resend OTP to get a new code.',
      });
    }

    // Check if OTP matches. Count wrong guesses so a 6-digit code cannot simply
    // be enumerated inside its 5-minute window.
    if (!safeEqual(activeOtp.otp, cleanOtp)) {
      const attempts = (activeOtp.attempts || 0) + 1;
      const exhausted = attempts >= MAX_OTP_ATTEMPTS;

      await otpCol.updateOne(
        { _id: activeOtp._id },
        { $set: { attempts, ...(exhausted ? { used: true } : {}) } }
      );

      return res.status(400).json({
        success: false,
        message: exhausted
          ? 'Too many incorrect attempts. This code has been cancelled - please request a new one.'
          : `Invalid OTP code. Please check the 6-digit code in your email. ${
              MAX_OTP_ATTEMPTS - attempts
            } attempt(s) remaining.`,
      });
    }

    // Mark OTP as used
    await otpCol.updateOne({ _id: activeOtp._id }, { $set: { used: true, verifiedAt: new Date() } });

    // Update password in users collection. No upsert: send-otp already proved the
    // account exists, and upserting here would create a user with no name or role.
    const updated = await usersCol.updateOne(
      { _id: cleanEmail },
      {
        $set: {
          passwordHash: await bcrypt.hash(newPassword.trim(), BCRYPT_ROUNDS),
          updatedAt: new Date(),
        },
        $unset: { migratedAt: '' },
      }
    );

    if (updated.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address. Please register first.',
      });
    }

    console.log(`[Password Reset Complete] Password successfully updated for ${cleanEmail}`);

    res.json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('[Verify OTP Reset Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Register a new genuine user in MongoDB Atlas
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const database = await connectToMongo();
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide full name.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please provide a valid Google/email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const usersCol = database.collection('users');

    const existing = await usersCol.findOne({ _id: cleanEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please sign in.',
      });
    }

    const newUser = {
      _id: cleanEmail,
      id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      name: name.trim(),
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password.trim(), BCRYPT_ROUNDS),
      role: 'contractor',
      createdAt: new Date(),
    };

    await usersCol.insertOne(newUser);
    console.log(`[Auth Register] New genuine user registered in Atlas: ${cleanEmail} (${name})`);

    const { passwordHash, _id, ...safeUser } = newUser;
    res.json({
      success: true,
      message: 'Account created successfully.',
      user: safeUser,
    });
  } catch (err) {
    console.error('[Auth Register Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Authenticate existing genuine user
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const database = await connectToMongo();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both email and password.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    const usersCol = database.collection('users');

    // Check Atlas users
    const userDoc = await usersCol.findOne({ _id: cleanEmail });

    // The app needs to tell these two apart. An account the server has never
    // seen is the normal result of registering while it was unreachable, and
    // the phone signs that person in from its own cache; a password the server
    // rejects means the cached one is stale and has to go. The visible message
    // stays the same either way.
    const invalid = (reason) =>
      res.status(401).json({
        success: false,
        reason,
        message: 'Invalid email or password. Please verify your credentials or create an account.',
      });

    if (!userDoc || !userDoc.passwordHash) return invalid('no_account');

    const stored = userDoc.passwordHash;
    const isBcrypt = /^\$2[aby]\$/.test(stored);

    if (isBcrypt) {
      if (!(await bcrypt.compare(cleanPass, stored))) return invalid('bad_password');
    } else {
      // Legacy account created before hashing existed: the column held the raw
      // password. Verify against it once, then upgrade the record in place.
      if (!safeEqual(stored, cleanPass)) return invalid('bad_password');

      await usersCol.updateOne(
        { _id: cleanEmail },
        { $set: { passwordHash: await bcrypt.hash(cleanPass, BCRYPT_ROUNDS), migratedAt: new Date() } }
      );
      console.log(`[Auth Login] Upgraded legacy plaintext password to bcrypt for ${cleanEmail}`);
    }

    const { passwordHash, _id, ...safeUser } = userDoc;
    res.json({
      success: true,
      message: 'Login successful.',
      user: safeUser,
    });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SiteFlow MongoDB Atlas Sync Server listening on http://0.0.0.0:${PORT}`);
    console.log(`Atlas Cluster: Cluster0 (orqhcqp.mongodb.net)`);
  });
}

module.exports = app;
