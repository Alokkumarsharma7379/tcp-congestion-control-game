const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const getStoredToken = () => {
  return localStorage.getItem('token');
};

const buildHeaders = (headers = {}, auth = true) => {
  const token = getStoredToken();

  return {
    'Content-Type': 'application/json',
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  };
};

const apiRequest = async (path, options = {}) => {
  const {
    method = 'GET',
    body,
    headers,
    auth = true
  } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: buildHeaders(headers, auth),
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error?.message ||
      'Request failed.';

    throw new Error(message);
  }

  return payload;
};

export { apiRequest };