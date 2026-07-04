import { apiRequest } from './http';

const getProfile = () => {
  return apiRequest('/users/profile');
};

const addFriend = (friendId) => {
  return apiRequest('/users/friends/add', {
    method: 'POST',
    body: { friendId }
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

export { getProfile, addFriend, uploadAvatar };