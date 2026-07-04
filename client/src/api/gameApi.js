import { apiRequest } from './http';

const submitGameSession = (session) => {
  return apiRequest('/game/submit', {
    method: 'POST',
    body: session
  });
};

const getGameHistory = ({ page = 1, limit = 20 } = {}) => {
  return apiRequest(`/game/history?page=${page}&limit=${limit}`);
};

export { submitGameSession, getGameHistory };