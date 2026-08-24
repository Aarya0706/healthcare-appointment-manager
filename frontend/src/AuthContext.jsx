import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem('ham_auth');
    return raw ? JSON.parse(raw) : null;
  });

  function login(payload) {
    localStorage.setItem('ham_auth', JSON.stringify(payload));
    setAuth(payload);
  }

  function logout() {
    localStorage.removeItem('ham_auth');
    setAuth(null);
  }

  return <AuthContext.Provider value={{ auth, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
