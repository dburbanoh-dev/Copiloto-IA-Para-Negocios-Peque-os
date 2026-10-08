import React, { createContext, useState, useEffect } from 'react';
import { fetchApi } from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('negocioai_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchApi('/auth/me');
        setUser(data.user);
        setBusiness(data.business);
      } catch (error) {
        console.error('Sesión expirada o inválida:', error.message);
        logout();
      } finally {
        setLoading(false);
      }
    };
    checkAuth();

    const handleAuthExpired = () => logout();
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [token]);

  const login = async (email, password) => {
    const data = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('negocioai_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setBusiness(data.business);
    return data;
  };

  const register = async (formData) => {
    const data = await fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    localStorage.setItem('negocioai_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setBusiness(data.business);
    return data;
  };

  const updateBusiness = (updatedBiz) => {
    setBusiness(prev => ({ ...prev, ...updatedBiz }));
  };

  const logout = () => {
    localStorage.removeItem('negocioai_token');
    setToken(null);
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ user, business, token, loading, login, register, updateBusiness, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
