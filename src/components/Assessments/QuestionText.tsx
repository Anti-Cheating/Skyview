import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { TOKENS } from '../../theme';

type Block = { kind: 'text'; text: string } | { kind: 'table'; head: string[]; rows: string[][] };

const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const cells = (line: string) => {
  const parts = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return parts.map((c) => c.trim());
};

/** Split question text into plain text and markdown tables (`a | b` + `--- | ---`). */
export function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => {
    const t = buf.join('\n').replace(/^\n+|\n+$/g, '');
    if (t) blocks.push({ kind: 'text', text: t });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('|') && SEPARATOR.test(lines[i + 1] ?? '')) {
      flush();
      const head = cells(lines[i]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) rows.push(cells(lines[i++]));
      i--;
      blocks.push({ kind: 'table', head, rows });
    } else {
      buf.push(lines[i]);
    }
  }
  flush();
  return blocks;
}

/** **bold** and `code` inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith('`') && part.endsWith('`') && part.length > 2
      ? <Box key={i} component="code" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85em', bgcolor: TOKENS.bg, border: `1px solid ${TOKENS.borderLight}`, borderRadius: '4px', px: 0.5 }}>{part.slice(1, -1)}</Box>
      : part);
}

/** A text block: "# " to "### " lines become headings, the rest stays as written. */
function TextBlock({ text }: { text: string }) {
  const parts: Array<{ h: number; text: string }> = [];
  for (const line of text.split('\n')) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) parts.push({ h: m[1]!.length, text: m[2]! });
    else if (parts.length && parts[parts.length - 1]!.h === 0) parts[parts.length - 1]!.text += `\n${line}`;
    else parts.push({ h: 0, text: line });
  }
  return (
    <>
      {parts.map((p, i) => p.h ? (
        <Typography key={i} sx={{ fontSize: p.h === 1 ? '1.1rem' : p.h === 2 ? '1rem' : '0.92rem', fontWeight: 700, color: TOKENS.textPrimary, mt: i ? 0.5 : 0 }}>{inline(p.text)}</Typography>
      ) : p.text.trim() ? (
        <Typography key={i} sx={{ fontSize: '0.9rem', color: TOKENS.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{inline(p.text.replace(/^\n+|\n+$/g, ''))}</Typography>
      ) : null)}
    </>
  );
}

/** Question text with light markdown: headings, **bold**, `code`, and tables drawn as real tables. */
export function QuestionText({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {parseBlocks(text).map((b, i) =>
        b.kind === 'text' ? (
          <TextBlock key={i} text={b.text} />
        ) : (
          <Box key={i} sx={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: '8px', alignSelf: 'flex-start', maxWidth: '100%' }}>
            <Box component="table" sx={{ borderCollapse: 'collapse', fontSize: '0.85rem', color: TOKENS.textPrimary, '& th, & td': { px: 1.5, py: 0.75, textAlign: 'left', borderBottom: `1px solid ${TOKENS.borderLight}`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }, '& tr:last-of-type td': { borderBottom: 0 } }}>
              <thead>
                <tr>{b.head.map((h, j) => <Box component="th" key={j} sx={{ fontWeight: 600, bgcolor: TOKENS.bg }}>{h}</Box>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => <tr key={j}>{b.head.map((_, k) => <td key={k}>{r[k] ?? ''}</td>)}</tr>)}
              </tbody>
            </Box>
          </Box>
        )
      )}
    </Box>
  );
}
