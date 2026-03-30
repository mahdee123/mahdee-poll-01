import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);

  // Check auth state once on app mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedCompany = localStorage.getItem('company');

    if (token && storedUser && storedCompany) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
      setCompany(JSON.parse(storedCompany));
    } else {
      setIsAuthenticated(false);
      setUser(null);
      setCompany(null);
    }

    setIsLoading(false);
  }, []);

  const setAuth = (token, userData, companyData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('company', JSON.stringify(companyData));
    setIsAuthenticated(true);
    setUser(userData);
    setCompany(companyData);
  };

  const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('company');
    setIsAuthenticated(false);
    setUser(null);
    setCompany(null);
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    company,
    setAuth,
    clearAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
