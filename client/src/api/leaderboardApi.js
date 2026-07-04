import { apiRequest } from './http';

const getGlobalLeaderboard = () => {
  return apiRequest('/leaderboard/global', {
    auth: false
  });
};

const getFriendsLeaderboard = () => {
  return apiRequest('/leaderboard/friends');
};

export { getGlobalLeaderboard, getFriendsLeaderboard };