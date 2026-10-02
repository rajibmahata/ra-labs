/* ===== Customer API Types ===== */

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export type ProjectStatus =
  | 'intake'
  | 'prd_draft'
  | 'prd_signed'
  | 'in_build'
  | 'demo'
  | 'delivered'
  | 'closed';

export interface ProjectSummary {
  id: string;
  customerId: string;
  title: string;
  status: ProjectStatus;
  chatThreadId: string;
  documentCount: number;
  prdStatus: string;
  latestDemoId: string | null;
  createdAt: string;
  updatedAt: string;
  goal: string | null;
  audience: string | null;
  requirements: string | null;
  timeline: string | null;
  budgetOrConstraints: string | null;
  referenceLinks: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  adminNotes: string | null;
}

export interface ProjectBriefInput {
  title: string;
  goal: string;
  audience?: string;
  requirements?: string;
  timeline?: string;
  budgetOrConstraints?: string;
  referenceLinks?: string;
}

export interface Document {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  description: string;
  createdAt: string;
}

export interface Prd {
  id: string;
  content: string;
  status: string;
  signerNameCustomer: string | null;
  signedAtCustomer: string | null;
  signerNameAdmin: string | null;
  signedAtAdmin: string | null;
}

export interface Demo {
  type: string;
  urlOrAsset: string;
  notes: string;
  createdAt: string;
}

export interface Invoice {
  amount: number;
  currency: string;
  status: string;
  notes: string;
  createdAt: string;
}

export interface FeedbackForm {
  rating: number;
  comment: string;
  consentToPublish: boolean;
}

export interface ChatMessage {
  id: string;
  senderType: 'visitor' | 'customer' | 'admin' | 'agent';
  senderName: string;
  content: string;
  attachmentUrl: string | null;
  createdAt: string;
  suggestedActions?: string[] | null;
}

export interface ChatThread {
  id: string;
  type: string;
  needsManualIntervention: boolean;
  customerProjectId: string | null;
  createdAt: string;
  messages: ChatMessage[];
}

export interface PlatformConfig {
  voiceEnabled: boolean;
  voiceResponse: boolean;
  streamingEnabled: boolean;
  chatModel: string | null;
  sttProvider: string | null;
  ttsProvider: string | null;
  maxAudioDuration: number;
  customerPortalUrl: string | null;
}

/* ===== API Envelope ===== */

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface ApiResponse<T> {
  data: T;
}

/* ===== Standardized status metadata ===== */

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  intake: 'Intake',
  prd_draft: 'PRD Draft',
  prd_signed: 'PRD Signed',
  in_build: 'In Build',
  demo: 'Demo',
  delivered: 'Delivered',
  closed: 'Closed',
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  intake: '#6B6A5E',
  prd_draft: '#B8863B',
  prd_signed: '#1F5C46',
  in_build: '#3B82F6',
  demo: '#8B5CF6',
  delivered: '#0D9488',
  closed: '#1E293B',
};
