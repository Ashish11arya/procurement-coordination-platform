import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../../../types';
import { api } from '../../../services/api.service';
import { realtime } from '../../../realtime/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginFarmer: (mobile: string, otp: string) => Promise<User>;
  registerFarmer: (data: any) => Promise<User>;
  loginOperator: (identifier: string, pass: string, mfa?: string) => Promise<User>;
  logout: () => void;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('procurement_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('procurement_auth_token');
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token) {
      realtime.connect(token);
    }
  }, [token]);

  const saveAuthSession = (accessToken: string, authUser: User) => {
    setToken(accessToken);
    setUser(authUser);
    localStorage.setItem('procurement_auth_token', accessToken);
    localStorage.setItem('procurement_auth_user', JSON.stringify(authUser));
    realtime.connect(accessToken);
  };

  const loginFarmer = async (mobile: string, otp: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.verifyFarmerOtp(mobile, otp);
      saveAuthSession(res.accessToken, res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const registerFarmer = async (data: any): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.registerFarmer(data);
      saveAuthSession(res.accessToken, res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const loginOperator = async (identifier: string, pass: string, mfa?: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.loginOperator(identifier, pass, mfa);
      const accessToken = res.accessToken || res.tokens?.accessToken;
      if (!accessToken) {
        throw new Error('Access token missing from login response.');
      }
      saveAuthSession(accessToken, res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('procurement_auth_token');
    localStorage.removeItem('procurement_auth_user');
    realtime.disconnect();
  };

  const hasRole = (roles: Role[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        loginFarmer,
        registerFarmer,
        loginOperator,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
