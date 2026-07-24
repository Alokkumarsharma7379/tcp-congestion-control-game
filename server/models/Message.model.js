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

    text: {
      type: String,
      required: [true, 'Message text is required.'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters.']
    },

    room: {
      type: String,
      default: 'global',
      index: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

messageSchema.index({ room: 1, createdAt: -1 });

const Message = model('Message', messageSchema);

export default Message;