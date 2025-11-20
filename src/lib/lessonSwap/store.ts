// Storage functions for Swap Requests
import { SwapRequest } from './types';
import { Student, Lesson } from '@/lib/types';
import { 
  isDevMode, 
  getDevStore,
  exportAllData as baseExportAllData 
} from '@/lib/storage';
import { hybridSync } from '@/lib/hybridSync';
import { logger } from '@/lib/logger';

// Access in-memory storage
const inMemoryStorage: Record<string, any> = (() => {
  // Create a shared reference to the same storage used in storage.ts
  const storage: Record<string, any> = {};
  return storage;
})();

// Helper to access the correct storage location
const getStorage = () => {
  if (isDevMode()) {
    const devStore = getDevStore();
    if (!devStore.swapRequests) {
      devStore.swapRequests = [];
    }
    return devStore;
  }
  // Access the same inMemoryStorage from storage.ts via window
  const win = window as any;
  if (!win.__musicSystemStorage) {
    win.__musicSystemStorage = {};
  }
  if (!win.__musicSystemStorage.swapRequests) {
    win.__musicSystemStorage.swapRequests = [];
  }
  return win.__musicSystemStorage;
};

// Get all swap requests
export function getSwapRequests(): SwapRequest[] {
  const storage = getStorage();
  return storage.swapRequests || [];
}

// Add a new swap request
export function addSwapRequest(req: Omit<SwapRequest, 'id'>): SwapRequest {
  const requests = getSwapRequests();
  const newRequest: SwapRequest = {
    ...req,
    id: Date.now().toString(36) + Math.random().toString(36).substring(2),
  };
  
  requests.push(newRequest);
  const storage = getStorage();
  storage.swapRequests = requests;
  
  if (!isDevMode()) {
    hybridSync.onDataChange();
  }
  
  logger.info(`✅ Swap request created: ${newRequest.id}`);
  return newRequest;
}

// Update an existing swap request
export function updateSwapRequest(id: string, patch: Partial<SwapRequest>): SwapRequest | null {
  const requests = getSwapRequests();
  const index = requests.findIndex(r => r.id === id);
  
  if (index === -1) {
    logger.error(`❌ Swap request not found: ${id}`);
    return null;
  }
  
  const updated = { ...requests[index], ...patch };
  requests[index] = updated;
  
  const storage = getStorage();
  storage.swapRequests = requests;
  
  if (!isDevMode()) {
    hybridSync.onDataChange();
  }
  
  logger.info(`✅ Swap request updated: ${id}`);
  return updated;
}

// Mark lessons as swapped (exchange studentId between two lessons)
export function markLessonsAsSwapped(
  req: SwapRequest,
  getLessonsFn: () => Lesson[],
  updateLessonFn: (id: string, updates: Partial<Lesson>) => Lesson | undefined
): void {
  const lessons = getLessonsFn();
  
  const requesterLesson = lessons.find(l => l.id === req.requesterLessonId);
  const targetLesson = lessons.find(l => l.id === req.targetLessonId);
  
  if (!requesterLesson || !targetLesson) {
    logger.error('❌ Cannot swap - lessons not found');
    throw new Error('Lessons not found for swap');
  }
  
  // Exchange studentId
  const requesterStudentId = requesterLesson.studentId;
  const targetStudentId = targetLesson.studentId;
  
  updateLessonFn(req.requesterLessonId, {
    studentId: targetStudentId,
    isSwapped: true
  });
  
  updateLessonFn(req.targetLessonId, {
    studentId: requesterStudentId,
    isSwapped: true
  });
  
  logger.info(`✅ Lessons swapped: ${req.requesterLessonId} ↔ ${req.targetLessonId}`);
}
