# Secure Messenger

A modern, end-to-end encrypted messaging application with a WhatsApp-like interface but enhanced security features.

## Features

- End-to-end encryption using RSA and AES-256-GCM
- Real-time messaging with Socket.IO
- User authentication and authorization
- Contact management
- Message status (read/unread)
- Support for text, image, file, and voice messages
- Modern and responsive UI
- Secure key exchange

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/secure-messenger.git
cd secure-messenger
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/secure-messenger
JWT_SECRET=your-super-secret-jwt-key
CLIENT_URL=http://localhost:3000
```

4. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- POST /api/users/register - Register a new user
- POST /api/users/login - Login user
- GET /api/users/profile - Get user profile

### Messages
- POST /api/messages/send - Send a message
- GET /api/messages/chat/:userId - Get chat history
- PATCH /api/messages/:messageId/read - Mark message as read

### Contacts
- POST /api/users/contacts - Add a contact

## Security Features

- End-to-end encryption using RSA and AES-256-GCM
- Secure key exchange
- Password hashing with bcrypt
- JWT-based authentication
- Rate limiting
- Helmet security headers
- CORS protection

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 