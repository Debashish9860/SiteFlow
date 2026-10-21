import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getCurrentUser } from './authService';
import { Bill, BusinessProfile } from '../types/bill';
import { CompressedStorage } from './compressedStorage';

const LAST_SYNC_KEY = '@siteflow_last_cloud_sync';
const AUTO_SYNC_ENABLED_KEY = '@siteflow_auto_sync_enabled';
const DELETED_BILLS_KEY = '@siteflow_deleted_bill_ids';
const BILLS_STORAGE_KEY = '@billmaker_bills';

/**
 * Ids of bills deleted on this device that the cloud may not know about yet.
 *
 * Deleting a bill locally is not enough: the shared cloud copy survives, and the
 * next sync pulls it straight back. A deletion has to be remembered until the
 * server has been told about it.
 */
export async function getDeletedBillIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DELETED_BILLS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function setDeletedBillIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DELETED_BILLS_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch (err) {
    console.warn('[CloudSync] Could not persist deleted bill ids:', err);
  }
}

/** Mark a bill as deleted so the deletion survives until the cloud accepts it. */
export async function recordBillDeletion(billId: string): Promise<void> {
  if (!billId) return;
  const existing = await getDeletedBillIds();
  if (!existing.includes(billId)) {
    await setDeletedBillIds([...existing, billId]);
  }
}

/**
 * Ask the server to delete a bill now. Best-effort: failure is fine because the
 * tombstone recorded locally is replayed on the next successful sync.
 */
export async function deleteBillInCloud(billId: string): Promise<boolean> {
  if (!billId) return false;
  if (!(await hasConfiguredServer())) return false;
  try {
    const endpoint = await getApiEndpoint();
    const user = await getCurrentUser();
    const userEmail = user?.email || 'default';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `${endpoint}/api/bills/${encodeURIComponent(billId)}?userEmail=${encodeURIComponent(userEmail)}`,
      { method: 'DELETE', signal: controller.signal }
    );
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    // Offline or unreachable - the tombstone keeps the deletion pending.
    return false;
  }
}

/**
 * Merge tombstones reported by the server into the local list, so a bill deleted
 * on another device is also dropped here.
 */
async function mergeServerTombstones(serverIds: unknown): Promise<Set<string>> {
  const local = await getDeletedBillIds();
  const incoming = Array.isArray(serverIds)
    ? serverIds.filter((id): id is string => typeof id === 'string')
    : [];
  const union = Array.from(new Set([...local, ...incoming]));
  if (union.length !== local.length) await setDeletedBillIds(union);
  return new Set(union);
}

export const SERVER_ENDPOINT_KEY = '@siteflow_server_endpoint';

/**
 * Public, always-on sync server baked in at build time (app.json -> extra.apiUrl).
 *
 * Everything below it is a developer convenience that only resolves on the same
 * Wi-Fi as the laptop running `npm run server`. A phone on mobile data or at a
 * different house can never reach those, so this is what makes sync work for a
 * real user. Empty until the API is deployed somewhere public.
 */
const CONFIGURED_API_URL: string =
  (Constants?.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim() || '';

// Local-network endpoints, used for development only.
const LOCALHOST_ENDPOINT = 'http://localhost:5050';
const DEFAULT_LAN_ENDPOINT = 'http://10.13.28.123:5050';
const FALLBACK_LAN_ENDPOINT = 'http://10.13.28.162:5050';
const ANDROID_EMULATOR_ENDPOINT = 'http://10.0.2.2:5050';

/**
 * Normalise a user-entered address: add the scheme, drop any trailing slash.
 *
 * A hosted server is https, but a laptop on the same Wi-Fi is plain http, and
 * assuming https for everything made every local address fail Test & Save with
 * no hint as to why. An address that is an IP or localhost gets http.
 */
export function normaliseEndpoint(input: string): string {
  let url = (input || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    const host = url.split('/')[0].split(':')[0];
    const isLocal = host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    url = `${isLocal ? 'http' : 'https'}://${url}`;
  }
  return url.replace(/\/+$/, '');
}

/**
 * Shown whenever something needs the sync server and this device has never been
 * given an address. This is not a failure: everything except sharing between
 * phones works offline, so the wording says what to do rather than blaming the
 * network for a setup step that was never done.
 */
export const NOT_CONFIGURED_MESSAGE =
  'Cloud sync is not set up on this device yet.\n\n' +
  'Open Settings > Cloud Sync Server, enter your sync server address and tap ' +
  'Test & Save. Bills, PDFs and Excel exports all work without it.';

/** True when a sync destination exists at all (configured, saved, or on a LAN). */
export async function hasConfiguredServer(): Promise<boolean> {
  return !!(await getServerEndpoint());
}

/**
 * How long to wait for a sync server that is spinning back up.
 *
 * Free hosting tiers stop a service after about fifteen minutes idle and take
 * up to a minute to restart it on the next request. The first sync of the day
 * is therefore always slow, and a short deadline turns that into "cannot reach
 * server" every time. Only the configured address gets this patience, and only
 * after a quick probe has already failed.
 */
const WAKE_TIMEOUT_MS = 60000;

let cachedWorkingEndpoint: string | null = null;

/** One health probe against `url`, with its own deadline. */
async function probeHealth(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/api/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Dynamically extract host IP from Expo bundler or React Native scriptURL if available
 */
function getMetroHostEndpoint(): string | null {
  try {
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      (Constants as any)?.manifest?.debuggerHost ||
      (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:5050`;
      }
    }
  } catch {}

  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:5050`;
      }
    }
  } catch {}

  return null;
}

/**
 * Current sync server address, or '' when this device has never been given one.
 *
 * The LAN addresses below only resolve next to the development machine. In a
 * released APK on someone else's phone they are unreachable, so answering with
 * one is worse than answering with nothing: Settings displays a stranger's IP
 * address as though it were configured, and every sign-in and every sync first
 * waits out a connection that cannot succeed. Outside development the answer is
 * the configured address or nothing at all.
 */
export async function getServerEndpoint(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(SERVER_ENDPOINT_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  if (CONFIGURED_API_URL) return CONFIGURED_API_URL;
  if (!__DEV__) return '';
  const metroHost = getMetroHostEndpoint();
  if (metroHost) return metroHost;
  return Platform.OS === 'web' ? LOCALHOST_ENDPOINT : DEFAULT_LAN_ENDPOINT;
}

/**
 * Set custom sync server endpoint
 */
export async function setServerEndpoint(url: string): Promise<void> {
  cachedWorkingEndpoint = null;
  const cleanUrl = normaliseEndpoint(url);
  if (cleanUrl) {
    await AsyncStorage.setItem(SERVER_ENDPOINT_KEY, cleanUrl);
  } else {
    await AsyncStorage.removeItem(SERVER_ENDPOINT_KEY);
  }
}

/**
 * Check an address really is a SiteFlow sync server before saving it, so a typo
 * is caught while the user is looking at the field rather than at sync time.
 */
export async function testAndSaveServerEndpoint(
  url: string
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = normaliseEndpoint(url);
  if (!cleanUrl) {
    await setServerEndpoint('');
    return { success: true, message: 'Sync server address cleared.' };
  }

  try {
    const controller = new AbortController();
    // Generous on purpose: this often runs against a service that has never
    // been woken, and failing at 15s would make a working address look wrong.
    const timeoutId = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS + 10000);
    const res = await fetch(`${cleanUrl}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, message: `Server answered with status ${res.status}. Please check the address.` };
    }

    const data = await res.json().catch(() => null);
    if (!data || data.status !== 'ok') {
      return {
        success: false,
        message: 'That address responded, but it is not a SiteFlow sync server.',
      };
    }

    await setServerEndpoint(cleanUrl);
    return { success: true, message: `Connected. Cloud sync is now set up for this device.` };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      success: false,
      message: aborted
        ? `${cleanUrl} did not respond within a minute.\n\nIf it is on a free host it may still be starting up - wait a moment and tap Test & Save again.`
        : `Could not reach ${cleanUrl}. Check the address and your internet connection.`,
    };
  }
}

/**
 * Determine best reachable endpoint for the sync server
 */
async function getApiEndpoint(): Promise<string> {
  if (cachedWorkingEndpoint) return cachedWorkingEndpoint;

  const savedEndpoint = (await AsyncStorage.getItem(SERVER_ENDPOINT_KEY).catch(() => null))?.trim();

  // LAN addresses only make sense next to the dev machine. On a released build
  // they are unreachable, and probing all of them costs ~12s before every sync.
  const lanCandidates = __DEV__
    ? [getMetroHostEndpoint(), DEFAULT_LAN_ENDPOINT, FALLBACK_LAN_ENDPOINT, ANDROID_EMULATOR_ENDPOINT, LOCALHOST_ENDPOINT]
    : [];

  const candidates = [savedEndpoint, CONFIGURED_API_URL, ...lanCandidates].filter(Boolean) as string[];
  const uniqueCandidates = Array.from(new Set(candidates));

  for (const url of uniqueCandidates) {
    const isConfigured = url === savedEndpoint || url === CONFIGURED_API_URL;

    // A LAN guess either answers immediately or is not there at all.
    if (await probeHealth(url, isConfigured ? 8000 : 2000)) {
      cachedWorkingEndpoint = url;
      return url;
    }

    // The address the user actually configured is worth waiting for: that
    // first probe is also what wakes a sleeping free-tier service.
    if (isConfigured && (await probeHealth(url, WAKE_TIMEOUT_MS))) {
      cachedWorkingEndpoint = url;
      return url;
    }
  }

  // Nothing answered. The first candidate lets callers name the address they
  // could not reach; '' means no address was ever configured, which is a
  // different problem with a different fix.
  return uniqueCandidates[0] || '';
}

export interface CloudStatusResult {
  connected: boolean;
  /** No server address on this device: setup is pending, nothing has failed. */
  notConfigured?: boolean;
  cluster?: string;
  dbName?: string;
  billCount?: number;
  lastBackup?: string | null;
  error?: string;
}

/**
 * Check connection status with MongoDB Atlas Sync Server
 */
export async function checkCloudConnection(): Promise<CloudStatusResult> {
  if (!(await hasConfiguredServer())) {
    return { connected: false, notConfigured: true, error: NOT_CONFIGURED_MESSAGE };
  }
  try {
    const endpoint = await getApiEndpoint();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${endpoint}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        connected: data.status === 'ok' && data.database === 'connected',
        cluster: data.cluster,
        dbName: data.dbName,
      };
    } else {
      cachedWorkingEndpoint = null;
      return { connected: false, error: `Server returned HTTP ${res.status}` };
    }
  } catch (err: any) {
    cachedWorkingEndpoint = null;
    return { connected: false, error: formatNetworkError(err, cachedWorkingEndpoint || 'Server') };
  }
}

function formatNetworkError(err: any, endpoint: string): string {
  const msg = String(err?.message || '');
  const lower = msg.toLowerCase();
  if (lower.includes('cleartext') || lower.includes('network security policy')) {
    return 'Network security policy blocked HTTP. Please install the updated APK with cleartext enabled.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('aborted') ||
    lower.includes('timeout') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound')
  ) {
    // Distinguish "never told where the server is" from "server is down".
    // Blaming Wi-Fi is wrong and unactionable when no address is set at all.
    if (!endpoint) return NOT_CONFIGURED_MESSAGE;
    const isLan = /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.)/i.test(endpoint);
    if (isLan) {
      return `Cannot reach sync server (${endpoint}). This is a local-network address, so it only works on the same Wi-Fi as the computer running the server.`;
    }
    return `Cannot reach sync server (${endpoint}). Check your internet connection, then try again. If the server was asleep it may need up to a minute to wake.`;
  }
  return msg || 'Failed to communicate with sync server.';
}

/**
 * Which of two copies of the same bill to keep.
 *
 * Every local write stamps `updatedAt`, so this is normally plain
 * last-write-wins. Comparing payment counts instead, as this used to, cannot
 * see an edit that changed items, rates or the customer: the counts stay equal,
 * the stale local copy wins, and the next sync uploads it over the edit made on
 * the other phone. That is how work done on one phone disappeared once the
 * other one synced.
 *
 * Bills written before the field existed carry no stamp, and for those the
 * payment count and settlement flag remain the only evidence available.
 */
function cloudCopyWins(local: Bill, cloud: Bill): boolean {
  const localStamp = local.updatedAt ?? 0;
  const cloudStamp = cloud.updatedAt ?? 0;
  if (localStamp || cloudStamp) return cloudStamp > localStamp;

  const localPayCount = local.paymentRecords?.length || 0;
  const cloudPayCount = cloud.paymentRecords?.length || 0;
  return cloudPayCount > localPayCount || (!!cloud.isSettled && !local.isSettled);
}

/**
 * Two-way Sync & Merge across all team devices (e.g. Brother A & Brother B)
 * - Uploads any local bills made on this phone
 * - Retrieves all bills created on other phones/devices
 * - Seamlessly merges and compresses data into local mobile storage
 */
export async function pullAndSyncTeamBills(): Promise<{
  success: boolean;
  billsCount: number;
  message: string;
}> {
  if (!(await hasConfiguredServer())) {
    return { success: false, billsCount: 0, message: NOT_CONFIGURED_MESSAGE };
  }
  try {
    const endpoint = await getApiEndpoint();
    const localBills = (await CompressedStorage.getItem<Bill[]>('@billmaker_bills')) || [];
    const localProfile = await CompressedStorage.getItem<BusinessProfile>('@billmaker_profile');
    const localPresets = (await CompressedStorage.getItem('@billmaker_contractor_presets')) || [];
    const user = await getCurrentUser();
    const userEmail = user?.email || 'default';

    const pendingDeletes = await getDeletedBillIds();

    // 1. Try bidirectional merge endpoint
    const res = await fetch(`${endpoint}/api/sync/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail,
        localBills,
        deletedIds: pendingDeletes,
        profile: localProfile,
        presets: localPresets,
        deviceId: Platform.OS,
      }),
    });

    if (!res.ok) {
      // Fallback to standard backup
      const backupRes = await syncAllToCloud();
      return {
        success: backupRes.success,
        billsCount: backupRes.syncedCount,
        message: backupRes.message,
      };
    }

    const data = await res.json();
    const cloudBills: Bill[] = data.bills || [];

    // Deletions confirmed by the server, plus any still pending here.
    const deleted = await mergeServerTombstones(data.deletedIds);

    // Intelligently merge: latest bill versions and payments
    const billMap = new Map<string, Bill>();
    for (const bill of localBills) {
      if (deleted.has(bill.id)) continue;
      billMap.set(bill.id, bill);
    }

    for (const cloudBill of cloudBills) {
      if (deleted.has(cloudBill.id)) continue;
      const existing = billMap.get(cloudBill.id);
      if (!existing || cloudCopyWins(existing, cloudBill)) {
        billMap.set(cloudBill.id, cloudBill);
      }
    }

    const merged = Array.from(billMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    await CompressedStorage.setItem('@billmaker_bills', merged);

    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNC_KEY, nowIso);

    return {
      success: true,
      billsCount: merged.length,
      message: `Synchronized ${merged.length} company bills across all devices.`,
    };
  } catch (err: any) {
    console.warn('[PullAndSync Error]', err);
    const endpoint = cachedWorkingEndpoint || (await getServerEndpoint());
    cachedWorkingEndpoint = null;
    return {
      success: false,
      billsCount: 0,
      message: formatNetworkError(err, endpoint),
    };
  }
}

/**
 * Push all local data (bills, profiles, presets) to MongoDB Atlas
 */
export async function syncAllToCloud(): Promise<{
  success: boolean;
  syncedCount: number;
  message: string;
}> {
  if (!(await hasConfiguredServer())) {
    return { success: false, syncedCount: 0, message: NOT_CONFIGURED_MESSAGE };
  }
  try {
    const endpoint = await getApiEndpoint();
    const bills = (await CompressedStorage.getItem<Bill[]>('@billmaker_bills')) || [];
    const profile = await CompressedStorage.getItem<BusinessProfile>('@billmaker_profile');
    const presets = (await CompressedStorage.getItem('@billmaker_contractor_presets')) || [];
    const user = await getCurrentUser();
    const userEmail = user?.email || 'default';

    const payload = {
      userEmail,
      bills,
      deletedIds: await getDeletedBillIds(),
      profile,
      presets,
      deviceId: Platform.OS,
      syncedAt: new Date().toISOString(),
    };

    const res = await fetch(`${endpoint}/api/sync/backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Backup failed with status ${res.status}`);
    }

    const data = await res.json();
    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNC_KEY, nowIso);

    return {
      success: true,
      syncedCount: bills.length,
      message: `Successfully backed up ${bills.length} bills to secure cloud storage.`,
    };
  } catch (err: any) {
    console.warn('[CloudSync Error]', err);
    const endpoint = cachedWorkingEndpoint || (await getServerEndpoint());
    cachedWorkingEndpoint = null;
    return {
      success: false,
      syncedCount: 0,
      message: formatNetworkError(err, endpoint),
    };
  }
}

/**
 * Restore all bills and profile from MongoDB Atlas to local device storage
 */
export async function restoreAllFromCloud(): Promise<{
  success: boolean;
  billsRestored: number;
  message: string;
}> {
  if (!(await hasConfiguredServer())) {
    return { success: false, billsRestored: 0, message: NOT_CONFIGURED_MESSAGE };
  }
  try {
    const endpoint = await getApiEndpoint();
    const user = await getCurrentUser();
    const userEmail = user?.email || 'default';

    const res = await fetch(`${endpoint}/api/sync/restore?userEmail=${encodeURIComponent(userEmail)}`);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Restore failed with status ${res.status}`);
    }

    const data = await res.json();
    const deleted = await mergeServerTombstones(data.deletedIds);
    const cloudBills: Bill[] = (data.bills || []).filter((b: Bill) => !deleted.has(b.id));
    const cloudProfile: BusinessProfile | null = data.profile;

    if (cloudBills.length > 0) {
      await CompressedStorage.setItem(BILLS_STORAGE_KEY, cloudBills);
    }

    if (cloudProfile) {
      await CompressedStorage.setItem('@billmaker_profile', cloudProfile);
    }

    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNC_KEY, nowIso);

    return {
      success: true,
      billsRestored: cloudBills.length,
      message: `Restored ${cloudBills.length} bills and contractor profile from secure cloud storage.`,
    };
  } catch (err: any) {
    console.error('[CloudRestore Error]', err);
    const endpoint = cachedWorkingEndpoint || (await getServerEndpoint());
    cachedWorkingEndpoint = null;
    return {
      success: false,
      billsRestored: 0,
      message: formatNetworkError(err, endpoint),
    };
  }
}

/**
 * Get timestamp of last successful cloud backup
 */
export async function getLastCloudSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Check if auto-sync is enabled
 */
export async function isAutoSyncEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(AUTO_SYNC_ENABLED_KEY);
    return val !== 'false'; // Enabled by default
  } catch {
    return true;
  }
}

/**
 * Set auto-sync preference
 */
export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTO_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save auto-sync setting:', e);
  }
}

let syncTimeout: any = null;

/**
 * Non-blocking auto-sync trigger to keep Atlas and other devices up to date
 */
export function triggerBackgroundCloudSync(): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const enabled = await isAutoSyncEnabled();
      if (!enabled) return;
      if (!(await hasConfiguredServer())) return;
      await pullAndSyncTeamBills();
      console.log('[CloudSync] Background sync to MongoDB Atlas completed.');
    } catch (e) {
      // Non-blocking, fails silently in background
    }
  }, 1500);
}
