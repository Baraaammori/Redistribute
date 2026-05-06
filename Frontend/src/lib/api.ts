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

  accounts: {
    list:       () => request<any[]>("/api/accounts"),
    disconnect: (platform: string) => request(`/api/accounts/${platform}`, { method: "DELETE" }),
    authUrl:    (platform: string) => request<{ url: string }>(`/api/accounts/${platform}/auth-url`),
    autoRepublishStatus: () => request<any[]>("/api/accounts/auto-republish-status"),
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

  bestTime: {
    get: (timezone?: string) =>
      request<any>(`/api/best-time${timezone ? `?timezone=${encodeURIComponent(timezone)}` : ""}`),
  },

  autoRepublish: {
    setSettings: (platform: string, body: { enabled: boolean; targets: string[] }) =>
      request<any>(`/api/auto-republish/accounts/${platform}`, {
        method: "PATCH", body: JSON.stringify(body),
      }),
    activity: () => request<{ jobs: any[] }>("/api/auto-republish/activity"),
    retry:    (jobId: string) => request<any>(`/api/auto-republish/${jobId}/retry`, { method: "PATCH" }),
  },

  upload: {
    create: (file: File, meta: { title: string; description?: string; tags?: string; mode?: string }) => {
      const fd = new FormData();
      fd.append("video", file);
      fd.append("title", meta.title);
      if (meta.description) fd.append("description", meta.description);
      if (meta.tags)        fd.append("tags", meta.tags);
      if (meta.mode)        fd.append("mode", meta.mode);
      return uploadRequest<any>("/api/upload", fd);
    },
    list:        () => request<any[]>("/api/upload"),
    get:         (id: string) => request<any>(`/api/upload/${id}`),
    analyze:     (id: string) => request<any>(`/api/upload/${id}/analyze`, { method: "POST" }),
    process:     (id: string, config?: any) =>
      request<any>(`/api/upload/${id}/process`, { method: "POST", body: JSON.stringify(config || {}) }),
    distribute:  (id: string, config?: any) =>
      request<any>(`/api/upload/${id}/distribute`, { method: "POST", body: JSON.stringify(config || {}) }),
    clips:       (videoId: string) => request<any[]>(`/api/upload/${videoId}/clips`),
    approveClip: (clipId: string) => request<any>(`/api/upload/clips/${clipId}/approve`, { method: "POST" }),
    deleteClip:  (clipId: string) => request(`/api/upload/clips/${clipId}`, { method: "DELETE" }),
    delete:      (id: string) => request(`/api/upload/${id}`, { method: "DELETE" }),
    stats:       () => request<any>("/api/upload/stats/overview"),
    logs:        () => request<any[]>("/api/upload/logs/all"),
  },
};

export { getToken, getAuthHeaders };
