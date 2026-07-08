export interface SessionItem {
  id: string;
  title: string;
  directory?: string;
  project_id?: string;
  model_id?: string;
  provider_id?: string;
  variant?: string;
  agent?: string;
  cost: number;
  tokens_input: number;
  tokens_output: number;
  tokens_reasoning: number;
  time_created: number;
  time_updated: number;
  starred: boolean;
  tags: string[];
  preview?: string;
}

export interface PartItem {
  id: string;
  type: 'text' | 'reasoning' | 'tool' | 'step-start' | 'step-finish' | 'patch' | 'compaction' | 'file' | 'unknown';
  text?: string;
  tool?: string;
  callID?: string;
  state?: ToolState;
  time?: { start: number; end: number };
  time_created: number;
  snapshot?: string;
  tokens?: TokenInfo;
  cost?: number;
  reason?: string;
  hash?: string;
  files?: string[];
  auto?: boolean;
  tail_start_id?: string;
}

export interface ToolState {
  status: 'completed' | 'running' | 'error';
  input: Record<string, unknown>;
  output: string;
  title: string;
  time: { start: number; end: number };
  metadata?: { exit: number; description: string; truncated: boolean };
}

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  session_id?: string;
  agent?: string;
  model_id?: string;
  provider_id?: string;
  variant?: string;
  parts: PartItem[];
  time_created: number;
  tokens?: TokenInfo;
  cost?: number;
}

export interface TokenInfo {
  input: number;
  output: number;
  reasoning: number;
  total?: number;
  cache?: { read: number; write: number };
}

export interface ProjectItem {
  id: string;
  worktree: string;
  name: string;
  session_count: number;
  directories: Record<string, unknown>[];
  time_created: number;
}

export interface SearchResult {
  session_id: string;
  session_title: string;
  project_name?: string;
  project_id?: string;
  message_id: string;
  part_id: string;
  part_type: string;
  snippet: string;
  time_created: number;
}

export interface StatsOverview {
  total_sessions: number;
  total_cost: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_tokens_reasoning: number;
  active_days: number;
  avg_daily_sessions: number;
  avg_daily_cost: number;
  first_session: number;
  last_session: number;
}

export interface SessionSwitch {
  id: string;
  session_id: string;
  type: 'agent-switched' | 'model-switched';
  seq: number;
  time_created: number;
  data: string;
}

export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface PageResponse<T> {
  code: number;
  msg: string;
  total: number;
  rows: T[];
}

export interface SessionQuery {
  project_id?: string;
  agent?: string;
  date_from?: number;
  date_to?: number;
  q?: string;
  starred?: boolean;
  tag?: string;
  page?: number;
  per_page?: number;
  source?: string;
}

export interface ImportItem {
  machine: string;
  file: string;
  session_count: number;
  imported_at: string;
}
