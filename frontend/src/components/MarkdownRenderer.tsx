import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeStr = String(children).replace(/\n$/, '');
            if (!match) {
              return <code className="code-inline" {...props}>{children}</code>;
            }
            return (
              <div style={{ borderRadius: 'var(--r)', overflow: 'hidden', margin: 'var(--s-3) 0' }}>
                <div style={{
                  background: 'var(--surface-up)', padding: '2px var(--s-3)',
                  fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)',
                }}>
                  {match[1]}
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: '0 0 var(--r) var(--r)', fontSize: 13 }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              </div>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
