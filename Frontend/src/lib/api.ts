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
    listPaged: (params: { page?: number; limit?: number; status?: string }) => {
      const q = new URLSearchParams({ page: String(params.page ?? 1), limit: String(params.limit ?? 20) });
      if (params.status && params.status !== "all") q.set("status", params.status);
      return request<{ jobs: any[]; total: number; page: number; totalPages: number }>(`/api/reposts?${q}`);
    },
    create: (body: any) => request<any>("/api/reposts", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/api/reposts/${id}`, { method: "DELETE" }),
    retry:  (id: string) => request(`/api/reposts/${id}/retry`, { method: "POST" }),
  },

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

};

export { BASE, getToken, getAuthHeaders };
