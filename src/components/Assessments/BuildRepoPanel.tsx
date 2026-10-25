import { useState } from 'react';
import { Box, CircularProgress, Tab, Tabs, Typography } from '@mui/material';
import { MdDownload, MdErrorOutline, MdExpandLess, MdExpandMore, MdInsertDriveFile } from 'react-icons/md';
import { ActionButton } from '../common/ActionButton';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { ENV } from '../../config/env';
import { STORAGE_KEYS } from '../../config/constants';
import { TOKENS } from '../../theme';
import { starterOf, type AssessmentQuestion, type BuildKey, type RepoFile } from '../../types/assessment.types';

type Part = 'starter' | 'tests';

const PARTS: Array<{ id: Part; label: string; hint: string }> = [
  { id: 'starter', label: 'Starter repo', hint: 'What the candidate gets: it boots with docker compose up, and the parts to build are stubbed.' },
  { id: 'tests', label: 'Hidden attacks', hint: 'One attack file per rubric category, run against every candidate. Candidates never see it.' },
];

/** GET …/repo?part= as a file download (the API needs the bearer token, so no plain link). */
async function download(assessmentId: string, qid: string, part: Part) {
  const r = await fetch(`${ENV.AUTH_API_URL}/assessments/${assessmentId}/questions/${qid}/repo?part=${part}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ?? ''}` },
  });
  if (!r.ok) throw new Error('Could not download the files');
  const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? `${part}.zip`;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Starter repo and hidden attacks of one build task. */
export function BuildRepoPanel({ assessmentId, q }: { assessmentId: string; q: AssessmentQuestion }) {
  const { showError } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<Part>('starter');
  const [file, setFile] = useState(0);
  const [downloading, setDownloading] = useState(false);

  if (q.check_status === 'generating') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, bgcolor: TOKENS.bg, borderRadius: '8px', px: 1.5, py: 1.25 }}>
        <CircularProgress size={16} sx={{ color: TOKENS.brand }} />
        <Typography sx={{ fontSize: '0.85rem', color: TOKENS.textSecondary }}>
          Building the starter repo and the attacks for each rubric category. This takes a few minutes; you can keep chatting.
        </Typography>
      </Box>
    );
  }
  if (q.check_status === 'failed') {
    const err = typeof q.check_answer === 'object' && q.check_answer ? q.check_answer.error : null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, bgcolor: '#FEF2F2', borderRadius: '8px', px: 1.5, py: 1.25, color: '#B91C1C' }}>
        <MdErrorOutline style={{ flexShrink: 0, marginTop: 2 }} />
        <Typography sx={{ fontSize: '0.85rem' }}>
          The starter repo couldn't be generated{err ? `: ${err}` : ''}. Click Regenerate to try again.
        </Typography>
      </Box>
    );
  }

  const key = q.answer_key as BuildKey | null;
  const files: Record<Part, RepoFile[]> = { starter: starterOf(q), tests: key?.tests ?? [] };
  const list = files[part];
  const current = list[Math.min(file, list.length - 1)];

  return (
    <Box sx={{ border: `1px solid ${TOKENS.borderLight}`, borderRadius: '10px', overflow: 'hidden' }}>
      <Box role="button" tabIndex={0} onClick={() => setOpen((v) => !v)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((v) => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, cursor: 'pointer', bgcolor: TOKENS.bg, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: TOKENS.textPrimary, flex: 1 }}>
          Starter repo · {files.starter.length} files · {files.tests.length} hidden attack files
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: TOKENS.success, fontWeight: 600 }}>{open ? 'Hide' : 'View files'}</Typography>
        {open ? <MdExpandLess /> : <MdExpandMore />}
      </Box>

      {open && (
        <Box sx={{ borderTop: `1px solid ${TOKENS.borderLight}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, flexWrap: 'wrap' }}>
            <Tabs value={part} onChange={(_, v) => { setPart(v); setFile(0); }} sx={{ minHeight: 40, flex: 1, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: '0.82rem' }, '& .MuiTabs-indicator': { bgcolor: TOKENS.brand } }}>
              {PARTS.map((p) => <Tab key={p.id} value={p.id} label={`${p.label} (${files[p.id].length})`} />)}
            </Tabs>
            <ActionButton size="small" variant="secondary" startIcon={<MdDownload />} loading={downloading}
              onClick={async () => {
                setDownloading(true);
                try { await download(assessmentId, q.id, part); } catch (e: any) { showError(e?.message || 'Could not download the files'); } finally { setDownloading(false); }
              }}>
              Download .zip
            </ActionButton>
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: TOKENS.textSecondary, px: 1.5, pb: 1 }}>{PARTS.find((p) => p.id === part)!.hint}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(0,1fr)' }, borderTop: `1px solid ${TOKENS.borderLight}`, height: { md: 420 } }}>
            <Box sx={{ overflowY: 'auto', maxHeight: { xs: 180, md: 'none' }, borderRight: { md: `1px solid ${TOKENS.borderLight}` }, py: 0.5 }}>
              {list.map((f, i) => (
                <Box key={f.path} role="button" tabIndex={0} onClick={() => setFile(i)} onKeyDown={(e) => e.key === 'Enter' && setFile(i)} title={f.path}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, fontSize: '0.78rem', cursor: 'pointer',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    bgcolor: current?.path === f.path ? TOKENS.brandBg : 'transparent', color: TOKENS.textPrimary,
                    '&:hover': { bgcolor: current?.path === f.path ? TOKENS.brandBg : TOKENS.bg },
                  }}>
                  <MdInsertDriveFile style={{ flexShrink: 0, color: TOKENS.textMuted }} />
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.path}</Box>
                </Box>
              ))}
            </Box>
            <Box component="pre" sx={{
              m: 0, p: 1.5, overflow: 'auto', maxHeight: { xs: 360, md: 'none' }, fontSize: '0.76rem', lineHeight: 1.55,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', bgcolor: '#FBFCFD', color: TOKENS.textPrimary, whiteSpace: 'pre',
            }}>
              {current?.content ?? 'No files.'}
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: key?.starter_check && !key.starter_check.booted ? '#B91C1C' : TOKENS.textMuted, px: 1.5, py: 1, borderTop: `1px solid ${TOKENS.borderLight}` }}>
            {!key?.starter_check
              ? 'Generated by AI. The starter is checked to boot only when the sandbox is on.'
              : key.starter_check.booted
              ? `Checked in the sandbox: the starter boots with docker compose up${key.starter_check.rounds ? ` (fixed in ${key.starter_check.rounds} round${key.starter_check.rounds > 1 ? 's' : ''})` : ''}. The attacks run on each candidate's repo.`
              : `The starter didn't boot in the sandbox${key.starter_check.error ? `: ${key.starter_check.error}` : ''}. Regenerate it before inviting candidates.`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
