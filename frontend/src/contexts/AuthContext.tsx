import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';

export interface User {
  id: number;
  username: string;
  nickname: string;
  phone?: string;
  role: string;
  group_id?: number | null;
  campus_id?: number | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCoach: boolean;
  isParent: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // If old-format user without role, fetch from /me
        if (!parsed.role) {
          setToken(savedToken);
          authApi.me()
            .then((res) => {
              const u = res.data;
              const userData: User = {
                id: u.id,
                username: u.username,
                nickname: u.nickname || u.username,
                phone: u.phone,
                role: u.role || 'student',
                group_id: u.group_id,
                campus_id: u.campus_id,
              };
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
            })
            .catch(() => {
              logout();
            });
        } else {
          setToken(savedToken);
          setUser(parsed);
        }
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    const data = res.data;
    const userData: User = {
      id: data.user.id,
      username: data.user.username,
      nickname: data.user.nickname || data.user.username,
      phone: data.user.phone,
      role: data.user.role || 'student',
      group_id: data.user.group_id,
      campus_id: data.user.campus_id,
    };
    setToken(data.access_token);
    setUser(userData);
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const register = async (username: string, password: string, nickname?: string) => {
    const res = await authApi.register({ username, password, nickname });
    const data = res.data;
    const userData: User = {
      id: data.user.id,
      username: data.user.username,
      nickname: data.user.nickname || data.user.username,
      phone: data.user.phone,
      role: data.user.role || 'student',
      group_id: data.user.group_id,
      campus_id: data.user.campus_id,
    };
    setToken(data.access_token);
    setUser(userData);
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!token,
        isAdmin: !!user && (user.role === 'group_admin' || user.role === 'campus_admin'),
        isCoach: !!user && user.role === 'coach',
        isParent: !!user && user.role === 'parent',
        isStudent: !!user && user.role === 'student',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
