import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const RANKS = [
  { min: 2400, label: 'Grandmaster' },
  { min: 2200, label: 'International Master' },
  { min: 1900, label: 'Master' },
  { min: 1600, label: 'Expert' },
  { min: 1400, label: 'Specialist' },
  { min: 1200, label: 'Pupil' },
  { min: 0, label: 'Newbie' }
];

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required.'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long.'],
      maxlength: [30, 'Username cannot exceed 30 characters.'],
      match: [
        /^[a-zA-Z0-9_]+$/,
        'Username may contain only letters, numbers, and underscores.'
      ]
    },

    fullName: {
      type: String,
      trim: true,
      maxlength: [80, 'Full name cannot exceed 80 characters.'],
      default: ''
    },

    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [120, 'Email cannot exceed 120 characters.'],
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.']
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required.'],
      select: false
    },

    country: {
      type: String,
      trim: true,
      maxlength: [80, 'Country cannot exceed 80 characters.'],
      default: ''
    },

    avatarUrl: {
      type: String,
      trim: true,
      default: ''
    },

    contribution: {
      type: Number,
      default: 0
    },

    rating: {
      type: Number,
      default: 1200,
      min: [0, 'Rating cannot be negative.'],
      index: true
    },

    friends: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],

    currentStreak: {
      type: Number,
      default: 0,
      min: 0
    },

    maxYearlyStreak: {
      type: Number,
      default: 0,
      min: 0
    },

    totalStreak: {
      type: Number,
      default: 0,
      min: 0
    },

    lastPlayedDate: {
      type: Date,
      default: null
    },

    gamesPlayedThisMonth: {
      type: Number,
      default: 0,
      min: 0
    },

    lastVisit: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(doc, ret) {
        delete ret.passwordHash;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      versionKey: false
    }
  }
);

userSchema.virtual('rank').get(function getRank() {
  return RANKS.find((tier) => this.rating >= tier.min)?.label || 'Newbie';
});

// userSchema.index({ username: 1 }, { unique: true });
// userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ rating: -1, username: 1 });
userSchema.index({ lastVisit: -1 });
userSchema.index({ friends: 1 });

const User = model('User', userSchema);

export default User;