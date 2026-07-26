import { apiRequest } from './http';

const getConversations = () => {
  return apiRequest('/messages/conversations');
};

const getDirectHistory = (userId) => {
  return apiRequest(`/messages/direct/${userId}`);
};

export { getConversations, getDirectHistory };