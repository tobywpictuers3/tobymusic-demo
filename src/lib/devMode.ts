import { logger } from './logger';

// Dev Mode: Completely isolated in-memory storage (no Worker, no sync)
let devModeActive = false;

export const setDevMode = (isActive: boolean) => {
  devModeActive = isActive;
  if (isActive) {
    logger.info('🔧 DEV MODE ACTIVATED - Using isolated in-memory storage');
  } else {
    logger.info('✅ PRODUCTION MODE - Using Worker sync');
  }
};

export const isDevMode = (): boolean => devModeActive;

export const getManagerCode = (): string => {
  try {
    const currentUser = localStorage.getItem('musicSystem_currentUser');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      if (user.type === 'admin' && user.adminCode) {
        return user.adminCode;
      }
    }
  } catch (error) {
    logger.warn('Failed to get manager code:', error);
  }
  return '';
};
