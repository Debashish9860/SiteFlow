import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
  sendPasswordResetOtp,
  verifyOtpAndResetPassword,
} from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, confirmPassword?: string) => Promise<void>;
  sendOtp: (email: string) => Promise<{ success: boolean; message: string; expiresInSeconds: number }>;
  verifyOtpAndReset: (email: string, otp: string, newPass: string, confirmPass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const activeUser = await getCurrentUser();
        setUser(activeUser);
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const loggedInUser = await loginUser(email, password);
    setUser(loggedInUser);
  };

  const signup = async (name: string, email: string, password: string, confirmPassword?: string) => {
    const newUser = await registerUser(name, email, password, confirmPassword);
    setUser(newUser);
  };

  const sendOtp = async (email: string) => {
    return await sendPasswordResetOtp(email);
  };

  const verifyOtpAndReset = async (email: string, otp: string, newPass: string, confirmPass: string) => {
    return await verifyOtpAndResetPassword(email, otp, newPass, confirmPass);
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        sendOtp,
        verifyOtpAndReset,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
