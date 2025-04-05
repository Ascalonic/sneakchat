import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  TextField,
  IconButton,
  Divider,
  Badge,
  styled,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';
import { CryptoUtil } from '../utils/crypto';

interface Contact {
  _id: string;
  username: string;
  email: string;
  profilePicture: string;
  status: string;
  lastSeen: Date;
  publicKey: string;
  verified?: boolean;
}

interface Message {
  _id: string;
  sender: string;
  content: string;
  encryptedContent: string;
  encryptedKey: string;
  iv: string;
  createdAt: Date;
  isRead: boolean;
}

interface ExtendedUser {
  id: string;
  username: string;
  email: string;
  profilePicture?: string;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  borderRight: `1px solid ${theme.palette.divider}`,
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.Mui-selected': {
    backgroundColor: theme.palette.action.selected,
  },
}));

const Chat: React.FC = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [keys, setKeys] = useState<{ messageKeys: CryptoKeyPair; verificationKeys: CryptoKeyPair } | null>(null);
  const [addContactEmail, setAddContactEmail] = useState('');
  const [verifyingContact, setVerifyingContact] = useState<{
    contact: Contact;
    challenge: string;
  } | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const initializingRef = useRef<boolean>(false);
  const keyInitIdRef = useRef<string | null>(null);
  
  // New state for Add Contact dialog
  const [openAddContact, setOpenAddContact] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    const initializeKeys = async () => {
      if (!user?.id) return;

      // Check if we already have valid keys in memory
      if (keys?.messageKeys.publicKey && keys?.messageKeys.privateKey) {
        console.log('Valid keys already in memory');
        return;
      }

      try {
        // Try to get existing keys from storage first
        const storedKeys = await CryptoUtil.getStoredKeys(user.id);
        if (storedKeys) {
          console.log('Using existing keys from storage');
          setKeys(storedKeys);
          return;
        }

        console.log('Generating new keys for user:', user.id);
        const userKeys = await CryptoUtil.generateKeyPair();
        
        // Export and upload public key
        const exportedKeys = await CryptoUtil.exportKeys(userKeys);
        console.log('Uploading public key to server:', {
          keyLength: exportedKeys.publicKey.length
        });
        
        await axios.post('http://localhost:5000/api/users/update-key', 
          { publicKey: exportedKeys.publicKey },
          { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}
        );

        // Store keys only after successful upload
        await CryptoUtil.storeKeys(user.id, userKeys);
        setKeys(userKeys);
        console.log('Key initialization complete');

      } catch (error) {
        console.error('Error initializing keys:', error);
        localStorage.removeItem(`${CryptoUtil.KEY_STORAGE_PREFIX}${user.id}`);
        setSnackbar({
          open: true,
          message: 'Failed to initialize encryption keys. Please refresh the page.',
          severity: 'error'
        });
      }
    };

    initializeKeys();
  }, [user?.id, keys]); // Only re-run if user ID changes or keys are null

  useEffect(() => {
    // Connect to Socket.IO server
    const newSocket = io('http://localhost:5000', {
      auth: {
        token: localStorage.getItem('token')
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setSocket(newSocket);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setSnackbar({
        open: true,
        message: 'Connection error. Retrying...',
        severity: 'error'
      });
    });

    // Fetch contacts
    fetchContacts();

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket || !keys?.messageKeys.privateKey) {
      console.log('Socket or keys not ready:', {
        hasSocket: !!socket,
        hasKeys: !!keys,
        hasPrivateKey: !!keys?.messageKeys.privateKey
      });
      return;
    }

    console.log('Setting up message listener with socket:', socket.id);

    const handleIncomingMessage = async (message: Message & { encryptedKey: string; iv: string }) => {
      try {
        console.log('Received message:', {
          messageId: message._id,
          sender: message.sender,
          hasEncryptedContent: !!message.encryptedContent,
          hasEncryptedKey: !!message.encryptedKey,
          hasIV: !!message.iv,
          contentLength: message.encryptedContent?.length,
          keyLength: message.encryptedKey?.length,
          ivLength: message.iv?.length,
          isOwnMessage: message.sender === user?.id
        });

        // Skip decryption for own messages as we already have the content
        if (message.sender === user?.id) {
          return;
        }

        if (!message.encryptedContent || !message.encryptedKey || !message.iv) {
          console.error('Missing encryption data:', message);
          message.content = '[Invalid Message Format]';
        } else {
          try {
            // Ensure we have valid keys before attempting decryption
            if (!keys?.messageKeys.privateKey) {
              throw new Error('Private key not available');
            }

            const decryptedContent = await CryptoUtil.decryptMessage(
              {
                encryptedContent: message.encryptedContent,
                encryptedKey: message.encryptedKey,
                iv: message.iv
              },
              keys.messageKeys.privateKey
            );

            message.content = decryptedContent;
            console.log('Message decrypted successfully:', {
              messageId: message._id,
              contentLength: decryptedContent.length
            });

            // Update messages state with decrypted content
            setMessages(prevMessages => {
              const messageExists = prevMessages.some(m => m._id === message._id);
              if (messageExists) {
                return prevMessages.map(m => 
                  m._id === message._id ? { ...m, content: decryptedContent } : m
                );
              } else {
                return [...prevMessages, { ...message, content: decryptedContent }];
              }
            });
          } catch (error) {
            console.error('Decryption error:', error);
            message.content = '[Decryption Failed]';
            
            // Remove keys from storage if they seem to be invalid
            if (error instanceof Error && error.message.includes('AES key decryption failed')) {
              console.log('Removing potentially corrupted keys from storage');
              localStorage.removeItem(`${CryptoUtil.KEY_STORAGE_PREFIX}${user?.id}`);
              setKeys(null);
            }
          }
        }
      } catch (error) {
        console.error('Message handling error:', error);
      }
    };

    socket.on('message', handleIncomingMessage);

    return () => {
      console.log('Removing message listener');
      socket.off('message', handleIncomingMessage);
    };
  }, [socket, keys, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchContacts = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setContacts(response.data.contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchMessages = async (contactId: string) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/messages/chat/${contactId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Decrypt messages
      const decryptedMessages = await Promise.all(
        response.data.map(async (message: Message & { encryptedKey: string; iv: string }) => {
          try {
            if (!keys?.messageKeys.privateKey) {
              console.error('No private key available for decryption');
              return { ...message, content: '[Encrypted Message]' };
            }

            // Use the appropriate encrypted data based on whether we sent or received the message
            const encryptedData = {
              encryptedContent: message.encryptedContent,
              encryptedKey: message.encryptedKey,
              iv: message.iv
            };

            const decryptedContent = await CryptoUtil.decryptMessage(
              encryptedData,
              keys.messageKeys.privateKey
            );

            return { ...message, content: decryptedContent };
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            return { ...message, content: '[Decryption Failed]' };
          }
        })
      );

      setMessages(decryptedMessages);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load messages. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleContactSelect = async (contact: Contact) => {
    try {
      // Fetch fresh contact data to ensure we have the latest public key
      const response = await axios.get(`http://localhost:5000/api/users/contact/${contact._id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const updatedContact = response.data;
      
      console.log('Selected contact:', {
        contactId: updatedContact._id,
        hasPublicKey: !!updatedContact.publicKey,
        publicKeyLength: updatedContact.publicKey?.length
      });

      if (!updatedContact.publicKey) {
        console.error('Contact has no public key');
        setSnackbar({
          open: true,
          message: 'Cannot chat with this contact: Missing encryption key',
          severity: 'error'
        });
        return;
      }

      // Update contacts list with fresh data
      setContacts(prev => prev.map(c => 
        c._id === updatedContact._id ? updatedContact : c
      ));

      setSelectedContact(updatedContact);
      await fetchMessages(updatedContact._id);
      
      if (socket) {
        const room = [user?.id, updatedContact._id].sort().join('-');
        socket.emit('join', room);
      }
    } catch (error) {
      console.error('Error selecting contact:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load chat. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleSendMessage = async () => {
    if (!selectedContact || !newMessage.trim() || !socket || !user || !keys) {
      console.error('Cannot send message:', {
        hasSelectedContact: !!selectedContact,
        hasMessage: !!newMessage.trim(),
        hasSocket: !!socket,
        hasUser: !!user,
        hasKeys: !!keys
      });
      return;
    }

    try {
      if (!selectedContact.publicKey) {
        console.error('Contact has no public key');
        throw new Error('Contact has no public key');
      }

      console.log('Sending message:', {
        contactId: selectedContact._id,
        publicKeyLength: selectedContact.publicKey.length,
        messageLength: newMessage.length,
        hasKeys: !!keys
      });

      // Encrypt message for recipient
      const recipientEncrypted = await CryptoUtil.encryptMessage(
        newMessage,
        selectedContact.publicKey
      );

      // Encrypt message for ourselves using our public key
      const exportedKeys = await CryptoUtil.exportKeys(keys);
      const senderEncrypted = await CryptoUtil.encryptMessage(
        newMessage,
        exportedKeys.publicKey
      );

      // Generate a unique message ID
      const messageId = crypto.randomUUID();
      const room = [user.id, selectedContact._id].sort().join('-');

      console.log('Emitting message:', {
        messageId,
        room,
        recipientContentLength: recipientEncrypted.encryptedContent.length,
        senderContentLength: senderEncrypted.encryptedContent.length
      });

      const messageData = {
        _id: messageId,
        receiverId: selectedContact._id,
        senderId: user.id,
        recipientData: recipientEncrypted,
        senderData: senderEncrypted,
        room
      };

      socket.emit('message', messageData);

      // Add message to local state with our encrypted version
      setMessages(prev => [...prev, {
        _id: messageId,
        sender: user.id,
        receiver: selectedContact._id,
        content: newMessage, // Store encrypted content
        encryptedContent: senderEncrypted.encryptedContent,
        encryptedKey: senderEncrypted.encryptedKey,
        iv: senderEncrypted.iv,
        createdAt: new Date(),
        isRead: false
      }]);

      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      setSnackbar({
        open: true,
        message: 'Failed to send message. Please try again.',
        severity: 'error'
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAddContact = async () => {
    try {
      // Step 1: Request contact addition
      const response = await axios.post(
        'http://localhost:5000/api/users/contacts/request',
        { email: addContactEmail },
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}
      );

      const { contact, challenge } = response.data;
      setVerifyingContact({ contact, challenge });

      // Step 2: Sign the challenge
      if (!keys) {
        throw new Error('No keys available');
      }

      const signature = await CryptoUtil.signChallenge(
        challenge,
        keys.verificationKeys.privateKey
      );

      // Step 3: Verify and add contact
      const verifyResponse = await axios.post(
        'http://localhost:5000/api/users/contacts/verify',
        {
          contactId: contact._id,
          signedChallenge: signature
        },
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}
      );

      // Add contact to local state
      setContacts(prev => [...prev, verifyResponse.data.contact]);
      setAddContactEmail('');
      setVerifyingContact(null);
      
      setSnackbar({
        open: true,
        message: 'Contact added successfully',
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Error adding contact:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to add contact',
        severity: 'error'
      });
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      <Box sx={{ display: 'flex', width: '100%' }}>
        {/* Contacts List */}
        <Box sx={{ width: '25%' }}>
          <StyledPaper>
            <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar />
                  <Typography variant="h6" sx={{ ml: 2 }}>
                    Chats
                  </Typography>
                </Box>
                <IconButton onClick={() => setOpenAddContact(true)}>
                  <PersonAddIcon />
                </IconButton>
              </Box>
              <TextField
                fullWidth
                placeholder="Search contacts"
                InputProps={{
                  startAdornment: <SearchIcon />,
                }}
              />
            </Box>
            <Divider />
            <List sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
              {contacts.map((contact) => (
                <StyledListItem
                  key={contact._id}
                  onClick={() => handleContactSelect(contact)}
                  className={selectedContact?._id === contact._id ? 'Mui-selected' : ''}
                >
                  <ListItemAvatar>
                    <Badge
                      color={contact.status === 'online' ? 'success' : 'error'}
                      variant="dot"
                      anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                      }}
                    >
                      <Avatar src={contact.profilePicture} />
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={contact.username}
                    secondary={contact.status}
                  />
                </StyledListItem>
              ))}
            </List>
          </StyledPaper>
        </Box>

        {/* Chat Area */}
        <Box sx={{ width: '75%' }}>
          <StyledPaper>
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <Box sx={{ p: 2, bgcolor: 'background.paper', display: 'flex', alignItems: 'center' }}>
                  <Avatar src={selectedContact.profilePicture} />
                  <Box sx={{ ml: 2, flex: 1 }}>
                    <Typography variant="h6">{selectedContact.username}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedContact.status}
                    </Typography>
                  </Box>
                  <IconButton>
                    <SearchIcon />
                  </IconButton>
                  <IconButton>
                    <MoreVertIcon />
                  </IconButton>
                </Box>
                <Divider />

                {/* Messages */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#0a1014' }}>
                  {messages.map((message) => (
                    <Box
                      key={message._id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.sender === user?.id ? 'flex-end' : 'flex-start',
                        mb: 2,
                      }}
                    >
                      <Paper
                        sx={{
                          p: 2,
                          bgcolor: message.sender === user?.id ? '#005c4b' : '#202c33',
                          maxWidth: '70%',
                        }}
                      >
                        <Typography>{message.content}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </Typography>
                      </Paper>
                    </Box>
                  ))}
                  <div ref={messagesEndRef} />
                </Box>

                {/* Message Input */}
                <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton>
                      <AttachFileIcon />
                    </IconButton>
                    <Box sx={{ flex: 1 }}>
                      <TextField
                        fullWidth
                        placeholder="Type a message"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSendMessage();
                          }
                        }}
                      />
                    </Box>
                    <IconButton onClick={handleSendMessage} color="primary">
                      <SendIcon />
                    </IconButton>
                  </Box>
                </Box>
              </>
            ) : (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" color="textSecondary">
                  Select a contact to start chatting
                </Typography>
              </Box>
            )}
          </StyledPaper>
        </Box>
      </Box>

      {/* Add Contact Dialog */}
      <Dialog open={!!addContactEmail} onClose={() => setAddContactEmail('')}>
        <DialogTitle>Add New Contact</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Contact Email"
            type="email"
            fullWidth
            variant="outlined"
            value={addContactEmail}
            onChange={(e) => setAddContactEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddContactEmail('')}>Cancel</Button>
          <Button onClick={handleAddContact} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      {/* Verification Dialog */}
      <Dialog open={!!verifyingContact} onClose={() => setVerifyingContact(null)}>
        <DialogTitle>Verifying Contact</DialogTitle>
        <DialogContent>
          <Typography>
            Verifying contact details for {verifyingContact?.contact.email}...
          </Typography>
          <CircularProgress sx={{ mt: 2 }} />
        </DialogContent>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Chat; 