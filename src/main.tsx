import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { hybridSync } from './lib/hybridSync';
import { logger } from './lib/logger';
import { clearPracticeAndMedalData } from './lib/storage';
// Show loading screen
const root = document.getElementById("root")!;
root.innerHTML = `
  <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div style="text-align: center; color: white;">
      <div style="font-size: 48px; margin-bottom: 16px;">🎵</div>
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">טוען...</div>
      <div style="font-size: 16px; opacity: 0.9;">אנא המתן</div>
    </div>
  </div>
`;

// localStorage cleanup function (not used automatically anymore)
const cleanupLocalStorage = () => {
  const keysToKeep = ['hybridSync_session'];
  const allKeys = Object.keys(localStorage);
  
  allKeys.forEach(key => {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key);
    }
  });
  
  logger.info('🧹 localStorage cleaned - only session data kept');
};

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        logger.info('ServiceWorker registered');
      },
      (error) => {
        logger.info('ServiceWorker registration failed');
      }
    );
  });
}

// ❌ REMOVED: Don't clean localStorage on app close
// All data is in inMemoryStorage, and hybridSync handles beforeunload sync

// Load data from Worker before starting the app
async function initializeApp() {
  try {
    logger.info('Starting app initialization...');
    await hybridSync.loadDataOnInit();
    logger.info('Data loaded successfully');
    createRoot(root).render(<App />);
  } catch (error) {
    logger.error('Failed to initialize app:', error);
    
    // Show error screen with retry option
    root.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="text-align: center; color: white; max-width: 500px; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">שגיאה בטעינת הנתונים</div>
          <div style="font-size: 16px; margin-bottom: 24px; opacity: 0.9;">
            לא הצלחנו לטעון את הנתונים מהשרת.<br/>
            אנא בדקי את החיבור לאינטרנט ונסי שוב.
          </div>
          <button 
            onclick="window.location.reload()" 
            style="background: white; color: #667eea; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
          >
            נסי שוב
          </button>
        </div>
      </div>
    `;
  }
}

initializeApp();
