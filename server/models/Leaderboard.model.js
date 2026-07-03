import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const LEADERBOARD_TYPES = ['GLOBAL', 'REGIONAL', 'FRIENDS', 'SCENARIO'];

const leaderboardEntrySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    username: {
      type: String,
      required: true,
      trim: true
    },

    rating: {
      type: Number,
      required: true,
      min: 0
    },

    rank: {
      type: String,
      required: true,
      trim: true
    },

    score: {
      type: Number,
      default: 0
    }
  },
  {
    _id: false
  }
);

const leaderboardSchema = new Schema(
  {
    type: {
      type: String,
      enum: LEADERBOARD_TYPES,
      required: true,
      index: true
    },

    region: {
      type: String,
      trim: true,
      default: null
    },

    gameType: {
      type: String,
      trim: true,
      default: 'TCP_CONGESTION'
    },

    rankings: {
      type: [leaderboardEntrySchema],
      default: []
    },

    lastUpdatedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

leaderboardSchema.index(
  { type: 1, region: 1, gameType: 1 },
  { unique: true }
);

leaderboardSchema.index({ lastUpdatedAt: -1 });

const Leaderboard = model('Leaderboard', leaderboardSchema);

export default Leaderboard;