import { logger } from './logger';
import { isDevMode } from './storage';

const WORKER_BASE_URL = 'https://lovable-dropbox-api.w0504124161.workers.dev/';

interface WorkerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface VersionInfo {
  path: string;
  server_modified: string;
  size: number;
  content_hash?: string;
}

// Get manager code from storage
const getManagerCode = (): string => {
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

// Get common headers with manager code
const getHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
  const managerCode = getManagerCode();
  return {
    'Accept': 'application/json',
    'Cache-Control': 'no-store',
    'X-Sonata-Manager-Code': managerCode,
    ...additionalHeaders,
  };
};

export const workerApi = {
  /**
   * Download latest version from Worker
   * GET ?action=download_latest
   */
  downloadLatest: async (): Promise<WorkerResponse> => {
    // 🔒 CRITICAL: Block all Worker access in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: downloadLatest blocked');
      return { success: false, error: 'DEV_MODE_BLOCKED' };
    }
    
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=download_latest`, {
        method: 'GET',
        headers: getHeaders(),
        mode: 'cors',
        cache: 'no-store',
      });

      if (response.status === 404) {
        logger.info('No latest version found - first time use');
        return { success: false, error: 'NO_VERSION_FOUND' };
      }

      if (!response.ok) {
        const text = await response.text();
        logger.warn('Failed to download latest:', text);
        return { success: false, error: text };
      }

      const data = await response.json();
      logger.info('Latest version downloaded from Worker');
      return { success: true, data };
    } catch (error) {
      logger.error('Failed to reach Worker:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Upload versioned data to Worker
   * POST ?action=upload_versioned
   */
  uploadVersioned: async (data: any): Promise<WorkerResponse> => {
    // 🔒 CRITICAL: Block all Worker access in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: uploadVersioned blocked');
      return { success: false, error: 'DEV_MODE_BLOCKED' };
    }
    
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=upload_versioned`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
        mode: 'cors',
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn('Failed to upload version:', text);
        return { success: false, error: text };
      }

      const result = await response.json();
      logger.info('Version uploaded to Worker');
      return { success: true, data: result };
    } catch (error) {
      logger.error('Failed to upload to Worker:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * List all versions from Worker
   * GET ?action=list_versions
   */
  listVersions: async (): Promise<WorkerResponse<VersionInfo[]>> => {
    // 🔒 CRITICAL: Block all Worker access in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: listVersions blocked');
      return { success: false, error: 'DEV_MODE_BLOCKED' };
    }
    
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=list_versions`, {
        method: 'GET',
        headers: getHeaders(),
        mode: 'cors',
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn('Failed to list versions:', text);
        return { success: false, error: text };
      }

      const data = await response.json();
      logger.info('Versions list retrieved from Worker');
      return { success: true, data };
    } catch (error) {
      logger.error('Failed to list versions:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Download specific version by path
   * POST ?action=download_by_path
   */
  downloadByPath: async (path: string): Promise<WorkerResponse> => {
    // 🔒 CRITICAL: Block all Worker access in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: downloadByPath blocked');
      return { success: false, error: 'DEV_MODE_BLOCKED' };
    }
    
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=download_by_path`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ path }),
        mode: 'cors',
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn('Failed to download version by path:', text);
        return { success: false, error: text };
      }

      const data = await response.json();
      logger.info('Version downloaded by path from Worker');
      return { success: true, data };
    } catch (error) {
      logger.error('Failed to download by path:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Upload attachment via multipart/form-data
   * POST ?action=upload_attachment
   */
  uploadAttachment: async (file: File): Promise<WorkerResponse> => {
    // 🔒 CRITICAL: Block all Worker access in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: uploadAttachment blocked');
      return { success: false, error: 'DEV_MODE_BLOCKED' };
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${WORKER_BASE_URL}?action=upload_attachment`, {
        method: 'POST',
        headers: getHeaders(), // No Content-Type - browser sets it with boundary
        body: formData,
        mode: 'cors',
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn('Failed to upload attachment:', text);
        return { success: false, error: text };
      }

      const result = await response.json();
      logger.info('Attachment uploaded to Worker:', result);
      return { success: true, data: result };
    } catch (error) {
      logger.error('Failed to upload attachment:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Delete attachment via JSON
   * POST ?action=delete_attachment
   */
  deleteAttachment: async (path: string): Promise<WorkerResponse> => {
    // 🔒 CRITICAL: Block all Worker access in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: deleteAttachment blocked');
      return { success: false, error: 'DEV_MODE_BLOCKED' };
    }
    
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=delete_attachment`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ path }),
        mode: 'cors',
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn('Failed to delete attachment:', text);
        return { success: false, error: text };
      }

      const result = await response.json();
      logger.info('Attachment deleted from Worker');
      return { success: true, data: result };
    } catch (error) {
      logger.error('Failed to delete attachment:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Legacy methods for backward compatibility
  saveData: async (data: any) => {
    return workerApi.uploadVersioned(data);
  },

  loadData: async () => {
    return workerApi.downloadLatest();
  },
};
