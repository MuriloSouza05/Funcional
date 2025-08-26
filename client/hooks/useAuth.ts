import { useState, useEffect, createContext, useContext } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  accountType: 'simples' | 'composta' | 'gerencial';
  tenantId: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      
      // Store tokens
      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);
      
      // Decode and set user from token
      const tokenPayload = JSON.parse(atob(data.tokens.accessToken.split('.')[1]));
      setUser({
        id: tokenPayload.userId,
        name: tokenPayload.name || 'Usuário',
        email: tokenPayload.email,
        accountType: tokenPayload.accountType,
        tenantId: tokenPayload.tenantId
      });

    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      // Try to decode token
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      
      // Check if token is expired
      const isExpired = tokenPayload.exp * 1000 < Date.now();
      
      if (isExpired) {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          logout();
          return;
        }

        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('accessToken', data.tokens.accessToken);
          localStorage.setItem('refreshToken', data.tokens.refreshToken);
          
          const newTokenPayload = JSON.parse(atob(data.tokens.accessToken.split('.')[1]));
          setUser({
            id: newTokenPayload.userId,
            name: newTokenPayload.name || 'Usuário',
            email: newTokenPayload.email,
            accountType: newTokenPayload.accountType,
            tenantId: newTokenPayload.tenantId
          });
        } else {
          logout();
        }
      } else {
        setUser({
          id: tokenPayload.userId,
          name: tokenPayload.name || 'Usuário',
          email: tokenPayload.email,
          accountType: tokenPayload.accountType,
          tenantId: tokenPayload.tenantId
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};