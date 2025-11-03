import { logger } from './logger';

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

export const workerApi = {
  /**
   * Download latest version from Worker
   * GET ?action=download_latest
   */
  downloadLatest: async (): Promise<WorkerResponse> => {
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=download_latest`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
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
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=upload_versioned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=list_versions`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
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
    try {
      const response = await fetch(`${WORKER_BASE_URL}?action=download_by_path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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

  // Legacy methods for backward compatibility
  saveData: async (data: any) => {
    return workerApi.uploadVersioned(data);
  },

  loadData: async () => {
    return workerApi.downloadLatest();
  },
};
