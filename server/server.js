const dns = require('dns');
// Set reliable DNS servers to resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e);
}

const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5050;

// MongoDB Atlas URI provided by user
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://debashishadcs_db_user:DbqpM1xeB0nqawji@cluster0.orqhcqp.mongodb.net/?appName=Cluster0';
const DB_NAME = process.env.DB_NAME || 'siteflow_db';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let client;
let db;

async function connectToMongo() {
  if (db) return db;
  try {
    console.log('[MongoDB Atlas] Connecting to Cluster0...');
    client = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
      },
      connectTimeoutMS: 15000,
    });
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`[MongoDB Atlas] Connected successfully to database: ${DB_NAME}`);
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
    const { userEmail = 'default', bills = [], profile = null, presets = [] } = req.body;

    const billsCol = database.collection('bills');
    const profilesCol = database.collection('profiles');
    const snapshotsCol = database.collection('backup_snapshots');

    let upsertedBills = 0;

    // 1. Upsert each bill into the shared company database
    if (Array.isArray(bills) && bills.length > 0) {
      for (const bill of bills) {
        if (!bill.id) continue;
        await billsCol.updateOne(
          { _id: bill.id },
          {
            $set: {
              ...bill,
              _id: bill.id,
              lastSyncedBy: userEmail,
              syncedAt: new Date(),
            },
          },
          { upsert: true }
        );
        upsertedBills++;
      }
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
    const { userEmail = 'default', localBills = [] } = req.body;

    const billsCol = database.collection('bills');

    // Upsert local bills into Atlas
    if (Array.isArray(localBills) && localBills.length > 0) {
      for (const bill of localBills) {
        if (!bill.id) continue;
        await billsCol.updateOne(
          { _id: bill.id },
          {
            $set: {
              ...bill,
              _id: bill.id,
              lastSyncedBy: userEmail,
              syncedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
    }

    // Fetch all shared bills from Atlas
    const allBills = await billsCol.find({}).sort({ createdAt: -1 }).toArray();
    const cleanedBills = allBills.map(b => {
      const { _id, ...rest } = b;
      return { ...rest, id: rest.id || _id };
    });

    res.json({
      success: true,
      bills: cleanedBills,
      totalCount: cleanedBills.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Sync Merge Error]', err);
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

    // Clean up MongoDB _id
    const cleanedBills = bills.map(b => {
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
      profile: cleanedProfile,
      restoredAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Sync Restore Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SiteFlow MongoDB Atlas Sync Server listening on http://0.0.0.0:${PORT}`);
  console.log(`Atlas Cluster: Cluster0 (orqhcqp.mongodb.net)`);
});
