import { apiRequest } from './http';

const getProfile = () => {
  return apiRequest('/users/profile');
};

const getPublicProfile = (username) => {
  return apiRequest(`/users/${encodeURIComponent(username)}`);
};

const toggleFriend = (friendId) => {
  return apiRequest(`/users/friends/${friendId}`, {
    method: 'POST'
  });
};

const uploadAvatar = (file) => {
  const formData = new FormData();
  formData.append('avatar', file);

  return apiRequest('/users/avatar', {
    method: 'POST',
    body: formData
  });
};

export { getProfile, getPublicProfile, toggleFriend, uploadAvatar };