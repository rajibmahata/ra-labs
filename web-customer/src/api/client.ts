import type {
  ApiResponse,
  AuthTokens,
  User,
  ProjectSummary,
  ProjectDetail,
  ProjectBriefInput,
  Document,
  Prd,
  Demo,
  Invoice,
  ChatThread,
  ChatMessage,
  PlatformConfig,
} from '../types';

const STORAGE_PREFIX = 'ralabs-customer';

function storageKey(name: string): string {
  return `${STORAGE_PREFIX}.${name}`;
}

function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

function setStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(storageKey(key), value);
  } catch {
    // Storage full or unavailable
  }
}

function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    // No-op
  }
}

/* ===== Auth Token Management ===== */

const TOKEN_KEY = 'auth.token';
const REFRESH_KEY = 'auth.refreshToken';

export function getAccessToken(): string | null {
  return getStorageItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return getStorageItem(REFRESH_KEY);
}

export function saveTokens(tokens: AuthTokens): void {
  setStorageItem(TOKEN_KEY, tokens.accessToken);
  setStorageItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  removeStorageItem(TOKEN_KEY);
  removeStorageItem(REFRESH_KEY);
}

/* ===== Error Handling ===== */

export class ApiClientError extends Error {
  public code: string;
  public status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    let errorBody: { error?: { code?: string; message?: string } } | null = null;
    try {
      errorBody = (await response.json()) as { error?: { code?: string; message?: string } };
    } catch {
      // Body is not JSON
    }

    const code = errorBody?.error?.code ?? 'UNKNOWN_ERROR';
    const message =
      errorBody?.error?.message ??
      `Request failed with status ${response.status}`;

    throw new ApiClientError(response.status, code, message);
  }

  const json = (await response.json()) as ApiResponse<T>;
  return json;
}

/* ===== Token Refresh ===== */

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken || isRefreshing) {
    if (refreshPromise) return refreshPromise;
    return false;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/v1/customer/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return false;
      }

      const json = (await response.json()) as ApiResponse<AuthTokens>;
      saveTokens(json.data);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/* ===== Fetch Wrapper ===== */

function redirectToLogin(): void {
  // Use window.location for a hard redirect outside React router
  const currentPath = window.location.pathname;
  if (currentPath !== '/login') {
    window.location.href = '/login';
  }
}

async function authFetch(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  // If 401 and we have a refresh token, try refreshing once
  if (response.status === 401 && !retried) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return authFetch(path, options, true);
    }
    clearTokens();
    redirectToLogin();
    throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
  }

  if (response.status === 401 && retried) {
    clearTokens();
    redirectToLogin();
    throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
  }

  return response;
}

/* ===== API Methods ===== */

export const api = {
  /* Auth */
  async register(
    body: { name: string; email: string; password: string }
  ): Promise<ApiResponse<AuthTokens>> {
    const response = await fetch('/api/v1/customer/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseResponse<AuthTokens>(response);
  },

  async login(
    body: { email: string; password: string }
  ): Promise<ApiResponse<AuthTokens>> {
    const response = await fetch('/api/v1/customer/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseResponse<AuthTokens>(response);
  },

  async forgotPassword(
    body: { email: string }
  ): Promise<ApiResponse<{ message: string }>> {
    const response = await fetch('/api/v1/customer/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseResponse<{ message: string }>(response);
  },

  async resetPassword(
    body: { email: string; token: string; newPassword: string }
  ): Promise<ApiResponse<{ message: string }>> {
    const response = await fetch('/api/v1/customer/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseResponse<{ message: string }>(response);
  },

  /* Customer */
  async getMe(): Promise<ApiResponse<User>> {
    const response = await authFetch('/api/v1/customer/me');
    return parseResponse<User>(response);
  },

  async getProjects(): Promise<ApiResponse<ProjectSummary[]>> {
    const response = await authFetch('/api/v1/customer/projects');
    return parseResponse<ProjectSummary[]>(response);
  },

  async createProject(body: ProjectBriefInput): Promise<ApiResponse<ProjectSummary>> {
    const response = await authFetch('/api/v1/customer/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseResponse<ProjectSummary>(response);
  },

  async getProject(id: string): Promise<ApiResponse<ProjectDetail>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(id)}`
    );
    return parseResponse<ProjectDetail>(response);
  },

  async getDocuments(
    projectId: string
  ): Promise<ApiResponse<Document[]>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/documents`
    );
    return parseResponse<Document[]>(response);
  },

  async uploadDocument(
    projectId: string,
    file: File
  ): Promise<ApiResponse<Document>> {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAccessToken();

    const response = await fetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/documents`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      }
    );

    if (response.status === 401) {
      const refreshed = await attemptRefresh();
      if (refreshed) {
        return api.uploadDocument(projectId, file);
      }
      clearTokens();
      redirectToLogin();
      throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired.');
    }

    return parseResponse<Document>(response);
  },

  async getPrd(projectId: string): Promise<ApiResponse<Prd>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/prd`
    );
    return parseResponse<Prd>(response);
  },

  async signPrd(
    projectId: string,
    body: { confirmName: string }
  ): Promise<ApiResponse<Prd>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/prd/sign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return parseResponse<Prd>(response);
  },

  async getDemo(
    projectId: string
  ): Promise<ApiResponse<Demo | null>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/demo`
    );
    return parseResponse<Demo | null>(response);
  },

  async getInvoices(
    projectId: string
  ): Promise<ApiResponse<Invoice[]>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/invoice`
    );
    return parseResponse<Invoice[]>(response);
  },

  async submitFeedback(
    projectId: string,
    body: { rating: number; comment: string; consentToPublish: boolean }
  ): Promise<ApiResponse<{ id: string }>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/feedback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return parseResponse<{ id: string }>(response);
  },

  /* Chat */
  async getProjectChat(
    projectId: string
  ): Promise<ApiResponse<ChatThread>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/chat`
    );
    return parseResponse<ChatThread>(response);
  },

  async sendProjectChatMessage(
    projectId: string,
    body: { content: string; attachmentUrl: string | null }
  ): Promise<ApiResponse<ChatMessage>> {
    const response = await authFetch(
      `/api/v1/customer/projects/${encodeURIComponent(projectId)}/chat/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return parseResponse<ChatMessage>(response);
  },

  /* AI Agent (registration handoff) */
  async createAgentThread(): Promise<ApiResponse<{ id: string }>> {
    const response = await authFetch('/api/v1/customer/agent/thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return parseResponse<{ id: string }>(response);
  },

  async getAgentThread(threadId: string): Promise<ApiResponse<ChatThread>> {
    const response = await authFetch(
      `/api/v1/customer/agent/thread/${encodeURIComponent(threadId)}`
    );
    return parseResponse<ChatThread>(response);
  },

  async claimAgentThread(threadId: string): Promise<ApiResponse<unknown>> {
    const response = await authFetch(
      `/api/v1/customer/agent/thread/${encodeURIComponent(threadId)}/claim`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    );
    return parseResponse<unknown>(response);
  },

  async sendAgentMessage(
    threadId: string,
    body: { content: string; attachmentUrl: string | null }
  ): Promise<ApiResponse<unknown>> {
    const response = await authFetch(
      `/api/v1/customer/agent/thread/${encodeURIComponent(threadId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return parseResponse<unknown>(response);
  },

  getConfig(): Promise<ApiResponse<PlatformConfig>> {
    return authFetch('/api/v1/config').then(parseResponse<PlatformConfig>);
  },

  async uploadChatAttachment(file: File): Promise<ApiResponse<{ url: string }>> {
    const form = new FormData();
    form.append('file', file);
    const response = await authFetch('/api/v1/chat/attachments', {
      method: 'POST',
      headers: {},
      body: form,
    });
    return parseResponse<{ url: string }>(response);
  },
};
