// client/src/api/contestApi.js
import { apiRequest } from './http';

const createContest = (payload) => {
  return apiRequest('/contests', { method: 'POST', body: payload });
};

const getContest = (roomCode) => {
  return apiRequest(`/contests/${roomCode}`);
};

const getContestResults = (roomCode) => {
  return apiRequest(`/contests/${roomCode}/results`);
};

export { createContest, getContest, getContestResults };