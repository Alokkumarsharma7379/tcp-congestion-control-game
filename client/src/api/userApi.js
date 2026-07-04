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

export { getProfile, addFriend };