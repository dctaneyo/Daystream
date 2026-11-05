export type PinMode = "none" | "global" | "day";

export interface NoteSummary {
  id: string;
  userId: string | null;
  workspaceId: string | null;
  title: string;
  excerpt: string;
  assignedDate: string;
  sortOrder: number;
  pinMode: PinMode;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present when the note came through a direct note share. */
  workspaceName?: string;
  shareRole?: "editor" | "viewer";
  access?: "workspace" | "shared";
}

export type WorkspaceRole = "admin" | "editor" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole | string;
}

export interface Member {
  userId: string;
  displayName: string;
  role: string;
}

export interface NoteShare {
  userId: string;
  displayName: string;
  role: string;
}

export interface NoteShares {
  members: Member[];
  shares: NoteShare[];
  canManage: boolean;
}

export interface NotePublicLink {
  enabled: boolean;
  token?: string;
  createdAt?: string;
}

export interface PublicNote {
  note: {
    title: string;
    excerpt: string;
    assignedDate: string;
    updatedAt: string;
    workspaceName: string;
  };
  /** Base64-encoded Yjs update for the read-only document. */
  content: string;
}

export type TemplateBlockType = "p" | "h1" | "h2" | "bullet" | "check" | "quote";

export interface TemplateBlock {
  type: TemplateBlockType;
  text: string;
}

export interface Template {
  id: string;
  title: string;
  blocks?: TemplateBlock[];
}

export interface Me {
  user: {
    userId: string;
    displayName: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
  session: { endsAt: number };
  workspaces: Workspace[];
}

export interface AdminUser {
  userId: string;
  displayName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface SessionExpiry {
  expiresAt: number;
  endsAt: number;
}

export interface Bootstrap {
  user: {
    userId: string;
    displayName: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
  session: { endsAt: number };
  workspace: Workspace;
  workspaces: Workspace[];
  members: Member[];
  templates: Template[];
  day: { date: string; notes: NoteSummary[] };
  pinned: NoteSummary[];
  shared: NoteSummary[];
  activity: { date: string; count: number }[];
}

export interface AwarenessUser {
  id: string;
  name: string;
  color: string;
}

export interface Footprint {
  date: string;
  noteId: string | null;
}
