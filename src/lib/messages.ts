import { Message } from './types';
import { isDevMode, getDevStore } from './storage';
import { hybridSync } from './hybridSync';

// Get storage location
const getStorage = () => {
  if (isDevMode()) {
    const devStore = getDevStore();
    if (!devStore.messages) {
      devStore.messages = [];
    }
    return devStore;
  }
  const win = window as any;
  if (!win.__musicSystemStorage) {
    win.__musicSystemStorage = {};
  }
  if (!win.__musicSystemStorage.messages) {
    win.__musicSystemStorage.messages = [];
  }
  return win.__musicSystemStorage;
};

export const getMessages = (): Message[] => {
  const storage = getStorage();
  return storage.messages || [];
};

export const saveMessages = (messages: Message[]): void => {
  const storage = getStorage();
  storage.messages = messages;
  
  if (!isDevMode()) {
    hybridSync.onDataChange();
  }
};

export const addMessage = (message: Omit<Message, 'id' | 'createdAt'>): Message => {
  const messages = getMessages();
  const now = new Date();
  
  // Auto-star logic:
  let autoStarred: Record<string, boolean> = {};
  
  // 1. If sent to "all", star for all students
  if (message.recipientIds.includes('all')) {
    const { getStudents } = require('./storage');
    const allStudents = getStudents();
    autoStarred = allStudents.reduce((acc: Record<string, boolean>, s: any) => 
      ({ ...acc, [s.id]: true }), {});
  }
  // 2. If from admin, star for all recipients
  else if (message.senderId === 'admin') {
    autoStarred = message.recipientIds
      .filter(id => id !== 'admin')
      .reduce((acc, id) => ({ ...acc, [id]: true }), {});
  }
  
  const newMessage: Message = {
    ...message,
    id: Date.now().toString(),
    createdAt: now.toISOString(),
    starred: autoStarred,
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
    if (!message.starred) {
      message.starred = {};
    }
    message.starred[userId] = !message.starred[userId];
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
    
    // Skip drafts not from this student
    if (message.isDraft && message.senderId !== studentId) {
      return false;
    }
    
    // Include messages sent to all students or specifically to this student
    // OR messages sent by this student
    return message.recipientIds.includes('all') || 
           message.recipientIds.includes(studentId) ||
           message.senderId === studentId;
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
  
  return messages.filter(message => message.starred?.[userId]);
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
