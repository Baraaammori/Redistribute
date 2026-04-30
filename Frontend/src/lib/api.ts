const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

function getToken(): string | null {
  return localStorage.getItem("authToken");
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

/**
 * Upload a file with multipart/form-data (no JSON content-type)
 */
async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    signup:  (body: { email: string; password: string; name: string }) =>
      request<{ token: string; user: any }>("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),
    signin:  (body: { email: string; password: string }) =>
      request<{ token: string; user: any }>("/api/auth/signin", { method: "POST", body: JSON.stringify(body) }),
    signout: () => request("/api/auth/signout", { method: "POST" }),
    me:      () => request<any>("/api/auth/user"),
    verify:  () => request<any>("/api/auth/verify"),
  },

  admin: {
    login: (password: string) =>
      request<{ token: string }>("/api/admin/verify-password", { method: "POST", body: JSON.stringify({ password }) }),
  },

  shop: {
    list:   () => request<any[]>("/api/shop/items"),
    create: (body: any) => request<any>("/api/shop/items", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/api/shop/items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/api/shop/items/${id}`, { method: "DELETE" }),
  },

  accounts: {
    list:       () => request<any[]>("/api/accounts"),
    disconnect: (platform: string) => request(`/api/accounts/${platform}`, { method: "DELETE" }),
    authUrl:    (platform: string) => request<{ url: string }>(`/api/accounts/${platform}/auth-url`),
  },

  videos: {
    list: (platform: string) => request<any[]>(`/api/videos?platform=${platform}`),
  },

  reposts: {
    list:   () => request<any[]>("/api/reposts"),
    create: (body: any) => request<any>("/api/reposts", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/api/reposts/${id}`, { method: "DELETE" }),
    retry:  (id: string) => request(`/api/reposts/${id}/retry`, { method: "POST" }),
  },

  stripe: {
    checkout: () => request<{ url: string }>("/api/stripe/checkout", { method: "POST" }),
    portal:   () => request<{ url: string }>("/api/stripe/portal", { method: "POST" }),
  },

  // ── NEW: Upload system ────────────────────────────────────────────────────
  upload: {
    /** Upload a video file with metadata */
    create: (file: File, meta: { title: string; description?: string; tags?: string; mode?: string }) => {
      const fd = new FormData();
      fd.append("video", file);
      fd.append("title", meta.title);
      if (meta.description) fd.append("description", meta.description);
      if (meta.tags) fd.append("tags", meta.tags);
      if (meta.mode) fd.append("mode", meta.mode);
      return uploadRequest<any>("/api/upload", fd);
    },

    /** List uploaded videos */
    list: () => request<any[]>("/api/upload"),

    /** Get video details with clips and distributions */
    get: (id: string) => request<any>(`/api/upload/${id}`),

    /** Analyze video (re-run ffprobe) */
    analyze: (id: string) => request<any>(`/api/upload/${id}/analyze`, { method: "POST" }),

    /** Process video (generate clips) */
    process: (id: string, config?: any) =>
      request<any>(`/api/upload/${id}/process`, { method: "POST", body: JSON.stringify(config || {}) }),

    /** Distribute video to platforms */
    distribute: (id: string, config?: any) =>
      request<any>(`/api/upload/${id}/distribute`, { method: "POST", body: JSON.stringify(config || {}) }),

    /** List clips for a video */
    clips: (videoId: string) => request<any[]>(`/api/upload/${videoId}/clips`),

    /** Approve a clip */
    approveClip: (clipId: string) => request<any>(`/api/upload/clips/${clipId}/approve`, { method: "POST" }),

    /** Delete a clip */
    deleteClip: (clipId: string) => request(`/api/upload/clips/${clipId}`, { method: "DELETE" }),

    /** Delete a video */
    delete: (id: string) => request(`/api/upload/${id}`, { method: "DELETE" }),

    /** Get dashboard stats */
    stats: () => request<any>("/api/upload/stats/overview"),

    /** Get job logs */
    logs: () => request<any[]>("/api/upload/logs/all"),
  },
};

export { getToken, getAuthHeaders };
