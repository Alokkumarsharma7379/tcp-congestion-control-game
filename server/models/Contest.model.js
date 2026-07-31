import { Schema, model } from 'mongoose';

const participantSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    username: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      default: 0
    },
    packetsAcked: {
      type: Number,
      default: 0
    },
    lossCount: {
      type: Number,
      default: 0
    },
    isReady: {
      type: Boolean,
      default: false
    },
    finalRank: {
      type: Number,
      default: null
    }
  },
  { _id: false }
);

const contestSchema = new Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },

    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    title: {
      type: String,
      required: [true, 'Contest name is required.'],
      trim: true,
      maxlength: 80
    },

    config: {
      duration: {
        type: Number,
        required: true // seconds
      },
      capacity: {
        type: Number,
        required: true // bottleneck bandwidth, pkts/tick
      },
      queueSize: {
        type: Number,
        required: true // max shared buffer
      },
      propagationDelay: {
        type: Number,
        default: 0 // ms, added on top of queueing delay for display purposes
      },
      lossProbability: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
      },
      initialCwnd: {
        type: Number,
        required: true
      },
      ssthresh: {
        type: Number,
        default: 64 // informational reference value shown to players
      },
      maxPlayers: {
        type: Number,
        default: 8,
        min: 2
      }
    },

    status: {
      type: String,
      enum: ['waiting', 'countdown', 'in_progress', 'completed'],
      default: 'waiting'
    },

    participants: [participantSchema],

    startedAt: Date,
    endedAt: Date
  },
  {
    timestamps: true
  }
);

const Contest = model('Contest', contestSchema);

export default Contest;