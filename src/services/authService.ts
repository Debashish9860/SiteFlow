import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getServerEndpoint } from './cloudSyncService';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'contractor' | 'admin';
  createdAt: number;
}

export interface StoredUserCredential {
  user: User;
  /**
   * Salted SHA-256 of the password, used only to allow sign-in while offline.
   * Never the raw password: AsyncStorage is unencrypted and readable from a
   * device backup. Entries written before hashing existed have no `salt`.
   */
  passwordHash: string;
  salt?: string;
}

const SESSION_KEY = '@siteflow_auth_session';
const USERS_KEY = '@siteflow_registered_users';

/**
 * Resetting a password means emailing a code, which only the server can do.
 * Unlike signing in, there is no offline path to fall back on.
 */
const RESET_NEEDS_SERVER_MESSAGE =
  'Password reset needs cloud sync set up on this device.\n\n' +
  'Open Settings > Cloud Sync Server, add your server address, then try again.';

/** Random salt so identical passwords do not produce identical digests. */
async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

/** Build the locally-cached credential record for a signed-in user. */
async function buildCredential(user: User, password: string): Promise<StoredUserCredential> {
  const salt = await generateSalt();
  return { user, salt, passwordHash: await hashPassword(password, salt) };
}

/**
 * Check a password against a cached credential, tolerating records written
 * before hashing was introduced (those stored the password verbatim).
 */
async function credentialMatches(
  cred: StoredUserCredential,
  password: string
): Promise<boolean> {
  if (!cred.salt) return cred.passwordHash === password;
  return (await hashPassword(password, cred.salt)) === cred.passwordHash;
}

async function persistUsers(users: StoredUserCredential[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Push an account that so far exists only on this phone up to the server.
 *
 * Registering while the server is unreachable still succeeds locally, and that
 * account never reaches the cloud, so the other phones cannot see the person at
 * all. The first sign-in that does reach a server is the moment to repair it.
 * Best effort: if this fails the account still works here and the next sign-in
 * tries again.
 */
async function promoteLocalAccount(
  endpoint: string,
  user: User,
  password: string
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    await fetch(`${endpoint}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.name, email: user.email, password }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // Offline again, or the server refused it. Nothing here is lost.
  }
}

/**
 * True when a request failed because the server could not be reached (offline,
 * wrong LAN, timed out) rather than because it replied with a rejection.
 */
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  if (err.name === 'AbortError' || err.name === 'TypeError') return true;
  return /network request failed|failed to fetch|timeout|aborted/i.test(err.message);
}

/**
 * Validate that an email is a valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

/**
 * Fetch all registered genuine users from local storage
 */
export async function getStoredUsers(): Promise<StoredUserCredential[]> {
  try {
    const data = await AsyncStorage.getItem(USERS_KEY);
    const list: StoredUserCredential[] = data ? JSON.parse(data) : [];
    return list;
  } catch (error) {
    console.error('Error fetching stored users:', error);
    return [];
  }
}

/**
 * Get the currently logged-in user session
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const sessionData = await AsyncStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    return JSON.parse(sessionData);
  } catch (error) {
    console.error('Error fetching current session:', error);
    return null;
  }
}

/**
 * Authenticate a genuine user with their email & password
 */
export async function loginUser(emailInput: string, passwordInput: string): Promise<User> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }
  if (!isValidEmail(email)) {
    throw new Error('Please enter a valid Google/email address.');
  }

  // 1. Ask the sync server first, when this device has an address for one.
  //    With no address there is nothing to ask: the local cache below is the
  //    whole story, so go straight to it rather than waiting out a timeout on
  //    every sign-in.
  const endpoint = await getServerEndpoint();
  if (endpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${endpoint}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          // Cache user locally so the same login works offline later.
          const users = await getStoredUsers();
          const existingIdx = users.findIndex((u) => u.user.email.toLowerCase() === email);
          const credItem = await buildCredential(
            {
              id: data.user.id || `usr_${Date.now()}`,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role || 'contractor',
              createdAt: data.user.createdAt ? new Date(data.user.createdAt).getTime() : Date.now(),
            },
            password
          );

          if (existingIdx >= 0) {
            users[existingIdx] = credItem;
          } else {
            users.push(credItem);
          }
          await persistUsers(users);
          await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(credItem.user));
          return credItem.user;
        }
      }

      // The server answered and refused. What that means depends on why.
      const data = await res.json().catch(() => null);
      const cached = await getStoredUsers();
      const cachedIdx = cached.findIndex((u) => u.user.email.toLowerCase() === email);
      const cachedAccepts =
        cachedIdx >= 0 && (await credentialMatches(cached[cachedIdx], password));

      // The server has never heard of this account, but this phone accepts the
      // password. That is exactly what registering while offline leaves behind,
      // so sign in locally and push the account up now that a server is
      // reachable - until it is there, no other phone can see this person.
      if (data?.reason === 'no_account' && cachedAccepts) {
        await promoteLocalAccount(endpoint, cached[cachedIdx].user, password);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(cached[cachedIdx].user));
        return cached[cachedIdx].user;
      }

      // A password this phone still accepts but the server rejects is one that
      // was changed from another device, so the cached copy is stale and goes.
      if (data?.reason === 'bad_password' && cachedAccepts) {
        cached.splice(cachedIdx, 1);
        await persistUsers(cached);
        throw new Error(
          'This password was changed on another device. Please sign in with the new one.'
        );
      }

      // Any other refusal leaves the cache alone. Clearing it on a plain typo,
      // or because an older server cannot say which of the two cases this is,
      // would lock a working account out of this phone for good.
      throw new Error(
        data?.message || 'Invalid email or password. Please verify your credentials.'
      );
    } catch (err) {
      // A rejection we raised above is final; only a genuine connection failure
      // should fall through to offline validation.
      if (err instanceof Error && !isNetworkError(err)) throw err;
    }
  }

  // 2. Validate against local genuine registered users
  const users = await getStoredUsers();
  const candidate = users.find((u) => u.user.email.toLowerCase() === email);
  const match = candidate && (await credentialMatches(candidate, password)) ? candidate : undefined;

  if (!match) {
    if (candidate) {
      throw new Error('Incorrect password. Please try again or tap "Forgot Password".');
    }
    throw new Error('No account found with this email. Please register a new account.');
  }

  // Upgrade any credential still stored from before hashing existed.
  if (!match.salt) {
    const upgraded = await buildCredential(match.user, password);
    const idx = users.findIndex((u) => u.user.email.toLowerCase() === email);
    if (idx >= 0) {
      users[idx] = upgraded;
      await persistUsers(users);
    }
  }

  // Save active session
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(match.user));
  return match.user;
}

/**
 * Register a new genuine user with Name, Google Email, Password and Confirm Password
 */
export async function registerUser(
  nameInput: string,
  emailInput: string,
  passwordInput: string,
  confirmPasswordInput?: string
): Promise<User> {
  const name = nameInput.trim();
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!name) {
    throw new Error('Please enter your full name.');
  }
  if (!email) {
    throw new Error('Please enter your Google email address.');
  }
  if (!isValidEmail(email)) {
    throw new Error('Please enter a valid Google email (e.g. yourname@gmail.com).');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  if (confirmPasswordInput !== undefined && password !== confirmPasswordInput.trim()) {
    throw new Error('Passwords do not match. Please re-check your password confirmation.');
  }

  // Check local duplicate
  const users = await getStoredUsers();
  const existingLocal = users.find((u) => u.user.email.toLowerCase() === email);
  if (existingLocal) {
    throw new Error('An account with this email already exists. Please Sign In.');
  }

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    email,
    role: 'contractor',
    createdAt: Date.now(),
  };

  // 1. Mirror the registration to the sync server when there is one. With no
  //    address the account is local-only for now; the first sign-in that does
  //    reach a server pushes it up (see promoteLocalAccount).
  const registerEndpoint = await getServerEndpoint();
  if (registerEndpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${registerEndpoint}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok && res.status === 409) {
        throw new Error('An account with this email already exists in cloud. Please Sign In.');
      }
    } catch (err: any) {
      if (err?.message && err.message.includes('already exists')) {
        throw err;
      }
      // Offline registration continues locally
    }
  }

  // 2. Store user locally
  users.push(await buildCredential(newUser, password));

  await persistUsers(users);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newUser));

  return newUser;
}

/**
 * Request a 6-digit OTP code sent via Gmail to user's email (5-minute expiration)
 */
export async function sendPasswordResetOtp(
  emailInput: string
): Promise<{ success: boolean; message: string; expiresInSeconds: number }> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    throw new Error('Please enter a valid Google email address.');
  }

  const endpoint = await getServerEndpoint();
  if (!endpoint) throw new Error(RESET_NEEDS_SERVER_MESSAGE);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${endpoint}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Could not send OTP email. Please verify email and try again.');
    }

    return {
      success: true,
      message: data.message,
      expiresInSeconds: data.expiresInSeconds || 300,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('OTP request timed out. Please check your internet connection.');
    }
    // A raw 'Network request failed' tells the user nothing they can act on.
    if (isNetworkError(err)) {
      throw new Error(
        `Could not reach the sync server (${endpoint}).\n\n` +
          'Check your internet connection, or confirm the address in ' +
          'Settings > Cloud Sync Server.'
      );
    }
    throw err;
  }
}

/**
 * Verify 6-digit OTP and reset user password in cloud & local storage
 */
export async function verifyOtpAndResetPassword(
  emailInput: string,
  otpInput: string,
  newPasswordInput: string,
  confirmPasswordInput: string
): Promise<{ success: boolean; message: string }> {
  const email = emailInput.trim().toLowerCase();
  const otp = otpInput.trim();
  const newPassword = newPasswordInput.trim();
  const confirmPassword = confirmPasswordInput.trim();

  if (!email || !isValidEmail(email)) {
    throw new Error('Please enter a valid Google email address.');
  }
  if (!otp || otp.length !== 6) {
    throw new Error('Please enter the 6-digit verification code sent to your email.');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }
  if (newPassword !== confirmPassword) {
    throw new Error('New passwords do not match. Please re-enter.');
  }

  const endpoint = await getServerEndpoint();
  if (!endpoint) throw new Error(RESET_NEEDS_SERVER_MESSAGE);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${endpoint}/api/auth/verify-otp-and-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'OTP verification failed.');
    }

    // Update local storage cache for offline login
    const users = await getStoredUsers();
    const userIdx = users.findIndex((u) => u.user.email.toLowerCase() === email);
    if (userIdx >= 0) {
      users[userIdx] = await buildCredential(users[userIdx].user, newPassword);
      await persistUsers(users);
    }

    return {
      success: true,
      message: data.message || 'Password reset successfully!',
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Verification request timed out. Please try again.');
    }
    if (isNetworkError(err)) {
      throw new Error(
        `Could not reach the sync server (${endpoint}).\n\n` +
          'Check your internet connection, then try again.'
      );
    }
    throw err;
  }
}

/**
 * Log out user by clearing session from storage
 */
export async function logoutUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Error removing session:', error);
    throw error;
  }
}
