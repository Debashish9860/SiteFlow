import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from './authService';
import { Bill, BusinessProfile } from '../types/bill';

const LAST_SYNC_KEY = '@siteflow_last_cloud_sync';
const AUTO_SYNC_ENABLED_KEY = '@siteflow_auto_sync_enabled';

// Local network endpoints: localhost for Web/Simulator, LAN IP for physical device
const LOCALHOST_ENDPOINT = 'http://localhost:5050';
const LAN_ENDPOINT = 'http://10.13.28.162:5050';

let cachedWorkingEndpoint: string | null = null;

/**
 * Determine best reachable endpoint for the MongoDB Atlas sync server
 */
async function getApiEndpoint(): Promise<string> {
  if (cachedWorkingEndpoint) return cachedWorkingEndpoint;

  const candidates = Platform.OS === 'web' 
    ? [LOCALHOST_ENDPOINT, LAN_ENDPOINT] 
    : [LAN_ENDPOINT, LOCALHOST_ENDPOINT];

  for (const url of candidates) {
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

  // Default fallback based on platform
  return Platform.OS === 'web' ? LOCALHOST_ENDPOINT : LAN_ENDPOINT;
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
      return { connected: false, error: `Server returned HTTP ${res.status}` };
    }
  } catch (err: any) {
    return { connected: false, error: err?.message || 'Sync server unreachable' };
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
    const billsRaw = await AsyncStorage.getItem('@billmaker_bills');
    const bills: Bill[] = billsRaw ? JSON.parse(billsRaw) : [];
    const profileRaw = await AsyncStorage.getItem('@billmaker_profile');
    const profile: BusinessProfile | null = profileRaw ? JSON.parse(profileRaw) : null;
    const presetsRaw = await AsyncStorage.getItem('@billmaker_contractor_presets');
    const presets = presetsRaw ? JSON.parse(presetsRaw) : [];
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
      message: `Successfully backed up ${bills.length} bills to MongoDB Atlas.`,
    };
  } catch (err: any) {
    console.warn('[CloudSync Error]', err);
    return {
      success: false,
      syncedCount: 0,
      message: err?.message || 'Failed to sync with cloud database.',
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
      await AsyncStorage.setItem('@billmaker_bills', JSON.stringify(cloudBills));
    }

    if (cloudProfile) {
      await AsyncStorage.setItem('@billmaker_profile', JSON.stringify(cloudProfile));
    }

    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNC_KEY, nowIso);

    return {
      success: true,
      billsRestored: cloudBills.length,
      message: `Restored ${cloudBills.length} bills and contractor profile from MongoDB Atlas.`,
    };
  } catch (err: any) {
    console.error('[CloudRestore Error]', err);
    return {
      success: false,
      billsRestored: 0,
      message: err?.message || 'Failed to restore data from cloud database.',
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
 * Non-blocking auto-sync trigger to keep Atlas up to date
 */
export function triggerBackgroundCloudSync(): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const enabled = await isAutoSyncEnabled();
      if (!enabled) return;
      await syncAllToCloud();
      console.log('[CloudSync] Background sync to MongoDB Atlas completed.');
    } catch (e) {
      // Non-blocking, fails silently in background
    }
  }, 1500);
}
