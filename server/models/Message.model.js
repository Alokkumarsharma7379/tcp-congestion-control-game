import { Schema, model } from 'mongoose';

const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required.']
    },

    senderName: {
      type: String,
      required: [true, 'Sender name is required.'],
      trim: true
    },

    // null for global messages; the other participant's id for direct ones.
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    chatType: {
      type: String,
      enum: ['global', 'direct'],
      default: 'global',
      required: true
    },

    // 'global' for the public room, or the two participants' ids sorted and
    // joined with an underscore for a direct conversation (e.g.
    // "60f...1_60f...9"). Always computed server-side — never trust a
    // client-supplied room string, since that's how a direct room's
    // membership is implicitly authorized.
    room: {
      type: String,
      default: 'global',
      index: true,
      trim: true
    },

    text: {
      type: String,
      required: [true, 'Message text is required.'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters.']
    },

    isEdited: {
      type: Boolean,
      default: false
    },
    
    // "Delete for everyone" — the message stays in the DB (so this can't be
    // used to silently corrupt history), but every client renders a
    // placeholder instead of the real text once this is true.
    isDeletedForEveryone: {
      type: Boolean,
      default: false
    },

    // "Delete for me" — per-user hide. Anyone in this array never sees the
    // message again, but it still exists for everyone else.
    deletedForUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

messageSchema.index({ room: 1, createdAt: -1 });

const Message = model('Message', messageSchema);

export default Message;