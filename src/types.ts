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
}

export type WorkspaceRole = "admin" | "editor" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole | string;
}

export interface Member {
  userId: string;
  role: string;
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
  user: { userId: string; isAdmin: boolean };
  session: { endsAt: number };
  workspaces: Workspace[];
}

export interface SessionExpiry {
  expiresAt: number;
  endsAt: number;
}

export interface Bootstrap {
  user: { userId: string; isAdmin: boolean };
  session: { endsAt: number };
  workspace: Workspace;
  workspaces: Workspace[];
  members: Member[];
  templates: Template[];
  day: { date: string; notes: NoteSummary[] };
  pinned: NoteSummary[];
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
