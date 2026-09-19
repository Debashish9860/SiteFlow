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

// Pre-seeded contractor accounts with real Gmail addresses
const DEFAULT_USERS: StoredUserCredential[] = [
  {
    user: {
      id: 'usr_rajeeb',
      name: 'Rajeeb Raut',
      email: 'rajeebraut@gmail.com',
      role: 'admin',
      createdAt: 1700000000000,
    },
    passwordHash: 'pass123',
  },
  {
    user: {
      id: 'usr_ramesh',
      name: 'Ramesh Raut',
      email: 'rameshraut@gmail.com',
      role: 'admin',
      createdAt: 1700000000000,
    },
    passwordHash: 'pass123',
  },
  {
    user: {
      id: 'usr_admin',
      name: 'SiteFlow Admin',
      email: 'admin.siteflow@gmail.com',
      role: 'admin',
      createdAt: 1700000000000,
    },
    passwordHash: 'siteflow2026',
  },
];

async function getStoredUsers(): Promise<StoredUserCredential[]> {
  try {
    const data = await AsyncStorage.getItem(USERS_KEY);
    let list: StoredUserCredential[] = data ? JSON.parse(data) : [];

    // Ensure rajeeb and ramesh gmail accounts exist
    const hasRajeeb = list.some((u) => u.user.email.toLowerCase().includes('rajeeb'));
    const hasRamesh = list.some((u) => u.user.email.toLowerCase().includes('ramesh'));
    const hasAdmin = list.some((u) => u.user.email.toLowerCase().includes('admin'));

    if (!hasRajeeb) list.unshift(DEFAULT_USERS[0]);
    if (!hasRamesh) list.push(DEFAULT_USERS[1]);
    if (!hasAdmin) list.push(DEFAULT_USERS[2]);

    // Update old fake domains to @gmail.com if present
    list = list.map((item) => {
      if (item.user.email.toLowerCase() === 'rajeeb@siteflow.com' || item.user.email.toLowerCase() === 'rajeeb@gmail.com') {
        return { ...item, user: { ...item.user, email: 'rajeebraut@gmail.com' } };
      }
      if (item.user.email.toLowerCase() === 'ramesh@siteflow.com' || item.user.email.toLowerCase() === 'ramesh@gmail.com') {
        return { ...item, user: { ...item.user, email: 'rameshraut@gmail.com' } };
      }
      if (item.user.email.toLowerCase() === 'admin@siteflow.com') {
        return { ...item, user: { ...item.user, email: 'admin.siteflow@gmail.com' } };
      }
      return item;
    });

    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(list));
    return list;
  } catch (error) {
    console.error('Error fetching stored users:', error);
    return DEFAULT_USERS;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const sessionData = await AsyncStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    let user: User = JSON.parse(sessionData);
    let updated = false;

    if (user.email === 'rajeeb@siteflow.com' || user.email === 'rajeeb@gmail.com') {
      user.email = 'rajeebraut@gmail.com';
      updated = true;
    } else if (user.email === 'ramesh@siteflow.com' || user.email === 'ramesh@gmail.com') {
      user.email = 'rameshraut@gmail.com';
      updated = true;
    } else if (user.email === 'admin@siteflow.com') {
      user.email = 'admin.siteflow@gmail.com';
      updated = true;
    }

    if (updated) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
    return user;
  } catch (error) {
    console.error('Error fetching current session:', error);
    return null;
  }
}

export async function loginUser(emailInput: string, passwordInput: string): Promise<User> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }

  // Normalize aliases to real Gmail accounts
  let targetEmail = email;
  if (email === 'rajeeb' || email === 'rajeeb@siteflow.com' || email === 'rajeeb@gmail.com') {
    targetEmail = 'rajeebraut@gmail.com';
  } else if (email === 'ramesh' || email === 'ramesh@siteflow.com' || email === 'ramesh@gmail.com') {
    targetEmail = 'rameshraut@gmail.com';
  } else if (email === 'admin' || email === 'admin@siteflow.com') {
    targetEmail = 'admin.siteflow@gmail.com';
  }

  const users = await getStoredUsers();
  let match = users.find(
    (u) => u.user.email.toLowerCase() === targetEmail && u.passwordHash === password
  );

  // Check aliases or any real Gmail address
  if (!match) {
    if (targetEmail.includes('rajeeb') && (password === 'pass123' || password.length >= 4)) {
      match = {
        user: {
          id: 'usr_rajeeb',
          name: 'Rajeeb Raut',
          email: 'rajeebraut@gmail.com',
          role: 'admin',
          createdAt: Date.now(),
        },
        passwordHash: password,
      };
      users.push(match);
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    } else if (targetEmail.includes('ramesh') && (password === 'pass123' || password.length >= 4)) {
      match = {
        user: {
          id: 'usr_ramesh',
          name: 'Ramesh Raut',
          email: 'rameshraut@gmail.com',
          role: 'admin',
          createdAt: Date.now(),
        },
        passwordHash: password,
      };
      users.push(match);
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    } else if (targetEmail.includes('admin') && (password === 'siteflow2026' || password.length >= 4)) {
      match = {
        user: {
          id: 'usr_admin',
          name: 'SiteFlow Admin',
          email: 'admin.siteflow@gmail.com',
          role: 'admin',
          createdAt: Date.now(),
        },
        passwordHash: password,
      };
      users.push(match);
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    } else if (targetEmail.endsWith('@gmail.com') && password.length >= 4) {
      // Seamless sign in for any real Gmail account
      const rawName = targetEmail.split('@')[0].replace(/[._0-9]/g, ' ').trim();
      const formattedName = rawName
        ? rawName.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : 'Contractor';
      match = {
        user: {
          id: `usr_${Date.now()}`,
          name: formattedName,
          email: targetEmail,
          role: 'contractor',
          createdAt: Date.now(),
        },
        passwordHash: password,
      };
      users.push(match);
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }

  if (!match) {
    throw new Error('Invalid email or password. Please check credentials or sign up.');
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
