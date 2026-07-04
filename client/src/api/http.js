const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getStoredToken = () => {
  return localStorage.getItem('token');
};

const isFormDataBody = (body) => {
  return typeof FormData !== 'undefined' && body instanceof FormData;
};

const buildHeaders = ({ headers = {}, auth = true, isFormData = false }) => {
  const token = getStoredToken();

  return {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
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

  const isFormData = isFormDataBody(body);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: buildHeaders({ headers, auth, isFormData }),
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
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