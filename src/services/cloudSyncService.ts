import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getCurrentUser } from './authService';
import { Bill, BusinessProfile } from '../types/bill';
import { CompressedStorage } from './compressedStorage';

const LAST_SYNC_KEY = '@siteflow_last_cloud_sync';
const AUTO_SYNC_ENABLED_KEY = '@siteflow_auto_sync_enabled';

// Local network endpoints: localhost for Web/Simulator, LAN IP for physical device
export const SERVER_ENDPOINT_KEY = '@siteflow_server_endpoint';
const LOCALHOST_ENDPOINT = 'http://localhost:5050';
const DEFAULT_LAN_ENDPOINT = 'http://10.13.28.123:5050';
const FALLBACK_LAN_ENDPOINT = 'http://10.13.28.162:5050';
const ANDROID_EMULATOR_ENDPOINT = 'http://10.0.2.2:5050';

let cachedWorkingEndpoint: string | null = null;

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
 * Get current configured sync server endpoint
 */
export async function getServerEndpoint(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(SERVER_ENDPOINT_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  const metroHost = getMetroHostEndpoint();
  if (metroHost) return metroHost;
  return Platform.OS === 'web' ? LOCALHOST_ENDPOINT : DEFAULT_LAN_ENDPOINT;
}

/**
 * Set custom sync server endpoint
 */
export async function setServerEndpoint(url: string): Promise<void> {
  cachedWorkingEndpoint = null;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  await AsyncStorage.setItem(SERVER_ENDPOINT_KEY, cleanUrl);
}

/**
 * Determine best reachable endpoint for the sync server
 */
async function getApiEndpoint(): Promise<string> {
  if (cachedWorkingEndpoint) return cachedWorkingEndpoint;

  const customEndpoint = await getServerEndpoint();
  const metroEndpoint = getMetroHostEndpoint();
  const candidates = [
    customEndpoint,
    metroEndpoint,
    DEFAULT_LAN_ENDPOINT,
    FALLBACK_LAN_ENDPOINT,
    ANDROID_EMULATOR_ENDPOINT,
    LOCALHOST_ENDPOINT,
  ].filter(Boolean) as string[];
  const uniqueCandidates = Array.from(new Set(candidates));

  for (const url of uniqueCandidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${url}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        cachedWorkingEndpoint = url;
        return url;
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Fallback to configured or platform default
  return customEndpoint;
}

export interface CloudStatusResult {
  connected: boolean;
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
    return `Cannot reach sync server (${endpoint}). Please make sure the sync server is running and devices are on the same Wi-Fi/network.`;
  }
  return msg || 'Failed to communicate with sync server.';
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
  try {
    const endpoint = await getApiEndpoint();
    const localBills = (await CompressedStorage.getItem<Bill[]>('@billmaker_bills')) || [];
    const localProfile = await CompressedStorage.getItem<BusinessProfile>('@billmaker_profile');
    const localPresets = (await CompressedStorage.getItem('@billmaker_contractor_presets')) || [];
    const user = await getCurrentUser();
    const userEmail = user?.email || 'default';

    // 1. Try bidirectional merge endpoint
    const res = await fetch(`${endpoint}/api/sync/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail,
        localBills,
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

    // Intelligently merge: latest bill versions and payments
    const billMap = new Map<string, Bill>();
    for (const bill of localBills) {
      billMap.set(bill.id, bill);
    }

    for (const cloudBill of cloudBills) {
      const existing = billMap.get(cloudBill.id);
      if (!existing) {
        billMap.set(cloudBill.id, cloudBill);
      } else {
        const localPayCount = existing.paymentRecords?.length || 0;
        const cloudPayCount = cloudBill.paymentRecords?.length || 0;
        if (cloudPayCount > localPayCount || (cloudBill.isSettled && !existing.isSettled)) {
          billMap.set(cloudBill.id, cloudBill);
        }
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
    const endpoint = cachedWorkingEndpoint || DEFAULT_LAN_ENDPOINT;
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
    const endpoint = cachedWorkingEndpoint || DEFAULT_LAN_ENDPOINT;
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
    const cloudBills: Bill[] = data.bills || [];
    const cloudProfile: BusinessProfile | null = data.profile;

    if (cloudBills.length > 0) {
      await CompressedStorage.setItem('@billmaker_bills', cloudBills);
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
    const endpoint = cachedWorkingEndpoint || DEFAULT_LAN_ENDPOINT;
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
      await pullAndSyncTeamBills();
      console.log('[CloudSync] Background sync to MongoDB Atlas completed.');
    } catch (e) {
      // Non-blocking, fails silently in background
    }
  }, 1500);
}
