import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const GAME_TYPES = ['TCP_CONGESTION'];

const gameSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User id is required.'],
      index: true
    },

    gameType: {
      type: String,
      enum: GAME_TYPES,
      default: 'TCP_CONGESTION',
      index: true
    },

    score: {
      type: Number,
      required: [true, 'Score is required.'],
      index: true
    },

    peakWindowSize: {
      type: Number,
      default: 0,
      min: 0
    },

    timeoutsCount: {
      type: Number,
      default: 0,
      min: 0
    },

    durationInSeconds: {
      type: Number,
      required: [true, 'Duration is required.'],
      min: [0, 'Duration cannot be negative.']
    },

    ratingBefore: {
  type: Number,
  default: null
},

ratingAfter: {
  type: Number,
  default: null,
  index: true
},

ratingDelta: {
  type: Number,
  default: null
},

    playedAt: {
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

gameSessionSchema.index({ userId: 1, playedAt: -1 });
gameSessionSchema.index({ gameType: 1, score: -1 });
gameSessionSchema.index({ userId: 1, gameType: 1, playedAt: -1 });
gameSessionSchema.index({ playedAt: -1, score: -1 });

const GameSession = model('GameSession', gameSessionSchema);

export default GameSession;