import GameSession from '../models/GameSession.model.js';

const DEFAULT_HISTORY_LIMIT = 100;

const getRatingHistory = async (userId, { limit = DEFAULT_HISTORY_LIMIT } = {}) => {
  const sessions = await GameSession.find({
    userId,
    ratingAfter: { $ne: null }
  })
    .sort({ playedAt: -1 })
    .limit(limit)
    .select('playedAt ratingAfter gameType')
    .lean();

  return sessions
    .reverse()
    .map((session) => ({
      date: session.playedAt,
      rating: session.ratingAfter,
      gameType: session.gameType
    }));
};

export { getRatingHistory };