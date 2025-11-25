import { Message } from './types';
import { isDevMode, getDevStore, getStudents } from './storage';
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

export const getMessageType = (message: Message): 'broadcast' | 'group' | 'direct-teacher' | 'direct-student' => {
  if (message.recipientIds.includes('all')) return 'broadcast';
  if (message.recipientIds.length > 1) return 'group';
  if (message.recipientIds[0] === 'admin') return 'direct-teacher';
  return 'direct-student';
};

export const canUserRemoveStar = (message: Message, userId: string): boolean => {
  // Admin can remove star from any message
  if (userId === 'admin') return true;
  
  // Sender can remove star from their own messages
  if (message.senderId === userId) return true;
  
  // Broadcast from admin - student cannot remove
  if (message.senderId === 'admin' && message.recipientIds.includes('all')) return false;
  
  // All other cases - allowed
  return true;
};

export const addMessage = (message: Omit<Message, 'id' | 'createdAt'>): Message => {
  const messages = getMessages();
  const now = new Date();
  
  // Auto-star logic:
  let autoStarred: Record<string, boolean> = {};
  let starExpiresAt: Record<string, string> = {};
  
  // 1. If sent to "all", star for all students
  if (message.recipientIds.includes('all')) {
    const allStudents = getStudents();
    autoStarred = allStudents.reduce((acc: Record<string, boolean>, s: any) => 
      ({ ...acc, [s.id]: true }), {});
    
    // If from admin, set star expiration to 48 hours
    if (message.senderId === 'admin') {
      const expiryTime = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
      starExpiresAt = allStudents.reduce((acc: Record<string, string>, s: any) => 
        ({ ...acc, [s.id]: expiryTime }), {});
    }
  }
  // 2. If from admin, star for all recipients
  else if (message.senderId === 'admin') {
    autoStarred = message.recipientIds
      .filter(id => id !== 'admin')
      .reduce((acc, id) => ({ ...acc, [id]: true }), {});
  }
  
  const messageType = getMessageType({ ...message, id: '', createdAt: '' } as Message);
  
  const newMessage: Message = {
    ...message,
    id: Date.now().toString(),
    createdAt: now.toISOString(),
    starred: autoStarred,
    starExpiresAt: Object.keys(starExpiresAt).length > 0 ? starExpiresAt : undefined,
    messageType,
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

export const markMessageAsUnread = (messageId: string, userId: string): void => {
  markMessageAsRead(messageId, userId, false);
};

export const saveDraft = (draft: Omit<Message, 'id' | 'createdAt'>): Message => {
  return addMessage({ ...draft, isDraft: true });
};

export const toggleMessageStar = (messageId: string, userId: string): boolean => {
  const messages = getMessages();
  const message = messages.find(m => m.id === messageId);
  if (!message) return false;
  
  if (!message.starred) {
    message.starred = {};
  }
  
  // Check if currently starred
  const isCurrentlyStarred = message.starred[userId];
  
  // If trying to remove star, check permissions
  if (isCurrentlyStarred && !canUserRemoveStar(message, userId)) {
    return false; // Cannot remove star
  }
  
  // Toggle star
  message.starred[userId] = !message.starred[userId];
  
  // If starring, set expiration if it's an admin broadcast
  if (message.starred[userId] && message.senderId === 'admin' && message.recipientIds.includes('all')) {
    if (!message.starExpiresAt) {
      message.starExpiresAt = {};
    }
    if (!message.starExpiresAt[userId]) {
      const now = new Date();
      message.starExpiresAt[userId] = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    }
  }
  
  saveMessages(messages);
  return true;
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
  
  const now = new Date();
  
  return messages.filter(message => {
    if (!message.starred?.[userId]) return false;
    
    // Check if star has expired
    const expiresAt = message.starExpiresAt?.[userId];
    if (expiresAt && new Date(expiresAt) < now) {
      // Remove expired star
      message.starred[userId] = false;
      saveMessages(getMessages());
      return false;
    }
    
    return true;
  });
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
