import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import { loginUser, registerUser } from '../api/authApi';
import { getProfile } from '../api/userApi';

const AuthContext = createContext(null);

const getInitialToken = () => {
  return localStorage.getItem('token');
};

function AuthProvider({ children }) {
  const [token, setToken] = useState(getInitialToken);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(Boolean(getInitialToken()));
  const [authError, setAuthError] = useState('');

  const storeSession = useCallback((payload) => {
    const nextToken = payload?.data?.token;
    const nextUser = payload?.data?.user;

    if (!nextToken || !nextUser) {
      throw new Error('Invalid authentication response.');
    }

    localStorage.setItem('token', nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setProfile(null);
  }, []);

  const register = useCallback(
    async (formData) => {
      setAuthError('');
      const response = await registerUser(formData);
      storeSession(response);
      return response;
    },
    [storeSession]
  );

  const login = useCallback(
    async (credentials) => {
      setAuthError('');
      const response = await loginUser(credentials);
      storeSession(response);
      return response;
    },
    [storeSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setProfile(null);
    setAuthError('');
  }, []);

  const refreshProfile = useCallback(async () => {
    const response = await getProfile();

    setProfile(response.data);
    setUser(response.data.user);

    return response.data;
  }, []);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        const response = await getProfile();

        if (!cancelled) {
          setProfile(response.data);
          setUser(response.data.user);
          setAuthError('');
        }
      } catch (error) {
        if (!cancelled) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          setProfile(null);
          setAuthError(error.message);
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      profile,
      booting,
      authError,
      isAuthenticated: Boolean(token && user),
      register,
      login,
      logout,
      refreshProfile
    }),
    [
      token,
      user,
      profile,
      booting,
      authError,
      register,
      login,
      logout,
      refreshProfile
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
};

export { AuthProvider, useAuth };