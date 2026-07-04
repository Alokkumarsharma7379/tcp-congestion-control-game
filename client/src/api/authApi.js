import { apiRequest } from './http';

const registerUser = (formData) => {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: formData,
    auth: false
  });
};

const loginUser = (credentials) => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
    auth: false
  });
};

export { registerUser, loginUser };