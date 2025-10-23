
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { syncManager } from './lib/syncManager';

// טעינה חוסמת של נתונים מדרופבוקס לפני הפעלת האפליקציה
async function initializeApp() {
  await syncManager.loadDataOnInit();
  createRoot(document.getElementById("root")!).render(<App />);
}

initializeApp();
