import { useState } from 'react';
import { X, Tag, Plus } from 'lucide-react';
import { useBookmarks } from '../hooks/useBookmarks';
import { TAG_COLORS } from '../lib/colors';

interface Props {
  sessionId: string;
  currentTags: string[];
  onClose: () => void;
}

export default function TagEditor({ sessionId, currentTags, onClose }: Props) {
  const [tags, setTags] = useState<string[]>([...currentTags]);
  const [input, setInput] = useState('');
  const { updateTags } = useBookmarks();

  const addTag = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setInput('');
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleSave = () => {
    updateTags(sessionId, tags);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 380, background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--border-faint)',
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={14} /> 编辑标签
          </span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: 'var(--fg-dim)', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 'var(--s-4)' }}>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--s-3)' }}>
              {tags.map((tag, i) => (
                <span key={tag} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 12,
                  background: `${TAG_COLORS[i % TAG_COLORS.length]}22`,
                  color: TAG_COLORS[i % TAG_COLORS.length], border: `1px solid ${TAG_COLORS[i % TAG_COLORS.length]}44`,
                }}>
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入标签名..."
              autoFocus
              style={{
                flex: 1, padding: '6px 10px', border: '1px solid var(--border)',
                borderRadius: 'var(--r)', background: 'var(--bg)', color: 'var(--fg)',
                fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={addTag}
              disabled={!input.trim()}
              style={{
                padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r)',
                background: 'var(--bg)', color: input.trim() ? 'var(--fg)' : 'var(--fg-dim)',
                cursor: input.trim() ? 'pointer' : 'default', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Plus size={14} /> 添加
            </button>
          </div>
        </div>

        <div style={{ padding: 'var(--s-3) var(--s-4)', borderTop: '1px solid var(--border-faint)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
          <button
            onClick={onClose}
            style={{
              padding: 'var(--s-2) var(--s-4)', border: '1px solid var(--border)',
              borderRadius: 'var(--r)', background: 'var(--bg)', color: 'var(--fg-muted)',
              cursor: 'pointer', fontSize: 13,
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: 'var(--s-2) var(--s-4)', border: 'none', borderRadius: 'var(--r)',
              background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13,
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
