import { SwapRequest } from './types';
import { getLessons, updateLesson } from '../storage';
import { hybridSync } from '../hybridSync';
import { logger } from '../logger';

// In-memory storage (similar to storage.ts pattern)
let swapRequests: SwapRequest[] = [];
let devModeActive = false;

export const setDevMode = (isActive: boolean) => {
  devModeActive = isActive;
};

export const initializeSwapRequests = (data: SwapRequest[]) => {
  swapRequests = data || [];
  logger.info(`✅ Swap requests initialized: ${swapRequests.length} requests`);
};

export const getSwapRequests = (): SwapRequest[] => {
  return swapRequests;
};

export const addSwapRequest = (req: Omit<SwapRequest, 'id' | 'createdAt'>): SwapRequest => {
  const newRequest: SwapRequest = {
    ...req,
    id: Date.now().toString(36) + Math.random().toString(36).substring(2),
    createdAt: new Date().toISOString(),
  };
  
  swapRequests.push(newRequest);
  
  if (!devModeActive) {
    hybridSync.onDataChange();
  }
  
  logger.info(`✅ Swap request created: ${newRequest.id}`);
  return newRequest;
};

export const updateSwapRequest = (id: string, patch: Partial<SwapRequest>): SwapRequest | null => {
  const index = swapRequests.findIndex(r => r.id === id);
  if (index === -1) {
    logger.error(`❌ Swap request not found: ${id}`);
    return null;
  }
  
  swapRequests[index] = {
    ...swapRequests[index],
    ...patch,
  };
  
  if (!devModeActive) {
    hybridSync.onDataChange();
  }
  
  logger.info(`✅ Swap request updated: ${id}`);
  return swapRequests[index];
};

export const markLessonsAsSwapped = (req: SwapRequest): void => {
  const lessons = getLessons();
  
  const requesterLesson = lessons.find(l => l.id === req.requesterLessonId);
  const targetLesson = lessons.find(l => l.id === req.targetLessonId);
  
  if (!requesterLesson || !targetLesson) {
    logger.error('❌ Cannot mark lessons as swapped - lessons not found');
    return;
  }
  
  // Swap the studentIds and mark as swapped
  updateLesson(req.requesterLessonId, {
    studentId: req.targetStudentId,
    isSwapped: true,
    notes: requesterLesson.notes 
      ? `${requesterLesson.notes} | הוחלף (${new Date().toLocaleDateString('he-IL')})` 
      : `הוחלף (${new Date().toLocaleDateString('he-IL')})`,
  });
  
  updateLesson(req.targetLessonId, {
    studentId: req.requesterStudentId,
    isSwapped: true,
    notes: targetLesson.notes 
      ? `${targetLesson.notes} | הוחלף (${new Date().toLocaleDateString('he-IL')})` 
      : `הוחלף (${new Date().toLocaleDateString('he-IL')})`,
  });
  
  logger.info(`✅ Lessons swapped: ${req.requesterLessonId} ↔ ${req.targetLessonId}`);
};

export const exportSwapRequests = (): SwapRequest[] => {
  return swapRequests;
};
