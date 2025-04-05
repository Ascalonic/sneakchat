const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Recipient's encrypted data
  recipientData: {
    encryptedContent: {
      type: String,
      required: true
    },
    encryptedKey: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    }
  },
  // Sender's encrypted data
  senderData: {
    encryptedContent: {
      type: String,
      required: true
    },
    encryptedKey: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'voice'],
    default: 'text'
  }
}, {
  timestamps: true,
  _id: false // Disable auto-generation of _id
});

// Index for faster queries
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema); 