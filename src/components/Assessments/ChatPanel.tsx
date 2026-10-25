import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, InputBase, Tooltip, Typography } from '@mui/material';
import { MdArrowForward, MdSend } from 'react-icons/md';
import { HugeiconsIcon } from '@hugeicons/react';
import { SidebarRight01Icon } from '@hugeicons/core-free-icons';
import trueyyEye from '../../assets/trueyy-e.svg';
import { TOKENS } from '../../theme';
import type { AssessmentMode, ChatEntry } from '../../types/assessment.types';
import { ChatProgressSteps, type TurnProgress } from './ChatProgress';

export const SUGGESTIONS: Record<AssessmentMode, string[]> = {
  live: [
    '10 quant questions, medium, explain the hard ones',
    '5 logical reasoning questions, hard',
    '3 fill in the blank and 2 short answer questions on percentages',
    'A short data interpretation set with a table',
  ],
  take_home: [
    'Build a notes REST API in Node.js with login and tests',
    'Speed up a slow orders API and explain the trade-offs',
  ],
};

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** The Trueyy eye, on a light green disc. */
function AiAvatar({ size = 28 }: { size?: number }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: TOKENS.brandBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <img src={trueyyEye} alt="" aria-hidden draggable={false} style={{ width: Math.round(size * 0.72), height: 'auto' }} />
    </Box>
  );
}

const LONG = 600;

function Bubble({ m, initial }: { m: ChatEntry; initial: string }) {
  const mine = m.role === 'user';
  const long = m.content.length > LONG;
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexDirection: mine ? 'row-reverse' : 'row' }}>
      {mine ? (
        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: TOKENS.brand, color: '#06210f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem', fontWeight: 700 }}>
          {initial}
        </Box>
      ) : <AiAvatar />}
      <Box sx={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 0.25 }}>
        <Box sx={{
          px: 1.5, py: 1, fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          bgcolor: mine ? TOKENS.brandBg : '#fff',
          color: TOKENS.textPrimary,
          border: `1px solid ${mine ? 'transparent' : TOKENS.border}`,
        }}>
          {long && !open ? `${m.content.slice(0, LONG).trimEnd()}…` : m.content}
          {long && (
            <Box component="button" type="button" onClick={() => setOpen(!open)}
              sx={{ all: 'unset', display: 'block', mt: 0.75, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: TOKENS.success, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
              {open ? 'Show less' : 'Show more'}
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: '0.68rem', color: TOKENS.textMuted, px: 0.5 }}>{time(m.at)}</Typography>
      </Box>
    </Box>
  );
}

function Typing({ progress }: { progress?: TurnProgress | null }) {
  if (progress) {
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <AiAvatar />
        <Box sx={{ px: 1.5, py: 1.25, borderRadius: '14px 14px 14px 4px', border: `1px solid ${TOKENS.border}`, bgcolor: '#fff', minWidth: 0, flex: '0 1 auto', maxWidth: '88%' }}>
          <ChatProgressSteps p={progress} />
        </Box>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
      <AiAvatar />
      <Box sx={{ px: 1.5, py: 1.25, borderRadius: '14px 14px 14px 4px', border: `1px solid ${TOKENS.border}`, bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          display: 'flex', gap: '4px',
          '& span': { width: 6, height: 6, borderRadius: '50%', bgcolor: TOKENS.brand, animation: 'asmtDot 1.2s infinite ease-in-out' },
          '& span:nth-of-type(2)': { animationDelay: '0.15s' },
          '& span:nth-of-type(3)': { animationDelay: '0.3s' },
          '@keyframes asmtDot': { '0%, 80%, 100%': { opacity: 0.25, transform: 'translateY(0)' }, '40%': { opacity: 1, transform: 'translateY(-3px)' } },
          '@media (prefers-reduced-motion: reduce)': { '& span': { animation: 'none', opacity: 0.6 } },
        }}>
          <span /><span /><span />
        </Box>
        <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary }}>Thinking…</Typography>
      </Box>
    </Box>
  );
}

/** The builder's chat: fills its column, scrolls on its own, composer pinned to the bottom. */
export function ChatPanel({ mode, chat, busy, progress, blocked, readOnly, message, onMessage, onSend, initial, onHide }: {
  mode: AssessmentMode;
  chat: ChatEntry[];
  /** The AI is answering. */
  busy: boolean;
  /** Live steps of the running turn (null until the first event arrives). */
  progress?: TurnProgress | null;
  /** Another action is running, so sending waits. */
  blocked: boolean;
  readOnly: boolean;
  message: string;
  onMessage: (v: string) => void;
  onSend: (text?: string) => void;
  initial: string;
  /** Collapse the chat so the paper gets the full width. */
  onHide: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, busy]);

  return (
    <Box sx={{
      border: `1px solid ${TOKENS.border}`, borderRadius: '16px', bgcolor: TOKENS.bg, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', height: { xs: 560, md: '100%' }, minHeight: 0,
    }}>
      <Box sx={{ px: 2, py: 1.5, bgcolor: '#fff', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 1.25, flexShrink: 0 }}>
        <AiAvatar />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: TOKENS.textPrimary, lineHeight: 1.2 }}>AI assistant</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: TOKENS.textSecondary }}>Ask for questions or changes</Typography>
        </Box>
        <Tooltip title="Hide chat">
          <IconButton size="small" aria-label="Hide chat" onClick={onHide} sx={{ color: TOKENS.textSecondary, display: { xs: 'none', md: 'inline-flex' } }}>
            <HugeiconsIcon icon={SidebarRight01Icon} size={20} color="currentColor" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, p: 2, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {chat.length === 0 && !busy && (
          <Box sx={{ m: 'auto', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, textAlign: 'center', py: 2 }}>
            <AiAvatar size={48} />
            <Typography sx={{ fontWeight: 700, color: TOKENS.textPrimary }}>What should this paper test?</Typography>
            <Typography sx={{ fontSize: '0.82rem', color: TOKENS.textSecondary }}>
              Describe it in your own words. You can add questions a few at a time and change any of them later.
            </Typography>
            {!readOnly && (
              <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
                {SUGGESTIONS[mode].map((s) => (
                  <Box key={s} component="button" type="button" onClick={() => onSend(s)} disabled={blocked}
                    sx={{
                      all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: '10px',
                      bgcolor: '#fff', border: `1px solid ${TOKENS.border}`, fontSize: '0.82rem', color: TOKENS.textPrimary,
                      '&:hover': { borderColor: TOKENS.brand }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` },
                      '&:disabled': { opacity: 0.5, cursor: 'default' },
                    }}>
                    <Box component="span" sx={{ flex: 1 }}>{s}</Box>
                    <Box component="span" sx={{ color: TOKENS.textMuted, display: 'flex' }}><MdArrowForward /></Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
        {chat.map((m, i) => <Bubble key={i} m={m} initial={initial} />)}
        {busy && <Typing progress={progress} />}
        <div ref={end} />
      </Box>

      {readOnly ? (
        <Typography sx={{ p: 2, fontSize: '0.8rem', color: TOKENS.textSecondary, borderTop: `1px solid ${TOKENS.border}`, bgcolor: '#fff', flexShrink: 0 }}>
          This assessment is finalized, so the paper can't change.
        </Typography>
      ) : (
        <Box sx={{ p: 1.5, bgcolor: '#fff', borderTop: `1px solid ${TOKENS.border}`, flexShrink: 0 }}>
          <Box sx={{
            display: 'flex', alignItems: 'flex-end', gap: 1, border: `1px solid ${TOKENS.border}`, borderRadius: '14px', pl: 1.5, pr: 0.75, py: 0.75,
            '&:focus-within': { borderColor: TOKENS.brand, boxShadow: `0 0 0 3px ${TOKENS.brandBg}` },
          }}>
            <InputBase
              fullWidth multiline maxRows={6} placeholder="Ask for questions or changes…"
              value={message} onChange={(e) => onMessage(e.target.value)} disabled={busy}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              inputProps={{ 'aria-label': 'Message to the AI' }}
              sx={{ fontSize: '0.875rem', py: 0.5 }}
            />
            <Tooltip title="Send">
              <span>
                <IconButton aria-label="Send" onClick={() => onSend()} disabled={!message.trim() || blocked} size="small"
                  sx={{ bgcolor: TOKENS.brand, color: '#06210f', width: 34, height: 34, '&:hover': { bgcolor: TOKENS.brandHover }, '&.Mui-disabled': { bgcolor: TOKENS.borderLight, color: TOKENS.textMuted } }}>
                  <MdSend />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );
}
