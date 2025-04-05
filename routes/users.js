const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Contact verification states
const pendingVerifications = new Map();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, publicKey } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      publicKey: publicKey || '' // Public key can be updated later
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        publicKey: user.publicKey
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      error: error.message || 'Registration failed',
      details: error.errors ? Object.values(error.errors).map(e => e.message) : undefined
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        publicKey: user.publicKey
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('contacts', 'username email publicKey status lastSeen profilePicture');
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Request to add contact - Step 1
router.post('/contacts/request', auth, async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find the contact
    const contact = await User.findOne({ email })
      .select('_id username email publicKey status lastSeen profilePicture');
    
    if (!contact) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.contacts.includes(contact._id)) {
      return res.status(400).json({ error: 'Contact already added' });
    }

    // Generate a random challenge
    const challenge = crypto.randomBytes(32).toString('base64');
    
    // Store the challenge with both user IDs
    pendingVerifications.set(`${req.user._id}-${contact._id}`, {
      challenge,
      requesterPublicKey: req.user.publicKey,
      timestamp: Date.now()
    });

    // Return the challenge and contact's public key
    res.json({
      contact: {
        id: contact._id,
        username: contact.username,
        email: contact.email,
        publicKey: contact.publicKey
      },
      challenge
    });
  } catch (error) {
    console.error('Contact request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify and add contact - Step 2
router.post('/contacts/verify', auth, async (req, res) => {
  try {
    const { contactId, signedChallenge } = req.body;

    // Get the pending verification
    const verificationKey = `${req.user._id}-${contactId}`;
    const verification = pendingVerifications.get(verificationKey);

    if (!verification) {
      return res.status(400).json({ error: 'No pending verification found' });
    }

    // Check if verification is expired (10 minutes)
    if (Date.now() - verification.timestamp > 10 * 60 * 1000) {
      pendingVerifications.delete(verificationKey);
      return res.status(400).json({ error: 'Verification expired' });
    }

    // Get the contact
    const contact = await User.findById(contactId)
      .select('_id username email publicKey status lastSeen profilePicture');

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Add contact to user's contacts
    if (!req.user.contacts.includes(contact._id)) {
      req.user.contacts.push(contact._id);
      await req.user.save();
    }

    // Clean up
    pendingVerifications.delete(verificationKey);

    res.json({ 
      message: 'Contact verified and added successfully',
      contact
    });
  } catch (error) {
    console.error('Contact verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update public key
router.post('/update-key', auth, async (req, res) => {
  try {
    const { publicKey } = req.body;
    
    if (!publicKey) {
      return res.status(400).json({ error: 'Public key is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id, 
      { publicKey },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Update key error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get single contact data
router.get('/contact/:contactId', auth, async (req, res) => {
  try {
    const contact = await User.findById(req.params.contactId)
      .select('_id username email publicKey status lastSeen profilePicture');
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Ensure the user has permission to view this contact
    if (!req.user.contacts.includes(contact._id)) {
      return res.status(403).json({ error: 'Not authorized to view this contact' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 