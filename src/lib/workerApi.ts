import { logger } from "@/lib/logger";
import { isDevMode, getManagerCode } from "@/lib/devMode";

export interface WorkerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

const WORKER_BASE_URL = "https://lovable-dropbox-api.w0504124161.workers.dev";

/* ===========================================================
   HEADERS HELPERS — VERY IMPORTANT !
   =========================================================== */

const getJsonHeaders = () => ({
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Sonata-Manager-Code": getManagerCode(),
});

// NOTICE:
/// 1. UploadAttachment MUST NOT use Accept or Content-Type
/// 2. Only X-Sonata-Manager-Code is allowed
/// 3. Body MUST be FormData with NO headers set by us
/// 4. Setting Content-Type manually breaks multipart upload

/* ===========================================================
   EXPORT: Worker API
   =========================================================== */

export const workerApi = {
  /* -----------------------------------------------------------
     1. Download Latest Database JSON
     ----------------------------------------------------------- */
  downloadLatest: async (): Promise<WorkerResponse> => {
    if (isDevMode()) {
      logger.warn("DEV MODE: downloadLatest blocked");
      return { success: false, error: "DEV_MODE_BLOCKED" };
    }

    try {
      const r = await fetch(`${WORKER_BASE_URL}?action=download_latest`, {
        method: "GET",
        cache: "no-store",
      });

      if (!r.ok) {
        const txt = await r.text();
        logger.error("downloadLatest failed:", txt);
        return { success: false, error: txt };
      }

      const data = await r.json();
      return { success: true, data };
    } catch (err) {
      logger.error("downloadLatest error:", err);
      return { success: false, error: (err as Error).message };
    }
  },

  /* -----------------------------------------------------------
     2. Upload Full Database (versioned)
     ----------------------------------------------------------- */
  uploadVersioned: async (db: any): Promise<WorkerResponse> => {
    if (isDevMode()) {
      logger.warn("DEV MODE: uploadVersioned blocked");
      return { success: false, error: "DEV_MODE_BLOCKED" };
    }

    try {
      const r = await fetch(`${WORKER_BASE_URL}?action=upload_versioned`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(db),
      });

      if (!r.ok) {
        const txt = await r.text();
        logger.error("uploadVersioned failed:", txt);
        return { success: false, error: txt };
      }

      const data = await r.json();
      return { success: true, data };
    } catch (err) {
      logger.error("uploadVersioned error:", err);
      return { success: false, error: (err as Error).message };
    }
  },

  /* -----------------------------------------------------------
     3. Upload Attachment (multipart/form-data)
     ----------------------------------------------------------- */
  uploadAttachment: async (file: File): Promise<WorkerResponse> => {
    if (isDevMode()) {
      logger.warn("DEV MODE: uploadAttachment blocked");
      return { success: false, error: "DEV_MODE_BLOCKED" };
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      logger.info("Uploading attachment:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      const response = await fetch(
        `${WORKER_BASE_URL}?action=upload_attachment`,
        {
          method: "POST",
          // VERY IMPORTANT: DO NOT SET Content-Type or Accept
          headers: {
            "X-Sonata-Manager-Code": getManagerCode(),
          },
          body: formData,
          mode: "cors",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        logger.error("Failed to upload attachment:", text);
        return { success: false, error: text };
      }

      const result = await response.json();
      logger.info("Attachment uploaded:", result);

      return { success: true, data: result };
    } catch (error) {
      logger.error("uploadAttachment error:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  /* -----------------------------------------------------------
     4. Delete Attachment
     ----------------------------------------------------------- */
  deleteAttachment: async (path: string): Promise<WorkerResponse> => {
    if (isDevMode()) {
      logger.warn("DEV MODE: deleteAttachment blocked");
      return { success: false, error: "DEV_MODE_BLOCKED" };
    }

    try {
      const r = await fetch(`${WORKER_BASE_URL}?action=delete_attachment`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ path }),
        cache: "no-store",
      });

      if (!r.ok) {
        const txt = await r.text();
        // Handle file already deleted in Dropbox as success
        if (txt.includes("path_lookup/not_found")) {
          logger.warn("deleteAttachment: file already missing in Dropbox, treating as success");
          return { success: true, data: { ignored: true, reason: "path_lookup/not_found" } };
        }
        logger.error("deleteAttachment failed:", txt);
        return { success: false, error: txt };
      }

      const data = await r.json();
      logger.info("Attachment deleted:", data);
      return { success: true, data };
    } catch (err) {
      logger.error("deleteAttachment error:", err);
      return { success: false, error: (err as Error).message };
    }
  },

  /* -----------------------------------------------------------
     5. List Versions
     ----------------------------------------------------------- */
  listVersions: async (): Promise<WorkerResponse> => {
    if (isDevMode()) {
      logger.warn("DEV MODE: listVersions blocked");
      return { success: false, error: "DEV_MODE_BLOCKED" };
    }

    try {
      const r = await fetch(`${WORKER_BASE_URL}?action=list_versions`, {
        method: "GET",
        cache: "no-store",
      });

      if (!r.ok) {
        const txt = await r.text();
        logger.error("listVersions failed:", txt);
        return { success: false, error: txt };
      }

      const data = await r.json();
      return { success: true, data };
    } catch (err) {
      logger.error("listVersions error:", err);
      return { success: false, error: (err as Error).message };
    }
  },

  /* -----------------------------------------------------------
     6. Download by Path
     ----------------------------------------------------------- */
  downloadByPath: async (path: string): Promise<WorkerResponse> => {
    if (isDevMode()) {
      logger.warn("DEV MODE: downloadByPath blocked");
      return { success: false, error: "DEV_MODE_BLOCKED" };
    }

    try {
      const r = await fetch(`${WORKER_BASE_URL}?action=download_by_path`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ path }),
        cache: "no-store",
      });

      if (!r.ok) {
        const txt = await r.text();
        logger.error("downloadByPath failed:", txt);
        return { success: false, error: txt };
      }

      const data = await r.json();
      return { success: true, data };
    } catch (err) {
      logger.error("downloadByPath error:", err);
      return { success: false, error: (err as Error).message };
    }
  },

  /* -----------------------------------------------------------
     Legacy Methods
     ----------------------------------------------------------- */
  saveData: async (data: any): Promise<WorkerResponse> => {
    return workerApi.uploadVersioned(data);
  },

  loadData: async (): Promise<WorkerResponse> => {
    return workerApi.downloadLatest();
  },
};
