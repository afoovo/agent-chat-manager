import axios from 'axios';
import type { SessionQuery, ApiResponse, PageResponse, SessionItem, ProjectItem, MessageItem, SearchResult, StatsOverview, ImportItem } from './types';

const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(
  (res) => {
    if (res.config.responseType === 'blob') return res;
    const { code, msg } = res.data;
    if (code === 200) return res.data;
    console.error(`[API Error] ${code}: ${msg}`);
    throw new Error(msg || '未知错误');
  },
  (err) => {
    console.error(`[API Network] ${err.message}`);
    throw err;
  }
);

// projects
export const getProjects = () =>
  api.get<any, ApiResponse<ProjectItem[]>>('/projects').then(r => r.data);

// system
export const getSystemInfo = () =>
  api.get<any, ApiResponse<{ machine_name: string }>>('/system/info').then(r => r.data);

// sessions
export const getSessions = (params: SessionQuery) =>
  api.get<any, PageResponse<SessionItem>>('/sessions', { params }).then(r => r);

export const getSessionDetail = (id: string) =>
  api.get<any, ApiResponse<SessionItem>>(`/sessions/${id}`).then(r => r.data);

export const deleteSession = (id: string) =>
  api.delete<any, ApiResponse<null>>(`/sessions/${id}`).then(r => r.data);

export const archiveSession = (id: string) =>
  api.post<any, ApiResponse<null>>(`/sessions/${id}/archive`).then(r => r.data);

// messages
export const getMessages = (sessionId: string, page = 1, perPage = 50) =>
  api.get<any, PageResponse<MessageItem>>(`/sessions/${sessionId}/messages`, {
    params: { page, per_page: perPage }
  }).then(r => r);

// diff
export const getSessionDiff = (sessionId: string) =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>(`/sessions/${sessionId}/diff`).then(r => r.data);

// search
export const searchSessions = (params: SessionQuery & { part_type?: string; source?: string }) =>
  api.get<any, PageResponse<SearchResult>>('/search', { params }).then(r => r);

// stats
export const getStatsOverview = () =>
  api.get<any, ApiResponse<StatsOverview>>('/stats/overview').then(r => r.data);

export const getStatsByProject = () =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>('/stats/by-project').then(r => r.data);

export const getStatsByModel = () =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>('/stats/by-model').then(r => r.data);

export const getStatsByAgent = () =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>('/stats/by-agent').then(r => r.data);

export const getStatsTokenTrend = (granularity: 'day' | 'week' = 'day') =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>('/stats/token-trend', { params: { granularity } }).then(r => r.data);

export const getStatsHeatmap = (year: number) =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>('/stats/heatmap', { params: { year } }).then(r => r.data);

export const getStatsToolUsage = () =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>('/stats/tool-usage').then(r => r.data);

export const getStatsHourly = () =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>('/stats/hourly-distribution').then(r => r.data);

// bookmarks
export const getBookmarks = () =>
  api.get<any, ApiResponse<Record<string, unknown>[]>>('/bookmarks').then(r => r.data);

export const updateBookmark = (sessionId: string, data: { starred?: boolean; tags?: string[]; note?: string }) =>
  api.post<any, ApiResponse<null>>(`/bookmarks/${sessionId}`, data).then(r => r.data);

// export
export const exportSession = (sessionId: string, format: 'md' | 'html') =>
  api.get(`/sessions/${sessionId}/export`, { params: { format }, responseType: 'blob' });

export const exportSessions = (sessionIds: string[], format: 'md' | 'html') =>
  api.post('/sessions/export', { session_ids: sessionIds, format }, { responseType: 'blob' });

// import / export all
export const exportAll = () =>
  api.post('/export', null, { responseType: 'blob' });

export const getImports = () =>
  api.get<any, ApiResponse<ImportItem[]>>('/imports').then(r => r.data);

export const getImportConfig = () =>
  api.get<any, ApiResponse<{ db_path: string | null; import_dir: string }>>('/imports/config').then(r => r.data);

export const updateImportConfig = (import_dir: string) =>
  api.put<any, ApiResponse<{ import_dir: string; imports: ImportItem[] }>>('/imports/config', { import_dir }).then(r => r.data);

export const uploadImport = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post<any, ApiResponse<ImportItem>>('/imports', fd).then(r => r.data);
};

export const deleteImport = (machine: string) =>
  api.delete<any, ApiResponse<null>>(`/imports/${encodeURIComponent(machine)}`).then(r => r.data);

export const getImportSessions = (machine: string, params: SessionQuery) =>
  api.get<any, PageResponse<SessionItem>>(`/imports/${encodeURIComponent(machine)}/sessions`, { params }).then(r => r);

export const getImportProjects = (machine: string) =>
  api.get<any, ApiResponse<ProjectItem[]>>(`/imports/${encodeURIComponent(machine)}/projects`).then(r => r.data);

export const getImportSessionDetail = (machine: string, id: string) =>
  api.get<any, ApiResponse<SessionItem>>(`/imports/${encodeURIComponent(machine)}/sessions/${id}`).then(r => r.data);

export const getImportMessages = (machine: string, sessionId: string, page = 1, perPage = 50) =>
  api.get<any, PageResponse<MessageItem>>(`/imports/${encodeURIComponent(machine)}/sessions/${sessionId}/messages`, {
    params: { page, per_page: perPage }
  }).then(r => r);
