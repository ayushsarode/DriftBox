import axios from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("token");
      Cookies.remove("user");
      window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: async (userData: {
    username: string;
    email: string;
    password: string;
  }) => {
    const response = await api.post("/register", userData);
    return response.data;
  },

  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post("/login", credentials);
    if (response.data.token) {
      Cookies.set("token", response.data.token, { expires: 7 });
      Cookies.set("user", JSON.stringify(response.data.user), { expires: 7 });
    }
    return response.data;
  },

  googleLogin: () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  },

  logout: () => {
    Cookies.remove("token");
    Cookies.remove("user");
    window.location.href = "/auth/login";
  },
};

export const folderAPI = {
  create: async (folderData: { name: string; parent_id?: string }) => {
    const response = await api.post("/api/folders", folderData);
    return response.data;
  },

  getAll: async (parent_id?: string) => {
    const params = parent_id ? { parent_id } : {};
    const response = await api.get("/api/folders", { params });
    return response.data.folders || [];
  },

  delete: async (folderId: string) => {
    const response = await api.delete(`/api/folders/${folderId}`);
    return response.data;
  },
};

export const fileAPI = {
  upload: async (formData: FormData) => {
    const response = await api.post("/api/files/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  getAll: async (folder_id?: string) => {
    const params = folder_id ? { folder_id } : {};
    const response = await api.get("/api/files", { params });
    return response.data.files || [];
  },

  download: async (fileId: string) => {
    try {
      const response = await api.get(`/api/files/${fileId}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      return { download_url: url, method: "proxy" };
    } catch (error) {
      console.warn("Direct download failed, trying signed URL method:", error);

      try {
        const urlResponse = await api.get(
          `/api/files/${fileId}/download?redirect=true`
        );
        return urlResponse.data;
      } catch (signedUrlError) {
        console.error("Both download methods failed:", signedUrlError);
        throw signedUrlError;
      }
    }
  },

  delete: async (fileId: string) => {
    const response = await api.delete(`/api/files/${fileId}`);
    return response.data;
  },

  toggleFavorite: async (fileId: string) => {
    try {
      const response = await api.post(`/api/files/toggle-favorite/${fileId}`);
      return response.data;
    } catch (error) {
      console.error("Toggle favorite error:", error);
      throw error;
    }
  },

  getFavorites: async () => {
    try {
      const response = await api.get("/api/files/favorites");
      return response.data.files || [];
    } catch (error) {
      console.error("Get favorites error:", error);
      throw error;
    }
  },

  testConnection: async () => {
    try {
      const response = await api.get("/api/files");
      return response.data;
    } catch (error) {
      console.error("Server connection test failed:", error);
      throw error;
    }
  },
};

export const storageAPI = {
  getInfo: async () => {
    try {
      const response = await api.get("/api/storage");

      const storageData = response.data.storage || {};
      return storageData;
    } catch (error: any) {
      console.error("Storage API request failed:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      return {};
    }
  },
};

export default api;
