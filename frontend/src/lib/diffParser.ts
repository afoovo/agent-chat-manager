import { parsePatch, type ParsedDiff } from 'diff';

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffFile {
  filename: string;
  oldName?: string;
  status: 'modified' | 'added' | 'deleted';
  hunks: {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
  }[];
}

export function parseUnifiedDiff(patchText: string): DiffFile[] {
  if (!patchText || patchText === '[]') return [];
  try {
    const patches: ParsedDiff[] = parsePatch(patchText);
    return patches.map((p) => ({
      filename: p.newFileName ?? p.oldFileName ?? 'unknown',
      oldName: p.oldFileName ?? undefined,
      status: p.oldFileName && !p.newFileName ? 'deleted' as const
        : !p.oldFileName && p.newFileName ? 'added' as const
        : 'modified' as const,
      hunks: (p.hunks ?? []).map((h) => ({
        oldStart: h.oldStart,
        oldLines: h.oldLines,
        newStart: h.newStart,
        newLines: h.newLines,
        lines: h.lines.map((l) => ({
          type: l[0] === '+' ? 'add' as const
            : l[0] === '-' ? 'remove' as const
            : 'context' as const,
          content: l.slice(1),
        })),
      })),
    }));
  } catch {
    return [];
  }
}
