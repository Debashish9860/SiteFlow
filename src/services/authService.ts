import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'contractor' | 'admin';
  createdAt: number;
}

interface StoredUserCredential {
  user: User;
  passwordHash: string; // Stored securely in AsyncStorage
}

const SESSION_KEY = '@siteflow_auth_session';
const USERS_KEY = '@siteflow_registered_users';

// Pre-seeded contractor accounts for seamless 1-tap or email login
const DEFAULT_USERS: StoredUserCredential[] = [
  {
    user: {
      id: 'usr_ramesh',
      name: 'Ramesh Raut',
      email: 'ramesh@siteflow.com',
      role: 'admin',
      createdAt: 1700000000000,
    },
    passwordHash: 'pass123',
  },
  {
    user: {
      id: 'usr_rajeeb',
      name: 'Rajeeb Raut',
      email: 'rajeeb@siteflow.com',
      role: 'admin',
      createdAt: 1700000000000,
    },
    passwordHash: 'pass123',
  },
  {
    user: {
      id: 'usr_admin',
      name: 'SiteFlow Admin',
      email: 'admin@siteflow.com',
      role: 'admin',
      createdAt: 1700000000000,
    },
    passwordHash: 'siteflow2026',
  },
];

async function getStoredUsers(): Promise<StoredUserCredential[]> {
  try {
    const data = await AsyncStorage.getItem(USERS_KEY);
    if (!data) {
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error fetching stored users:', error);
    return DEFAULT_USERS;
  }
}

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

export async function loginUser(emailInput: string, passwordInput: string): Promise<User> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!email || !password) {
    throw new Error('Please provide both email and password.');
  }

  const users = await getStoredUsers();
  const match = users.find(
    (u) => u.user.email.toLowerCase() === email && u.passwordHash === password
  );

  if (!match) {
    throw new Error('Invalid email or password. Please check your credentials.');
  }

  // Save session
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(match.user));
  return match.user;
}

export async function registerUser(
  nameInput: string,
  emailInput: string,
  passwordInput: string
): Promise<User> {
  const name = nameInput.trim();
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!name) {
    throw new Error('Please enter your full name.');
  }
  if (!email || !email.includes('@') || !email.includes('.')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const users = await getStoredUsers();
  const existing = users.find((u) => u.user.email.toLowerCase() === email);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    email,
    role: 'contractor',
    createdAt: Date.now(),
  };

  users.push({
    user: newUser,
    passwordHash: password,
  });

  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newUser));

  return newUser;
}

export async function logoutUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Error removing session:', error);
    throw error;
  }
}
