const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Send message
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, encryptedContent } = req.body;

    if (!receiverId || !encryptedContent) {
      return res.status(400).json({ error: 'Missing required fields: receiverId, encryptedContent' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Create message
    const message = new Message({
      sender: req.user._id,
      receiver: receiverId,
      encryptedContent,
      type: 'text'
    });

    await message.save();

    // Populate sender info
    await message.populate('sender', 'username profilePicture');

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get messages between two users
router.get('/chat/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, before } = req.query;

    const query = {
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Mark message as read
router.patch('/:messageId/read', auth, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.messageId,
        receiver: req.user._id
      },
      { isRead: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 