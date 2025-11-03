import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { hybridSync } from './lib/hybridSync';
import { logger } from './lib/logger';

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

// Load data from Dropbox before starting the app
async function initializeApp() {
  try {
    logger.info('Starting app initialization...');
    await hybridSync.loadDataOnInit();
    logger.info('Data loaded successfully');
  } catch (error) {
    logger.info('Continuing with local data');
  } finally {
    createRoot(root).render(<App />);
  }
}

initializeApp();
