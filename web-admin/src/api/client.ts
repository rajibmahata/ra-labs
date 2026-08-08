import type { AdminNotification, ApiError } from '../types';

const STORAGE_PREFIX = 'admin.';
const TOKEN_KEY = `${STORAGE_PREFIX}auth.token`;
const USER_KEY = `${STORAGE_PREFIX}auth.user`;
const EXPIRES_KEY = `${STORAGE_PREFIX}auth.expiresAt`;

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: unknown, expiresAt: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(EXPIRES_KEY, expiresAt);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (expiresAt && new Date(expiresAt) < new Date()) {
    clearAuth();
    return false;
  }
  return true;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function redirectToLogin(): void {
  clearAuth();
  window.location.href = '/admin/login';
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) {
      redirectToLogin();
      throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
    }

    if (res.status === 204) {
      return undefined as T;
    }

    let errorPayload: ApiError | null = null;
    try {
      errorPayload = (await res.json()) as ApiError;
    } catch {
      // no JSON body
    }

    const code = errorPayload?.error?.code ?? 'UNKNOWN_ERROR';
    const message = errorPayload?.error?.message ?? `Request failed with status ${res.status}`;
    const details = errorPayload?.error?.details;

    throw new ApiClientError(res.status, code, message, details);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ data: { accessToken: string; expiresAt: string; user: { id: string; name: string; email: string; role: string; teamMemberId?: string | null } } }>(
      'POST',
      '/api/v1/auth/login',
      { email, password },
    ),
};

// Team (admin)
export const team = {
  list: () =>
    request<{ data: { id: string; slug: string; name: string; role: string; bio: string; githubUsername?: string | null; githubAccountUrl?: string | null; hasGithubToken?: boolean; avatarUrl?: string | null; email?: string | null; linkedinUrl?: string | null; location?: string | null; isActive: boolean; isPublished: boolean; githubSnapshot?: { commits90d: number; activeRepos: number; lastCommitAt: string; capturedAt: string } | null; createdAt?: string; updatedAt?: string }[] }>(
      'GET',
      '/api/v1/admin/team',
    ),

  getMe: () =>
    request<{ data: { id: string; slug: string; name: string; role: string; bio: string; githubUsername?: string | null; githubAccountUrl?: string | null; hasGithubToken?: boolean; avatarUrl?: string | null; email?: string | null; linkedinUrl?: string | null; location?: string | null; isPublished: boolean; githubSnapshot?: { commits90d: number; activeRepos: number; lastCommitAt: string; capturedAt: string } | null; createdAt?: string; updatedAt?: string } }>(
      'GET',
      '/api/v1/admin/team/me',
    ),

  updateMe: (body: Record<string, unknown>) =>
    request<{ data: { id: string; slug: string; name: string; role: string; bio: string; githubUsername?: string | null; githubAccountUrl?: string | null; hasGithubToken?: boolean; avatarUrl?: string | null; email?: string | null; linkedinUrl?: string | null; location?: string | null; isPublished: boolean; githubSnapshot?: { commits90d: number; activeRepos: number; lastCommitAt: string; capturedAt: string } | null } }>(
      'PUT',
      '/api/v1/admin/team/me',
      body,
    ),

  create: (body: Record<string, unknown>) =>
    request<{ data: { id: string; slug: string; name: string; role: string; bio: string; githubUsername?: string | null; avatarUrl?: string | null; email?: string | null; linkedinUrl?: string | null; location?: string | null; isPublished: boolean } }>(
      'POST',
      '/api/v1/admin/team',
      body,
    ),

  update: (id: string, body: Record<string, unknown>) =>
    request<{ data: { id: string; slug: string; name: string; role: string; bio: string; githubUsername?: string | null; avatarUrl?: string | null; email?: string | null; linkedinUrl?: string | null; location?: string | null; isPublished: boolean } }>(
      'PUT',
      `/api/v1/admin/team/${id}`,
      body,
    ),

  delete: (id: string) =>
    request<void>('DELETE', `/api/v1/admin/team/${id}`),

  setStatus: (id: string, isActive: boolean) =>
    request<{ data: { id: string; isActive: boolean; isPublished: boolean } }>(
      'PATCH',
      `/api/v1/admin/team/${id}/status`,
      { isActive },
    ),
};

export const github = {
  sync: () => request<{ data: { status: string; error?: string | null; changedRepositories?: number; analysisTasksQueued?: number } }>('POST', '/api/v1/admin/github/sync'),
};

// Projects (admin)
export const projects = {
  list: () =>
    request<{ data: { id: string; slug: string; title: string; summary: string; stackTags: string[]; status: string; githubUrl?: string | null; caseStudyBody?: string | null; coverImageUrl?: string | null; sortOrder: number; isPublished: boolean; createdAt: string; updatedAt?: string }[] }>(
      'GET',
      '/api/v1/admin/projects',
    ),

  create: (body: Record<string, unknown>) =>
    request<{ data: { id: string; slug: string; title: string; summary: string; stackTags: string[]; status: string; githubUrl?: string | null; caseStudyBody?: string | null; coverImageUrl?: string | null; sortOrder: number; isPublished: boolean; createdAt: string } }>(
      'POST',
      '/api/v1/admin/projects',
      body,
    ),

  update: (id: string, body: Record<string, unknown>) =>
    request<{ data: { id: string; slug: string; title: string; summary: string; stackTags: string[]; status: string; githubUrl?: string | null; caseStudyBody?: string | null; coverImageUrl?: string | null; sortOrder: number; isPublished: boolean; createdAt: string; updatedAt?: string } }>(
      'PUT',
      `/api/v1/admin/projects/${id}`,
      body,
    ),

  setPublished: (id: string, isPublished: boolean) =>
    request<{ data: { id: string; isPublished: boolean } }>(
      'PATCH',
      `/api/v1/admin/projects/${id}/published`,
      { isPublished },
    ),

  delete: (id: string) =>
    request<void>('DELETE', `/api/v1/admin/projects/${id}`),
};

export const drafts = {
  list: (status = 'pending') =>
    request<{ data: { id: string; title: string; summary: string; body?: string | null; sourceUrl?: string | null; status: string; createdAt: string }[] }>(
      'GET', `/api/v1/admin/content-drafts?status=${encodeURIComponent(status)}`,
    ),
  review: (id: string, decision: 'approve' | 'reject', note?: string) =>
    request<{ data: { id: string; status: string } }>(
      'POST', `/api/v1/admin/content-drafts/${id}/review`, { decision, note },
    ),
};

// Leads (admin)
export const leads = {
  list: (params?: { status?: string; source?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.source) qs.set('source', params.source);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return request<{ data: { id: string; name: string; contactInfo: string; message: string; source: string; status: string; notes?: string | null; createdAt: string; updatedAt: string }[]; pagination?: { page: number; pageSize: number; totalCount: number; totalPages: number } }>(
      'GET',
      `/api/v1/admin/leads${query ? `?${query}` : ''}`,
    );
  },

  patch: (id: string, body: Record<string, unknown>) =>
    request<{ data: { id: string; name: string; contactInfo: string; message: string; source: string; status: string; notes?: string | null; createdAt: string; updatedAt: string } }>(
      'PATCH',
      `/api/v1/admin/leads/${id}`,
      body,
    ),
};

// Admin notifications
export const notifications = {
  list: (params?: { unread?: boolean; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.unread !== undefined) qs.set('unread', String(params.unread));
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return request<{ data: AdminNotification[]; pagination?: { page: number; pageSize: number; totalCount: number; totalPages: number } }>(
      'GET',
      `/api/v1/admin/notifications${query ? `?${query}` : ''}`,
    );
  },

  markRead: (id: string) =>
    request<void>('POST', `/api/v1/admin/notifications/${id}/read`),
};

// Content (admin)
export const content = {
  list: (params?: { locale?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.locale) qs.set('locale', params.locale);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return request<{ data: { key: string; locale: string; value: string; updatedAt?: string }[]; pagination?: { page: number; pageSize: number; totalCount: number; totalPages: number } }>(
      'GET',
      `/api/v1/admin/content${query ? `?${query}` : ''}`,
    );
  },

  create: (body: { key: string; locale: string; value: string }) =>
    request<{ data: { key: string; locale: string; value: string; updatedAt?: string } }>(
      'POST',
      '/api/v1/admin/content',
      body,
    ),

  update: (key: string, body: { locale: string; value: string }) =>
    request<{ data: { key: string; locale: string; value: string; updatedAt?: string } }>(
      'PUT',
      `/api/v1/admin/content/${encodeURIComponent(key)}`,
      body,
    ),

  delete: (key: string, locale: string) =>
    request<void>(
      'DELETE',
      `/api/v1/admin/content/${encodeURIComponent(key)}?locale=${encodeURIComponent(locale)}`,
    ),
};

// Chat (admin)
export const chat = {
  list: (params?: { type?: string; needsManualIntervention?: boolean; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.needsManualIntervention !== undefined) qs.set('needsManualIntervention', String(params.needsManualIntervention));
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return request<{ data: { id: string; type: string; needsManualIntervention: boolean; customerProjectId: string | null; lastMessageAt?: string; messageCount?: number; createdAt: string }[]; pagination?: { page: number; pageSize: number; totalCount: number; totalPages: number } }>(
      'GET',
      `/api/v1/admin/chat${query ? `?${query}` : ''}`,
    );
  },

  getThread: (threadId: string) =>
    request<{ data: { id: string; type: string; needsManualIntervention: boolean; customerProjectId: string | null; createdAt: string; messages: { id: string; senderType: string; senderName: string; content: string; attachmentUrl: string | null; createdAt: string }[] } }>(
      'GET',
      `/api/v1/chat/${threadId}`,
    ),

  sendMessage: (threadId: string, content: string) =>
    request<{ data: { id: string; threadId: string; senderType: string; senderName: string; content: string; attachmentUrl: string | null; createdAt: string } }>(
      'POST',
      `/api/v1/chat/${threadId}/messages`,
      { content },
    ),

  patchThread: (threadId: string, body: Record<string, unknown>) =>
    request<{ data: { id: string; type: string; needsManualIntervention: boolean; customerProjectId: string | null } }>(
      'PATCH',
      `/api/v1/admin/chat/${threadId}`,
      body,
    ),
};

// Admins (admin)
export const admins = {
  list: () =>
    request<{ data: { id: string; name: string; email: string; role: string; isActive: boolean; teamMemberId?: string | null; createdAt?: string }[] }>(
      'GET',
      '/api/v1/admin/admins',
    ),

  create: (body: { name: string; email: string; password: string; teamMemberId?: string | null }) =>
    request<{ data: { id: string; name: string; email: string; role: string; isActive: boolean; teamMemberId?: string | null; createdAt?: string } }>(
      'POST',
      '/api/v1/admin/admins',
      body,
    ),

  setStatus: (id: string, isActive: boolean) =>
    request<{ data: { id: string; name: string; email: string; role: string; isActive: boolean; teamMemberId?: string | null } }>(
      'PATCH',
      `/api/v1/admin/admins/${id}/status`,
      { isActive },
    ),
};

// Customers & Customer Projects (admin)
export const customerProjects = {
  listCustomers: (params?: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return request<{ data: { id: string; name: string; email: string; isActive: boolean; createdAt: string; projectCount: number }[]; pagination?: { page: number; pageSize: number; totalCount: number; totalPages: number } }>(
      'GET',
      `/api/v1/admin/customers${query ? `?${query}` : ''}`,
    );
  },

  createCustomer: (body: { name: string; email: string; password: string }) =>
    request<{ data: { id: string; name: string; email: string } }>('POST', '/api/v1/admin/customers', body),

  setStatus: (id: string, isActive: boolean) =>
    request<{ data: { id: string; isActive: boolean; updatedAt: string } }>(
      'PATCH',
      `/api/v1/admin/customers/${id}/status`,
      { isActive },
    ),

  list: (params?: { status?: string; customerId?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.customerId) qs.set('customerId', params.customerId);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return request<{ data: { id: string; customerId: string; title: string; status: string; chatThreadId: string | null; documentCount: number; prdStatus: string | null; latestDemoId: string | null; createdAt: string; updatedAt: string; adminNotes: string | null }[] }>(
      'GET',
      `/api/v1/admin/customer-projects${query ? `?${query}` : ''}`,
    );
  },

  get: (id: string) =>
    request<{ data: { id: string; customerId: string; title: string; status: string; chatThreadId: string | null; documentCount: number; prdStatus: string | null; latestDemoId: string | null; createdAt: string; updatedAt: string; adminNotes: string | null } }>(
      'GET',
      `/api/v1/admin/customer-projects/${id}`,
    ),

  create: (body: { customerId: string; title: string; goal?: string; audience?: string; requirements?: string; timeline?: string; budgetOrConstraints?: string; referenceLinks?: string }) =>
    request<{ data: { id: string; customerId: string; title: string; status: string; chatThreadId: string | null; documentCount: number; prdStatus: string | null; latestDemoId: string | null; createdAt: string; updatedAt: string; adminNotes: string | null } }>(
      'POST',
      '/api/v1/admin/customer-projects',
      body,
    ),

  update: (id: string, body: { status?: string; adminNotes?: string }) =>
    request<{ data: { id: string; customerId: string; title: string; status: string; chatThreadId: string | null; documentCount: number; prdStatus: string | null; latestDemoId: string | null; createdAt: string; updatedAt: string; adminNotes: string | null } }>(
      'PATCH',
      `/api/v1/admin/customer-projects/${id}`,
      body,
    ),

  getDocuments: (id: string) =>
    request<{ data: { id: string; fileName: string; fileUrl: string; uploadedBy: string; description: string | null; createdAt: string }[] }>(
      'GET',
      `/api/v1/admin/customer-projects/${id}/documents`,
    ),

  getPrd: (id: string) =>
    request<{ data: { id: string; content: string; status: string; signerNameCustomer: string | null; signedAtCustomer: string | null; signerNameAdmin: string | null; signedAtAdmin: string | null } | null }>(
      'GET',
      `/api/v1/admin/customer-projects/${id}/prd`,
    ),

  savePrd: (id: string, body: { content: string }) =>
    request<{ data: { id: string; content: string; status: string; signerNameCustomer: string | null; signedAtCustomer: string | null; signerNameAdmin: string | null; signedAtAdmin: string | null } }>(
      'PUT',
      `/api/v1/admin/customer-projects/${id}/prd`,
      body,
    ),

  signPrdAdmin: (id: string) =>
    request<{ data: { id: string; content: string; status: string; signerNameCustomer: string | null; signedAtCustomer: string | null; signerNameAdmin: string | null; signedAtAdmin: string | null } }>(
      'POST',
      `/api/v1/admin/customer-projects/${id}/prd/sign`,
    ),

  getDemo: (id: string) =>
    request<{ data: { type: 'screenshot' | 'url'; urlOrAsset: string; notes: string | null; createdAt: string } | null }>(
      'GET',
      `/api/v1/admin/customer-projects/${id}/demo`,
    ),

  addDemo: (id: string, body: { type: 'screenshot' | 'url'; urlOrAsset: string; notes?: string }) =>
    request<{ data: { type: 'screenshot' | 'url'; urlOrAsset: string; notes: string | null; createdAt: string } }>(
      'POST',
      `/api/v1/admin/customer-projects/${id}/demo`,
      body,
    ),

  getInvoices: (id: string) =>
    request<{ data: { amount: number; currency: string; status: 'unpaid' | 'paid_cash'; notes: string | null; createdAt: string }[] }>(
      'GET',
      `/api/v1/admin/customer-projects/${id}/invoice`,
    ),

  createInvoice: (id: string, body: { amount: number; currency: string; status: 'unpaid' | 'paid_cash'; notes?: string }) =>
    request<{ data: { amount: number; currency: string; status: 'unpaid' | 'paid_cash'; notes: string | null; createdAt: string } }>(
      'POST',
      `/api/v1/admin/customer-projects/${id}/invoice`,
      body,
    ),

  getFeedback: (id: string) =>
    request<{ data: { rating: number; comment: string; consentToPublish: boolean; isPublished: boolean; createdAt: string } | null }>(
      'GET',
      `/api/v1/admin/customer-projects/${id}/feedback`,
    ),

  approveFeedback: (id: string) =>
    request<{ data: { rating: number; comment: string; consentToPublish: boolean; isPublished: boolean; createdAt: string } }>(
      'POST',
      `/api/v1/admin/customer-projects/${id}/feedback/approve`,
    ),
};

export const reviews = {
  list: (params?: { page?: number; pageSize?: number; search?: string; published?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.search) qs.set('search', params.search);
    if (params?.published !== undefined) qs.set('published', String(params.published));
    const query = qs.toString();
    return request<{ data: { id: string; customerProjectId: string; customerName: string; projectTitle: string; rating: number; comment: string; consentToPublish: boolean; isPublished: boolean; createdAt: string }[]; pagination: { page: number; pageSize: number; totalCount: number; totalPages: number } }>(
      'GET',
      `/api/v1/admin/reviews${query ? `?${query}` : ''}`,
    );
  },

  moderate: (id: string, approved: boolean) =>
    request<{ data: { id: string; isPublished: boolean } }>(
      'POST',
      `/api/v1/admin/reviews/${id}/moderate`,
      { approved },
    ),
};
