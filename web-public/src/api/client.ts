const STORAGE_PREFIX = 'ralabs-public';

function storageKey(name: string): string {
  return `${STORAGE_PREFIX}.${name}`;
}

export function getFromStorage(key: string): string | null {
  try {
    return localStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

export function setToStorage(key: string, value: string): void {
  try {
    localStorage.setItem(storageKey(key), value);
  } catch {
    // Storage may be full or unavailable
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    // No-op
  }
}

export function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

export function setSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(storageKey(key), value);
  } catch {
    // No-op
  }
}

export function removeSessionItem(key: string): void {
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    // No-op
  }
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
}

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
    let errorBody: ApiError | null = null;
    try {
      errorBody = (await response.json()) as ApiError;
    } catch {
      // Response body is not JSON
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

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | undefined>
): Promise<ApiResponse<T>> {
  const url = new URL(path, window.location.origin);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  return parseResponse<T>(response);
}

export async function apiPost<T>(
  path: string,
  body: unknown
): Promise<ApiResponse<T>> {
  const url = new URL(path, window.location.origin);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseResponse<T>(response);
}

// ===== Typed API functions =====

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  stackTags: string[];
  status: string;
  coverImageUrl: string;
  createdAt: string;
}

export interface ProjectDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  stackTags: string[];
  status: string;
  githubUrl: string;
  caseStudyBody: string;
  coverImageUrl: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GithubRepositorySummary {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  primaryLanguage: string | null;
  technologies: string[];
  pushedAt: string | null;
  syncedAt: string;
}

export interface TeamMember {
  id: string;
  slug: string;
  name: string;
  role: string;
  bio: string;
  githubUsername: string;
  avatarUrl: string;
  githubSnapshot: {
    commits90d: number;
    activeRepos: number;
    lastCommitAt: string;
    capturedAt: string;
  } | null;
}

export interface ContentData {
  locale: string;
  content: Record<string, string>;
}

export interface LeadResponse {
  id: string;
  status: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderType: 'visitor' | 'agent';
  senderName: string;
  content: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  type: string;
  needsManualIntervention: boolean;
  customerProjectId: string | null;
  createdAt: string;
  messages: ChatMessage[];
}

export interface ChatThreadSummary {
  id: string;
  type: string;
  needsManualIntervention: boolean;
  customerProjectId: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
}

export interface LocaleInfo {
  code: string;
  name: string;
  nativeName: string;
}

export const api = {
  getProjects(params?: {
    page?: number;
    pageSize?: number;
    tag?: string;
  }): Promise<ApiResponse<ProjectSummary[]>> {
    return apiGet<ProjectSummary[]>('/api/v1/projects', {
      page: params?.page?.toString(),
      pageSize: params?.pageSize?.toString(),
      tag: params?.tag,
    });
  },

  getProject(slug: string): Promise<ApiResponse<ProjectDetail>> {
    return apiGet<ProjectDetail>(`/api/v1/projects/${encodeURIComponent(slug)}`);
  },

  getGithubRepositories(params?: { page?: number; pageSize?: number; technology?: string }): Promise<ApiResponse<GithubRepositorySummary[]>> {
    return apiGet<GithubRepositorySummary[]>('/api/v1/github/repositories', {
      page: params?.page?.toString(),
      pageSize: params?.pageSize?.toString(),
      technology: params?.technology,
    });
  },

  getTeam(): Promise<ApiResponse<TeamMember[]>> {
    return apiGet<TeamMember[]>('/api/v1/team');
  },

  getTeamMember(slug: string): Promise<ApiResponse<TeamMember>> {
    return apiGet<TeamMember>(`/api/v1/team/${encodeURIComponent(slug)}`);
  },

  getContent(locale: string): Promise<ApiResponse<ContentData>> {
    return apiGet<ContentData>('/api/v1/content', { locale });
  },

  submitLead(body: {
    name: string;
    contactInfo: string;
    message: string;
    source: 'form' | 'chatbot';
  }): Promise<ApiResponse<LeadResponse>> {
    return apiPost<LeadResponse>('/api/v1/leads', body);
  },

  getLocales(): Promise<ApiResponse<LocaleInfo[]>> {
    return apiGet<LocaleInfo[]>('/api/v1/locales');
  },

  getChatThread(
    threadId: string
  ): Promise<ApiResponse<ChatThread>> {
    return apiGet<ChatThread>(`/api/v1/chat/${encodeURIComponent(threadId)}`);
  },

  createChatThread(): Promise<ApiResponse<{ id: string; type: string }>> {
    return apiPost<{ id: string; type: string }>('/api/v1/chat/threads', {});
  },

  sendChatMessage(
    threadId: string,
    body: { content: string; attachmentUrl: string | null }
  ): Promise<ApiResponse<ChatThreadSummary>> {
    return apiPost<ChatThreadSummary>(
      `/api/v1/chat/${encodeURIComponent(threadId)}/messages`,
      body
    );
  },
};
