// Cloudflare Worker endpoint
const WORKER_ENDPOINT = "https://lovable-dropbox-api.w0504124161.workers.dev/";

interface SyncManager {
  loadDataOnInit: () => Promise<void>;
  onUserAction: (action: string) => Promise<void>;
  
  // Additional methods for BackupImport component
  importBackup: (file: File) => Promise<boolean>;
  downloadBackup: () => void;
  
  // Automatic backup methods
  downloadSonataBackup: () => void;
  onSwapRequestReceived: () => void;
  startPeriodicBackup: () => void;
  stopPeriodicBackup: () => void;
  
  // Google Calendar integration
  sendCalendarEvent: (eventData: CalendarEventData) => Promise<void>;
  startCalendarSync: () => void;
  stopCalendarSync: () => void;
}

interface CalendarEventData {
  type: 'calendar_event';
  category: 'עבודה';
  sub_category: 'תלמידות' | 'הופעות';
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  description?: string;
  action: 'create' | 'update' | 'delete';
  eventId?: string;
}

class SyncManagerImpl implements SyncManager {
  private backupInterval: NodeJS.Timeout | null = null;
  private calendarSyncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Setup automatic backup on app close (including unexpected close)
    this.setupAppCloseBackup();
    // Start periodic backup (every 30 minutes)
    this.startPeriodicBackup();
    // Start calendar sync (every 30 minutes)
    this.startCalendarSync();
  }

  // Load data from Cloudflare Worker
  private async loadFromWorker(): Promise<any | null> {
    try {
      console.info('Loading data from Cloudflare Worker...');
      
      const response = await fetch(`${WORKER_ENDPOINT}?action=load`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.info('No data found in Worker - this is normal for first use');
          return null;
        }
        const errorText = await response.text();
        throw new Error(`Worker request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        console.info('No data available from Worker');
        return null;
      }
      
      console.log('Data successfully loaded from Cloudflare Worker');
      return data;
    } catch (error) {
      console.error('Failed to load from Worker:', error);
      return null;
    }
  }

  // Save data to Cloudflare Worker
  private async saveToWorker(myData: any): Promise<boolean> {
    try {
      const response = await fetch(`${WORKER_ENDPOINT}?action=update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(myData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker upload failed: ${response.status} - ${errorText}`);
      }

      console.log('Data successfully saved to Cloudflare Worker');
      return true;
    } catch (error) {
      console.error('Failed to save to Worker:', error);
      return false;
    }
  }

  private setupAppCloseBackup(): void {
    // Handle beforeunload (browser close/refresh)
    window.addEventListener('beforeunload', () => {
      this.downloadSonataBackup();
    });

    // Handle visibility change (when app goes to background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.downloadSonataBackup();
      }
    });

    // Handle page hide (when navigating away)
    window.addEventListener('pagehide', () => {
      this.downloadSonataBackup();
    });
  }

  startPeriodicBackup(): void {
    // Clear existing interval if any
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // Set up 30-minute interval (30 * 60 * 1000 milliseconds)
    this.backupInterval = setInterval(() => {
      console.log('Performing scheduled 30-minute backup...');
      this.downloadSonataBackup();
    }, 30 * 60 * 1000);
  }

  stopPeriodicBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }

  onSwapRequestReceived(): void {
    console.log('Swap request received - triggering automatic backup...');
    this.downloadSonataBackup();
  }

  downloadSonataBackup(): void {
    try {
      const students = JSON.parse(localStorage.getItem('musicSystem_students') || '[]');
      const lessons = JSON.parse(localStorage.getItem('musicSystem_lessons') || '[]');
      const payments = JSON.parse(localStorage.getItem('musicSystem_payments') || '[]');
      const swapRequests = JSON.parse(localStorage.getItem('musicSystem_swapRequests') || '[]');
      const files = JSON.parse(localStorage.getItem('musicSystem_files') || '[]');
      const scheduleTemplates = JSON.parse(localStorage.getItem('musicSystem_scheduleTemplates') || '[]');
      const integrationSettings = JSON.parse(localStorage.getItem('musicSystem_integrationSettings') || '{}');

      const backupData = {
        students,
        lessons,
        payments,
        swapRequests,
        files,
        scheduleTemplates,
        integrationSettings,
        timestamp: new Date().toISOString()
      };

      // Create filename with "סונטה" + timestamp
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hour = now.getHours().toString().padStart(2, '0');
      const minute = now.getMinutes().toString().padStart(2, '0');
      
      const timestamp = `${year}${month}${day}${hour}${minute}`;
      const filename = `סונטה${timestamp}.json`;

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Automatic backup created: ${filename}`);
      
      // גם שומר ל-Worker
      this.autoSaveToWorker();
    } catch (error) {
      console.error('Failed to create automatic backup:', error);
    }
  }

  // טעינת נתונים מ-Cloudflare Worker בעת טעינת האפליקציה
  async loadDataOnInit(): Promise<void> {
    try {
      console.info('Loading data from Cloudflare Worker on init...');
      const data = await this.loadFromWorker();
      
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        // Import data to memory (not localStorage)
        if (data.students) localStorage.setItem('musicSystem_students', JSON.stringify(data.students));
        if (data.lessons) localStorage.setItem('musicSystem_lessons', JSON.stringify(data.lessons));
        if (data.payments) localStorage.setItem('musicSystem_payments', JSON.stringify(data.payments));
        if (data.swapRequests) localStorage.setItem('musicSystem_swapRequests', JSON.stringify(data.swapRequests));
        if (data.files) localStorage.setItem('musicSystem_files', JSON.stringify(data.files));
        if (data.scheduleTemplates) localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(data.scheduleTemplates));
        if (data.integrationSettings) localStorage.setItem('musicSystem_integrationSettings', JSON.stringify(data.integrationSettings));
        
        console.info('✅ Data loaded from Cloudflare Worker successfully');
      } else {
        console.info('ℹ️ No data found in Worker, starting fresh');
      }
    } catch (error) {
      console.warn('⚠️ Could not load from Worker:', error);
    }
  }

  async onUserAction(action: string): Promise<void> {
    switch (action) {
      case 'update':
      case 'create':
      case 'delete':
        // Auto-save to Worker on any data change
        await this.autoSaveToWorker();
        break;
      default:
        console.log('Unknown user action:', action);
    }
  }

  // Automatic save to Cloudflare Worker when data changes
  private async autoSaveToWorker(): Promise<void> {
    try {
      const students = JSON.parse(localStorage.getItem('musicSystem_students') || '[]');
      const lessons = JSON.parse(localStorage.getItem('musicSystem_lessons') || '[]');
      const payments = JSON.parse(localStorage.getItem('musicSystem_payments') || '[]');
      const swapRequests = JSON.parse(localStorage.getItem('musicSystem_swapRequests') || '[]');
      const files = JSON.parse(localStorage.getItem('musicSystem_files') || '[]');
      const scheduleTemplates = JSON.parse(localStorage.getItem('musicSystem_scheduleTemplates') || '[]');
      const integrationSettings = JSON.parse(localStorage.getItem('musicSystem_integrationSettings') || '{}');

      const allData = {
        students,
        lessons,
        payments,
        swapRequests,
        files,
        scheduleTemplates,
        integrationSettings,
        timestamp: new Date().toISOString()
      };

      await this.saveToWorker(allData);
    } catch (error) {
      console.error('Failed to auto-save to Worker:', error);
    }
  }

  async importBackup(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Import data to localStorage
      if (data.students) localStorage.setItem('musicSystem_students', JSON.stringify(data.students));
      if (data.lessons) localStorage.setItem('musicSystem_lessons', JSON.stringify(data.lessons));
      if (data.payments) localStorage.setItem('musicSystem_payments', JSON.stringify(data.payments));
      if (data.swapRequests) localStorage.setItem('musicSystem_swapRequests', JSON.stringify(data.swapRequests));
      if (data.files) localStorage.setItem('musicSystem_files', JSON.stringify(data.files));
      if (data.scheduleTemplates) localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(data.scheduleTemplates));
      if (data.integrationSettings) localStorage.setItem('musicSystem_integrationSettings', JSON.stringify(data.integrationSettings));
      
      console.log('Backup imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import backup:', error);
      return false;
    }
  }

  downloadBackup(): void {
    try {
      const students = JSON.parse(localStorage.getItem('musicSystem_students') || '[]');
      const lessons = JSON.parse(localStorage.getItem('musicSystem_lessons') || '[]');
      const payments = JSON.parse(localStorage.getItem('musicSystem_payments') || '[]');
      const swapRequests = JSON.parse(localStorage.getItem('musicSystem_swapRequests') || '[]');
      const files = JSON.parse(localStorage.getItem('musicSystem_files') || '[]');
      const scheduleTemplates = JSON.parse(localStorage.getItem('musicSystem_scheduleTemplates') || '[]');
      const integrationSettings = JSON.parse(localStorage.getItem('musicSystem_integrationSettings') || '{}');

      const backupData = {
        students,
        lessons,
        payments,
        swapRequests,
        files,
        scheduleTemplates,
        integrationSettings,
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `music-system-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download backup:', error);
    }
  }

  // Google Calendar Integration
  async sendCalendarEvent(eventData: CalendarEventData): Promise<void> {
    try {
      console.log('Sending calendar event to Worker:', eventData);
      
      const response = await fetch(`${WORKER_ENDPOINT}?action=calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar event failed: ${response.status} - ${errorText}`);
      }

      console.log('Calendar event sent successfully');
    } catch (error) {
      console.error('Failed to send calendar event:', error);
    }
  }

  private async syncFromCalendar(): Promise<void> {
    try {
      console.log('Syncing from Google Calendar...');
      
      const response = await fetch(`${WORKER_ENDPOINT}?action=calendar-sync`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar sync failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data && data.updates) {
        // Apply updates from Google Calendar
        if (data.updates.lessons) {
          const currentLessons = JSON.parse(localStorage.getItem('musicSystem_lessons') || '[]');
          // Merge lessons from calendar
          const updatedLessons = this.mergeLessonsFromCalendar(currentLessons, data.updates.lessons);
          localStorage.setItem('musicSystem_lessons', JSON.stringify(updatedLessons));
        }
        
        if (data.updates.performances) {
          const currentPerformances = JSON.parse(localStorage.getItem('musicSystem_performances') || '[]');
          // Merge performances from calendar
          const updatedPerformances = this.mergePerformancesFromCalendar(currentPerformances, data.updates.performances);
          localStorage.setItem('musicSystem_performances', JSON.stringify(updatedPerformances));
        }
        
        console.log('Calendar sync completed successfully');
      }
    } catch (error) {
      console.error('Failed to sync from calendar:', error);
    }
  }

  private mergeLessonsFromCalendar(currentLessons: any[], calendarLessons: any[]): any[] {
    // Simple merge logic - can be enhanced based on requirements
    const merged = [...currentLessons];
    
    calendarLessons.forEach(calLesson => {
      const existingIndex = merged.findIndex(l => l.id === calLesson.id);
      if (existingIndex >= 0) {
        // Update existing
        merged[existingIndex] = { ...merged[existingIndex], ...calLesson };
      } else {
        // Add new
        merged.push(calLesson);
      }
    });
    
    return merged;
  }

  private mergePerformancesFromCalendar(currentPerformances: any[], calendarPerformances: any[]): any[] {
    // Simple merge logic - can be enhanced based on requirements
    const merged = [...currentPerformances];
    
    calendarPerformances.forEach(calPerf => {
      const existingIndex = merged.findIndex(p => p.id === calPerf.id);
      if (existingIndex >= 0) {
        // Update existing
        merged[existingIndex] = { ...merged[existingIndex], ...calPerf };
      } else {
        // Add new
        merged.push(calPerf);
      }
    });
    
    return merged;
  }

  startCalendarSync(): void {
    // Clear existing interval if any
    if (this.calendarSyncInterval) {
      clearInterval(this.calendarSyncInterval);
    }

    // Set up 30-minute interval for calendar sync
    this.calendarSyncInterval = setInterval(() => {
      console.log('Performing scheduled calendar sync...');
      this.syncFromCalendar();
    }, 30 * 60 * 1000);

    // Also sync immediately on start
    this.syncFromCalendar();
  }

  stopCalendarSync(): void {
    if (this.calendarSyncInterval) {
      clearInterval(this.calendarSyncInterval);
      this.calendarSyncInterval = null;
    }
  }
}

export const syncManager: SyncManager = new SyncManagerImpl();
