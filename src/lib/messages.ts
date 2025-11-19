import { Message } from './types';

const MESSAGES_KEY = 'music_students_messages';

export const getMessages = (): Message[] => {
  try {
    const data = localStorage.getItem(MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading messages:', error);
    return [];
  }
};

export const saveMessages = (messages: Message[]): void => {
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving messages:', error);
  }
};

export const addMessage = (message: Omit<Message, 'id' | 'createdAt'>): Message => {
  const messages = getMessages();
  const now = new Date();
  const newMessage: Message = {
    ...message,
    id: Date.now().toString(),
    createdAt: now.toISOString(),
    // Teacher messages are starred by default for students
    // Student messages to 'all' are starred by default for all recipients
    isStarred: message.senderId === 'admin' && !message.recipientIds.includes('admin')
      ? message.recipientIds.reduce((acc, id) => ({ ...acc, [id]: true }), {})
      : message.senderId !== 'admin' && message.recipientIds.includes('all')
      ? { ...message.recipientIds.reduce((acc, id) => id !== 'admin' ? { ...acc, [id]: true } : acc, {}) }
      : {},
    // Student messages to 'all' expire after 48 hours
    expiresAt: message.senderId !== 'admin' && message.recipientIds.includes('all')
      ? new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
      : message.expiresAt,
  };
  messages.push(newMessage);
  saveMessages(messages);
  return newMessage;
};

export const deleteMessage = (messageId: string): void => {
  const messages = getMessages();
  const updatedMessages = messages.filter(m => m.id !== messageId);
  saveMessages(updatedMessages);
};

export const markMessageAsRead = (messageId: string, userId: string, isRead: boolean = true): void => {
  const messages = getMessages();
  const message = messages.find(m => m.id === messageId);
  if (message) {
    if (!message.isRead) {
      message.isRead = {};
    }
    message.isRead[userId] = isRead;
    saveMessages(messages);
  }
};

export const toggleMessageStar = (messageId: string, userId: string): void => {
  const messages = getMessages();
  const message = messages.find(m => m.id === messageId);
  if (message) {
    if (!message.isStarred) {
      message.isStarred = {};
    }
    message.isStarred[userId] = !message.isStarred[userId];
    saveMessages(messages);
  }
};

export const markMessageAsDeleted = (messageId: string, userId: string, isDeleted: boolean = true): void => {
  const messages = getMessages();
  const message = messages.find(m => m.id === messageId);
  if (message) {
    if (!message.isDeleted) {
      message.isDeleted = {};
    }
    message.isDeleted[userId] = isDeleted;
    saveMessages(messages);
  }
};

export const updateMessage = (messageId: string, updates: Partial<Message>): void => {
  const messages = getMessages();
  const index = messages.findIndex(m => m.id === messageId);
  if (index !== -1) {
    messages[index] = { ...messages[index], ...updates };
    saveMessages(messages);
  }
};

export const getMessagesForStudent = (studentId: string, includeDeleted: boolean = false): Message[] => {
  const messages = getMessages();
  const now = new Date();
  
  return messages.filter(message => {
    // Check if message is deleted by this user
    if (!includeDeleted && message.isDeleted?.[studentId]) {
      return false;
    }
    
    // Check if message has expired
    if (message.expiresAt && new Date(message.expiresAt) < now) {
      return false;
    }
    
    // Check if scheduled for future
    if (message.scheduledFor && new Date(message.scheduledFor) > now) {
      return false;
    }
    
    // Skip drafts
    if (message.isDraft) {
      return false;
    }
    
    // Include messages sent to all students or specifically to this student
    return message.recipientIds.includes('all') || 
           message.recipientIds.includes(studentId);
  });
};

export const getMessagesForAdmin = (includeDeleted: boolean = false): Message[] => {
  const messages = getMessages();
  const now = new Date();
  
  return messages.filter(message => {
    // Check if message is deleted by admin
    if (!includeDeleted && message.isDeleted?.['admin']) {
      return false;
    }
    
    // Check if message has expired
    if (message.expiresAt && new Date(message.expiresAt) < now) {
      return false;
    }
    
    // Check if scheduled for future
    if (message.scheduledFor && new Date(message.scheduledFor) > now) {
      return false;
    }
    
    // Skip drafts not from admin
    if (message.isDraft && message.senderId !== 'admin') {
      return false;
    }
    
    // Include messages sent to admin
    return message.recipientIds.includes('admin');
  });
};

export const getStarredMessages = (userId: string): Message[] => {
  const messages = userId === 'admin' 
    ? getMessagesForAdmin() 
    : getMessagesForStudent(userId);
  
  return messages.filter(message => message.isStarred?.[userId]);
};

export const getDrafts = (userId: string): Message[] => {
  const messages = getMessages();
  return messages.filter(message => 
    message.isDraft && message.senderId === userId
  );
};

export const getDeletedMessages = (userId: string): Message[] => {
  const messages = userId === 'admin' 
    ? getMessagesForAdmin(true) 
    : getMessagesForStudent(userId, true);
  
  return messages.filter(message => message.isDeleted?.[userId]);
};

export const getUnreadCount = (userId: string): number => {
  const messages = userId === 'admin' 
    ? getMessagesForAdmin() 
    : getMessagesForStudent(userId);
  
  return messages.filter(message => !message.isRead?.[userId]).length;
};
