const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

// Import routes
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
    },
  },
}));

// Serve static files from docs directory
app.use(express.static(path.join(__dirname, 'docs')));

// CORS configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parser middleware
app.use(express.json());

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-messenger', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error:', err));

// Store active users
const activeUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.userId);
  activeUsers.set(socket.userId, socket.id);

  // Join user's own room for private messages
  socket.join(socket.userId);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`User ${socket.userId} joined room: ${room}`);
  });

  socket.on('message', async (data) => {
    try {
      // Validate required fields
      if (!data._id || !data.recipientData || !data.senderData || !data.room) {
        console.error('Invalid message format:', data);
        return;
      }

      // Emit to the room (both sender and receiver will receive)
      io.to(data.room).emit('message', {
        _id: data._id,
        sender: socket.userId,
        receiver: data.receiverId,
        encryptedContent: data.recipientData.encryptedContent,
        encryptedKey: data.recipientData.encryptedKey,
        iv: data.recipientData.iv,
        createdAt: new Date(),
        isRead: false
      });

      // Save message to database
      try {
        const Message = require('./models/Message');
        await Message.create({
          _id: data._id,
          sender: socket.userId,
          receiver: data.receiverId,
          recipientData: {
            encryptedContent: data.recipientData.encryptedContent,
            encryptedKey: data.recipientData.encryptedKey,
            iv: data.recipientData.iv
          },
          senderData: {
            encryptedContent: data.senderData.encryptedContent,
            encryptedKey: data.senderData.encryptedKey,
            iv: data.senderData.iv
          },
          isRead: false
        });
      } catch (dbError) {
        console.error('Failed to save message to database:', dbError);
      }
    } catch (error) {
      console.error('Socket message error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.userId);
    activeUsers.delete(socket.userId);
  });
});

// Update the root route to serve the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 