export const workerApi = {
  saveData: async (data: any) => {
    try {
      const response = await fetch(
        "https://lovable-dropbox-api.w0504124161.workers.dev/?action=upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(data),
          mode: "cors",
          cache: "no-cache",
          credentials: "omit",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("❌ Dropbox worker response error:", text);
        return { success: false, error: text };
      }

      const result = await response.json();
      console.log("✅ Dropbox worker response:", result);
      return { success: true, data: result };
    } catch (error) {
      console.error("❌ Failed to reach Dropbox worker:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  loadData: async () => {
    try {
      const response = await fetch(
        "https://lovable-dropbox-api.w0504124161.workers.dev/?action=download",
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
          },
          mode: "cors",
          cache: "no-cache",
          credentials: "omit",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("❌ Dropbox worker load error:", text);
        return { success: false, error: text };
      }

      const result = await response.json();
      console.log("✅ Dropbox worker loaded:", result);
      return { success: true, data: result };
    } catch (error) {
      console.error("❌ Failed to load from Dropbox worker:", error);
      return { success: false, error: (error as Error).message };
    }
  },
};
