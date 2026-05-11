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
  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    signup:  (body: { email: string; password: string; name: string }) =>
      request<{ token: string; user: any }>("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),
    signin:  (body: { email: string; password: string }) =>
      request<{ token: string; user: any }>("/api/auth/signin", { method: "POST", body: JSON.stringify(body) }),
    signout: () => request("/api/auth/signout", { method: "POST" }),
    me:      () => request<any>("/api/auth/user"),
    verify:  () => request<any>("/api/auth/verify"),
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  admin: {
    login: (password: string) =>
      request<{ token: string }>("/api/admin/verify-password", { method: "POST", body: JSON.stringify({ password }) }),
  },

  // ── Shop ────────────────────────────────────────────────────────────────────
  shop: {
    list:   () => request<any[]>("/api/shop/items"),
    create: (body: any) => request<any>("/api/shop/items", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/api/shop/items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/api/shop/items/${id}`, { method: "DELETE" }),
  },

  // ── Accounts ────────────────────────────────────────────────────────────────
  accounts: {
    list:                () => request<any[]>("/api/accounts"),
    disconnect:          (platform: string) => request(`/api/accounts/${platform}`, { method: "DELETE" }),
    authUrl:             (platform: string) => request<{ url: string }>(`/api/accounts/${platform}/auth-url`),
    autoRepublishStatus: () => request<any[]>("/api/accounts/auto-republish-status"),
  },

  // ── Videos (platform fetch) ─────────────────────────────────────────────────
  videos: {
    list: (platform: string) => request<any[]>(`/api/videos?platform=${platform}`),
  },

  // ── Reposts ─────────────────────────────────────────────────────────────────
  reposts: {
    list:     () => request<any[]>("/api/reposts"),
    listPaged: (params: { page?: number; limit?: number; status?: string }) => {
      const q = new URLSearchParams({ page: String(params.page ?? 1), limit: String(params.limit ?? 20) });
      if (params.status && params.status !== "all") q.set("status", params.status);
      return request<{ jobs: any[]; total: number; page: number; totalPages: number }>(`/api/reposts?${q}`);
    },
    create: (body: any) => request<any>("/api/reposts", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/api/reposts/${id}`, { method: "DELETE" }),
    retry:  (id: string) => request(`/api/reposts/${id}/retry`, { method: "POST" }),
  },

  // ── Stripe / Billing ────────────────────────────────────────────────────────
  stripe: {
    checkout: () => request<{ url: string }>("/api/stripe/checkout", { method: "POST" }),
  },

  billing: {
    status:   () => request<{
      plan: string;
      status: string;
      current_period_end: string | null;
      cancel_at: string | null;
      reposts_used: number;
      reposts_limit: number | null;
      auto_republish_count: number;
      reset_date: string;
    }>("/api/billing/status"),
    invoices: () => request<{ id: string; date: string; amount: number; currency: string; status: string; pdf: string | null }[]>("/api/billing/invoices"),
  },

  // ── Best time ───────────────────────────────────────────────────────────────
  bestTime: {
    get: (timezone?: string) =>
      request<any>(`/api/best-time${timezone ? `?timezone=${encodeURIComponent(timezone)}` : ""}`),
  },

  // ── Auto-Republish ──────────────────────────────────────────────────────────
  autoRepublish: {
    setSettings: (platform: string, body: { enabled: boolean; targets: string[] }) =>
      request<any>(`/api/auto-republish/accounts/${platform}`, {
        method: "PATCH", body: JSON.stringify(body),
      }),
    activity: () => request<{ jobs: any[] }>("/api/auto-republish/activity"),
    retry:    (jobId: string) => request<any>(`/api/auto-republish/${jobId}/retry`, { method: "PATCH" }),
  },

  // ── Captions ────────────────────────────────────────────────────────────────
  captions: {
    generate: (videoId: string, body?: any) =>
      request<any>(`/api/captions/${videoId}/generate`, { method: "POST", body: JSON.stringify(body || {}) }),
    list: (videoId: string) =>
      request<any[]>(`/api/captions/${videoId}`),
  },

  // ── B-Roll ──────────────────────────────────────────────────────────────────
  broll: {
    analyze:  (videoId: string) =>
      request<any>(`/api/broll/${videoId}/analyze`, { method: "POST" }),
    segments: (videoId: string) =>
      request<any[]>(`/api/broll/${videoId}/segments`),
    apply:    (videoId: string, body: any) =>
      request<any>(`/api/broll/${videoId}/apply`, { method: "POST", body: JSON.stringify(body) }),
  },

  // ── AI Clipping ─────────────────────────────────────────────────────────────
  aiClip: {
    generate: (videoId: string, body?: { clip_count?: number; clip_duration?: number }) =>
      request<any>(`/api/ai-clip/${videoId}/generate`, { method: "POST", body: JSON.stringify(body || {}) }),
  },

  // ── Upload system ───────────────────────────────────────────────────────────
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

export { BASE, getToken, getAuthHeaders };
