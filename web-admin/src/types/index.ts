export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin';
  teamMemberId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: AdminUser;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiCollection<T> {
  data: T[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedLeadId?: string | null;
  relatedThreadId?: string | null;
  relatedCustomerId?: string | null;
  relatedCustomerProjectId?: string | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface TeamMember {
  id: string;
  slug: string;
  name: string;
  role: string;
  bio: string;
  githubUsername?: string | null;
  githubAccountUrl?: string | null;
  hasGithubToken?: boolean;
  avatarUrl?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  location?: string | null;
  isPublished: boolean;
  githubSnapshot?: GithubSnapshot | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GithubSnapshot {
  commits90d: number;
  activeRepos: number;
  lastCommitAt: string;
  capturedAt: string;
}

export interface TeamMemberForm {
  name: string;
  slug?: string;
  role: string;
  bio: string;
  githubUsername?: string;
  githubAccountUrl?: string;
  githubToken?: string;
  avatarUrl?: string;
  email?: string;
  linkedinUrl?: string;
  location?: string;
  isPublished: boolean;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  summary: string;
  stackTags: string[];
  status: 'live' | 'in_build';
  githubUrl?: string | null;
  caseStudyBody?: string | null;
  coverImageUrl?: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectForm {
  title: string;
  slug?: string;
  summary: string;
  stackTags: string[];
  status: 'live' | 'in_build';
  githubUrl?: string;
  caseStudyBody?: string;
  coverImageUrl?: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface Lead {
  id: string;
  name: string;
  contactInfo: string;
  message: string;
  source: 'form' | 'chatbot';
  status: 'new' | 'contacted' | 'converted' | 'closed';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentEntry {
  key: string;
  locale: string;
  value: string;
  updatedAt?: string;
}

export interface ChatThread {
  id: string;
  type: 'lead' | 'customer_project';
  needsManualIntervention: boolean;
  customerProjectId: string | null;
  lastMessageAt?: string;
  messageCount?: number;
  createdAt: string;
}

export interface ChatThreadDetail {
  id: string;
  type: 'lead' | 'customer_project';
  needsManualIntervention: boolean;
  customerProjectId: string | null;
  createdAt: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  senderType: 'visitor' | 'agent' | 'admin';
  senderName: string;
  content: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface AdminEntry {
  id: string;
  name: string;
  email: string;
  teamMemberId?: string | null;
  createdAt?: string;
}

export interface TeamProfileUpdate {
  name?: string;
  role?: string;
  bio?: string;
  githubUsername?: string;
  avatarUrl?: string;
  email?: string;
  linkedinUrl?: string;
  location?: string;
  isPublished?: boolean;
}

// Customer-Project Management

export type CustomerProjectStatus =
  | 'intake'
  | 'prd_draft'
  | 'prd_signed'
  | 'in_build'
  | 'demo'
  | 'delivered'
  | 'closed';

export interface Customer {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  projectCount: number;
}

export interface CustomerProject {
  id: string;
  customerId: string;
  title: string;
  status: CustomerProjectStatus;
  chatThreadId: string | null;
  documentCount: number;
  prdStatus: string | null;
  latestDemoId: string | null;
  createdAt: string;
  updatedAt: string;
  adminNotes: string | null;
  goal: string | null;
  audience: string | null;
  requirements: string | null;
  timeline: string | null;
  budgetOrConstraints: string | null;
  referenceLinks: string | null;
}

export interface CustomerProjectDetail extends CustomerProject {
  thread?: ChatThreadDetail | null;
}

export interface CustomerDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  description: string | null;
  createdAt: string;
}

export interface ClientPrd {
  id: string;
  content: string;
  status: string;
  signerNameCustomer: string | null;
  signedAtCustomer: string | null;
  signerNameAdmin: string | null;
  signedAtAdmin: string | null;
}

export interface Demo {
  type: 'screenshot' | 'url';
  urlOrAsset: string;
  notes: string | null;
  createdAt: string;
}

export interface Invoice {
  amount: number;
  currency: string;
  status: 'unpaid' | 'paid_cash';
  notes: string | null;
  createdAt: string;
}

export interface Feedback {
  rating: number;
  comment: string;
  consentToPublish: boolean;
  isPublished: boolean;
  createdAt: string;
}
