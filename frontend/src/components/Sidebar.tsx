import { useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProjects, getSystemInfo, getImports, getImportProjects, getImportConfig, updateImportConfig, uploadImport, deleteImport, exportAll } from '../lib/api';
import type { ProjectItem } from '../lib/types';
import { BarChart3, ChevronDown, ChevronRight, Folder, FolderOpen, HardDrive, Upload, Download, X, Sun, Moon, Settings } from 'lucide-react';

interface TreeNode {
  name: string;
  type: 'dir' | 'project';
  projectId?: string;
  count?: number;
  children: TreeNode[];
}

function sumCounts(nodes: TreeNode[]): number {
  let total = 0;
  for (const n of nodes) {
    if (n.type === 'project') {
      total += n.count || 0;
    } else {
      const sub = sumCounts(n.children);
      n.count = sub;
      total += sub;
    }
  }
  return total;
}

function buildTree(projects: ProjectItem[], machineName: string): TreeNode[] {
  const dirs = new Map<string, TreeNode>();
  const root: TreeNode[] = [];

  for (const p of projects) {
    const path = (p.worktree || '').replace(/\\/g, '/').replace(/\/$/, '');
    let segments = path.split('/').filter(Boolean);
    if (segments.length === 0) continue;
    if (segments[0].length === 2 && segments[0][1] === ':') {
      segments = segments.slice(1);
    }
    if (segments.length === 0) continue;
    if (segments[0].toLowerCase() === machineName.toLowerCase()) {
      segments = segments.slice(1);
    }
    if (segments.length === 0) continue;

    let parent: TreeNode[] = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments.slice(0, i + 1).join('/');
      if (!dirs.has(key)) {
        const node: TreeNode = { name: segments[i], type: 'dir', children: [] };
        dirs.set(key, node);
        parent.push(node);
      }
      parent = dirs.get(key)!.children;
    }

    const name = segments[segments.length - 1];
    const key = segments.join('/');
    // 如果父级已有同名目录，并入其中
    const existing = parent.find(n => n.type === 'dir' && n.name === name);
    if (existing) {
      existing.children.push({
        name: '当前目录', type: 'project', projectId: p.id, count: p.session_count, children: [],
      });
    } else {
      parent.push({
        name, type: 'project', projectId: p.id, count: p.session_count, children: [],
      });
    }
  }

  sumCounts(root);
  return root;
}

export default function Sidebar({ theme, onToggleTheme }: { theme?: string; onToggleTheme?: () => void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeProject = searchParams.get('project_id');
  const activeSource = searchParams.get('source');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [showImportConfig, setShowImportConfig] = useState(false);

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: getProjects });
  const { data: sysInfo } = useQuery({ queryKey: ['system-info'], queryFn: getSystemInfo });
  const { data: imports } = useQuery({ queryKey: ['imports'], queryFn: getImports });
  const { data: importConfig } = useQuery({ queryKey: ['import-config'], queryFn: getImportConfig });
  const { data: importProjects } = useQuery({
    queryKey: ['import-projects', activeSource],
    queryFn: () => getImportProjects(activeSource!),
    enabled: !!activeSource,
  });
  const importTree = useMemo(() => buildTree(importProjects || [], activeSource || ''), [importProjects, activeSource]);
  const machineName = sysInfo?.machine_name || 'localhost';
  const tree = useMemo(() => buildTree(projects || [], machineName), [projects, machineName]);
  const totalSessions = useMemo(() => sumCounts(tree), [tree]);

  const selectProject = (id: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.delete('source');
    if (id) params.set('project_id', id); else params.delete('project_id');
    const qs = params.toString();
    navigate(qs ? `/sessions?${qs}` : '/sessions');
  };

  const toggleDir = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadImport(file);
      queryClient.invalidateQueries({ queryKey: ['imports'] });
    } catch (err) {
      console.error('导入失败:', err);
    }
    e.target.value = '';
  };

  const handleDeleteImport = async (machine: string) => {
    try {
      await deleteImport(machine);
      queryClient.invalidateQueries({ queryKey: ['imports'] });
      if (activeSource === machine) navigate('/sessions');
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleExportAll = async () => {
    try {
      const res = await exportAll();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename\*=UTF-8''(.+)/);
      a.download = match ? decodeURIComponent(match[1]) : 'opencode-export.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败:', err);
    }
  };

  const selectImport = (machine: string) => {
    if (activeSource === machine) {
      navigate('/sessions');
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set('source', machine);
    params.delete('project_id');
    navigate(`/sessions?${params.toString()}`);
  };

  const selectImportProject = (machine: string, projectId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('source', machine);
    params.set('project_id', projectId);
    navigate(`/sessions?${params.toString()}`);
  };

  const renderNode = (node: TreeNode, depth: number, parentPath: string, impSource?: string) => {
    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
    const padLeft = 12 + depth * 16;

    if (node.type === 'project') {
      const active = impSource
        ? (activeSource === impSource && activeProject === node.projectId)
        : (activeProject === node.projectId);
      const isCurrentDir = node.name === '当前目录';
      const handleClick = () => {
        if (impSource) {
          selectImportProject(impSource, node.projectId!);
        } else {
          selectProject(node.projectId!);
        }
      };
      return (
        <div key={node.projectId} onClick={handleClick}
          title={nodePath}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
            padding: '3px var(--s-4)', paddingLeft: padLeft, cursor: 'pointer', fontSize: 12,
            background: active ? 'var(--primary-glow)' : 'transparent',
            borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
            color: active ? 'var(--primary)' : 'var(--fg)', fontWeight: active ? 500 : 400,
          }}>
          <span style={{ flexShrink: 0, fontSize: 10, opacity: 0.5, width: 14, textAlign: 'center' }}>
            {isCurrentDir ? '📂' : '▸'}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--fg-dim)', flexShrink: 0 }}>
            {node.count}
          </span>
        </div>
      );
    }

    const isOpen = expanded.has(nodePath);
    return (
      <div key={nodePath}>
        <div onClick={() => toggleDir(nodePath)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '2px var(--s-4)',
          paddingLeft: padLeft, cursor: 'pointer', fontSize: 11, color: 'var(--fg-dim)',
          textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600,
          userSelect: 'none',
        }}>
          {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {isOpen ? <FolderOpen size={12} /> : <Folder size={12} />}
          {node.name}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-dim)' }}>
            {node.count}
          </span>
        </div>
        {isOpen && node.children.map(c => renderNode(c, depth + 1, nodePath, impSource))}
      </div>
    );
  };

  return (
    <aside style={{
      width: 280, minWidth: 200, maxWidth: 450,
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', background: 'var(--surface)',
    }}>
      <div style={{ padding: 'var(--s-4)', borderBottom: '1px solid var(--border-faint)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, cursor: 'pointer' }}
          onClick={() => navigate('/sessions')}>ChatManager</h2>
      </div>
      <nav style={{ flex: 1, overflowY: 'auto' }}>
        <div onClick={() => selectProject(null)} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          padding: '8px var(--s-4)', cursor: 'pointer',
          background: activeProject ? 'var(--bg)' : 'var(--primary-glow)',
          borderBottom: '1px solid var(--border-faint)',
          fontSize: 13, fontWeight: 600,
          color: activeProject ? 'var(--fg)' : 'var(--primary)',
        }}>
          <HardDrive size={14} />
          <span style={{ flex: 1 }}>{machineName}</span>
          <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontWeight: 400 }}>
            {totalSessions}
          </span>
        </div>
        {tree.map(n => renderNode(n, 0, ''))}
        {imports && imports.length > 0 && (
          <div style={{ marginTop: 'var(--s-4)' }}>
            <div style={{
              padding: '2px var(--s-4)', fontSize: 10, color: 'var(--fg-dim)',
              textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
            }}>已导入</div>
            {imports.map(imp => (
              <div key={imp.machine}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    onClick={() => selectImport(imp.machine)}
                    title={`${imp.machine} (${imp.session_count} 条对话)`}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
                      padding: '4px var(--s-4)', cursor: 'pointer', fontSize: 12,
                      background: activeSource === imp.machine ? 'var(--primary-glow)' : 'transparent',
                      borderLeft: activeSource === imp.machine ? '3px solid var(--primary)' : '3px solid transparent',
                      color: activeSource === imp.machine ? 'var(--primary)' : 'var(--fg)',
                      fontWeight: activeSource === imp.machine ? 500 : 400,
                    }}>
                    <HardDrive size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imp.machine}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--fg-dim)', flexShrink: 0 }}>
                      {imp.session_count}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteImport(imp.machine)}
                    title="删除导入"
                    style={{
                      background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer',
                      padding: 2, marginRight: 'var(--s-2)', opacity: 0.4,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
                {activeSource === imp.machine && importTree.map(n => renderNode(n, 0, '', imp.machine))}
              </div>
            ))}
          </div>
        )}
      </nav>
      <div style={{ borderTop: '1px solid var(--border-faint)', padding: 'var(--s-3) var(--s-4)' }}>
        <button onClick={() => navigate('/dashboard')} style={{
          width: '100%', padding: '6px 12px', border: 'none', borderRadius: 'var(--r)',
          background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer',
          textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
        }}>
          <BarChart3 size={14} /> 数据仪表盘
        </button>
        <button onClick={onToggleTheme} style={{
          width: '100%', padding: '6px 12px', border: 'none', borderRadius: 'var(--r)',
          background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer',
          textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
        }}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? '浅色模式' : '深色模式'}
        </button>
        <div style={{ marginTop: 'var(--s-2)' }}>
          <input ref={fileInputRef} type="file" accept=".zip" onChange={handleImport} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} style={{
            width: '100%', padding: '6px 12px', border: 'none', borderRadius: 'var(--r)',
            background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer',
            textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          }}>
            <Upload size={14} />             导入其他机器会话
          </button>
        </div>
        <div style={{ marginTop: 'var(--s-2)' }}>
          <button onClick={handleExportAll} style={{
            width: '100%', padding: '6px 12px', border: 'none', borderRadius: 'var(--r)',
            background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer',
            textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          }}>
            <Download size={14} /> 导出本机会话
          </button>
        </div>
        <div style={{ marginTop: 'var(--s-2)' }}>
          <button onClick={() => setShowImportConfig(!showImportConfig)} style={{
            width: '100%', padding: '6px 12px', border: 'none', borderRadius: 'var(--r)',
            background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer',
            textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
          }}>
            <Settings size={14} /> {showImportConfig ? '收起设置' : '高级设置'}
          </button>
        </div>
        {showImportConfig && importConfig && (
          <div style={{
            padding: 'var(--s-3)', marginTop: 'var(--s-1)',
            borderRadius: 'var(--r)', background: 'var(--bg)',
            fontSize: 11, color: 'var(--fg-dim)',
          }}>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>导入目录</div>
            <div style={{
              padding: '4px 8px', borderRadius: 4,
              background: 'var(--surface)', wordBreak: 'break-all',
              marginBottom: 'var(--s-2)',
            }}>
              {importConfig.import_dir}
            </div>
            <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
              <button onClick={() => {
                const path = prompt('输入新的导入目录路径：', importConfig.import_dir);
                if (path && path.trim()) {
                  updateImportConfig(path.trim()).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['import-config'] });
                    queryClient.invalidateQueries({ queryKey: ['imports'] });
                    queryClient.invalidateQueries({ queryKey: ['import-projects'] });
                  }).catch(console.error);
                }
              }} style={{
                fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)',
                borderRadius: 4, background: 'var(--surface)', color: 'var(--fg)', cursor: 'pointer',
              }}>
                更改目录
              </button>
              <button onClick={() => {
                updateImportConfig('data/imports').then(() => {
                  queryClient.invalidateQueries({ queryKey: ['import-config'] });
                  queryClient.invalidateQueries({ queryKey: ['imports'] });
                  queryClient.invalidateQueries({ queryKey: ['import-projects'] });
                }).catch(console.error);
              }} style={{
                fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)',
                borderRadius: 4, background: 'var(--surface)', color: 'var(--fg-dim)', cursor: 'pointer',
              }}>
                恢复默认
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
