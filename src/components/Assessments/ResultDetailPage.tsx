import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Chip, CircularProgress, Typography } from '@mui/material';
import { MdCancel, MdCheckCircle, MdExpandLess, MdExpandMore, MdRefresh, MdVideoCall } from 'react-icons/md';
import dayjs from 'dayjs';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useAuth } from '../../contexts/AuthContext';
import { isCompanyManagerRole } from '../../config/constants';
import { Breadcrumb } from '../common/Breadcrumb';
import { ActionButton } from '../common/ActionButton';
import { Caption, PageTitle, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { Assessment, AssessmentResultDetail, TimelineItem } from '../../types/assessment.types';
import { QuestionText } from './QuestionText';
import { FORMAT_LABEL } from './QuestionDialogs';
import { INTEGRITY_WHY, IntegrityPicker, changedText, createInterviewUrl, fullName, gradingTag, minutes, timeTaken } from './ResultsTab';
import { formatDuration } from './AssessmentsListPage';
import { AssignTakeHome } from './AssignTakeHome';

const LETTERS = 'ABCDEF';
const RED_BG = '#FEF2F2';

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: `1px solid ${TOKENS.border}`, borderRadius: '12px', p: 2, minWidth: 0 }}>
      <Caption sx={{ color: TOKENS.textSecondary, display: 'block', mb: 0.5 }}>{label}</Caption>
      <Box sx={{ fontSize: '1.5rem', fontWeight: 700, color: TOKENS.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</Box>
      {sub && <Caption sx={{ color: TOKENS.textMuted }}>{sub}</Caption>}
    </Box>
  );
}

type Q = AssessmentResultDetail['questions'][number];

function Verdict({ q }: { q: Q }) {
  if (q.is_correct == null) return null;
  return q.is_correct ? (
    <Chip size="small" icon={<MdCheckCircle />} label={q.match_note === 'ai_match' ? 'Correct · matched by AI' : 'Correct'}
      sx={{ bgcolor: TOKENS.brandBg, color: TOKENS.success, fontWeight: 600, '& .MuiChip-icon': { color: TOKENS.success } }} />
  ) : (
    <Chip size="small" icon={<MdCancel />} label={q.answer == null || q.answer === '' ? 'Not answered' : 'Wrong'}
      sx={{ bgcolor: RED_BG, color: '#B91C1C', fontWeight: 600, '& .MuiChip-icon': { color: '#B91C1C' } }} />
  );
}

/** What a proven bug-hunt finding costs, as a share of its category (matches Cortex SEVERITY_DEDUCT). */
const SEVERITY_SHARE = { critical: 0.5, high: 0.25, medium: 0.1, low: 0 } as const;
const SEVERITY_COLOR = { critical: '#B91C1C', high: '#C2410C', medium: '#B45309', low: TOKENS.textSecondary } as const;

const RECOMMENDATION_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  'Strong Yes': { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Yes': { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  'Needs Discussion': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  'No': { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};

/** The AI review's verdict for a build task: executive evaluation, plain summary, business risks, and commit link. */
function BuildReviewNote({ q, repo }: { q: Q; repo: string }) {
  const r = q.review;
  if (!r) return <Caption sx={{ color: TOKENS.textSecondary }}>The AI review of the repo runs with grading.</Caption>;
  if (r.error) return <Caption sx={{ color: '#B91C1C' }}>The AI review couldn't run: {r.error}</Caption>;
  const recStyle = r.recommendation ? RECOMMENDATION_COLOR[r.recommendation] || { bg: TOKENS.bg, text: TOKENS.textPrimary, border: TOKENS.border } : null;

  return (
    <Box sx={{ border: `1px solid ${TOKENS.borderLight}`, borderRadius: '12px', p: 2, bgcolor: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Top Header & Recommendation */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: TOKENS.textPrimary }}>Executive Evaluation</Typography>
          {r.sha && (
            <Caption sx={{ color: TOKENS.textSecondary }}>
              commit <Box component="a" href={`${repo.replace(/\/$/, '')}/tree/${r.sha}`} target="_blank" rel="noopener noreferrer" sx={{ color: TOKENS.success, fontFamily: 'monospace', fontWeight: 600 }}>{r.sha.slice(0, 7)}</Box>
            </Caption>
          )}
        </Box>
        {r.recommendation && recStyle && (
          <Chip
            size="small"
            label={`Recommendation: ${r.recommendation}`}
            sx={{ bgcolor: recStyle.bg, color: recStyle.text, border: `1px solid ${recStyle.border}`, fontWeight: 700, fontSize: '0.78rem' }}
          />
        )}
      </Box>

      {/* Sandbox status */}
      {r.run && (
        <Caption sx={{ display: 'block', fontWeight: 600, color: r.run.booted ? TOKENS.textPrimary : '#B91C1C' }}>
          {r.run.booted
            ? `Sandbox verification: ${r.run.passed}/${r.run.total} security & functional checks survived.`
            : `Didn't start in sandbox: ${r.run.error ?? 'docker compose up failed'}`}
        </Caption>
      )}

      {/* Main Plain-Text Summary */}
      <Typography sx={{ fontSize: '0.875rem', color: TOKENS.textPrimary, lineHeight: 1.5 }}>
        {r.summary}
      </Typography>

      {/* Strengths & Concerns Grid */}
      {((r.strengths && r.strengths.length > 0) || (r.concerns && r.concerns.length > 0)) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mt: 0.5 }}>
          {r.strengths && r.strengths.length > 0 && (
            <Box sx={{ bgcolor: '#fff', border: `1px solid #E5E7EB`, borderLeft: '3px solid #10B981', borderRadius: '8px', p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10B981' }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#065F46', letterSpacing: '0.06em' }}>
                  Validated Strengths
                </Typography>
              </Box>
              <Box component="ul" sx={{ m: 0, pl: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {r.strengths.map((s, idx) => (
                  <Typography component="li" key={idx} sx={{ fontSize: '0.82rem', color: TOKENS.textPrimary }}>
                    {s}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          {r.concerns && r.concerns.length > 0 && (
            <Box sx={{ bgcolor: '#fff', border: `1px solid #E5E7EB`, borderLeft: '3px solid #F59E0B', borderRadius: '8px', p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#F59E0B' }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#92400E', letterSpacing: '0.06em' }}>
                  Identified Risks & Flaws
                </Typography>
              </Box>
              <Box component="ul" sx={{ m: 0, pl: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {r.concerns.map((c, idx) => (
                  <Typography component="li" key={idx} sx={{ fontSize: '0.82rem', color: TOKENS.textPrimary }}>
                    {c}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Live Interview Questions */}
      {r.interview_questions && r.interview_questions.length > 0 && (
        <Box sx={{ bgcolor: '#F8FAFC', border: `1px solid #E2E8F0`, borderLeft: '3px solid #3B82F6', borderRadius: '8px', p: 1.5, mt: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#3B82F6' }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#1E40AF', letterSpacing: '0.06em' }}>
              Recommended Live Interview Questions
            </Typography>
          </Box>
          <Box component="ol" sx={{ m: 0, pl: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {r.interview_questions.map((qText, idx) => (
              <Typography component="li" key={idx} sx={{ fontSize: '0.82rem', color: '#1E293B' }}>
                "{qText}"
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {/* Collapsed boot logs */}
      {r.run?.logs && (
        <Box component="details" sx={{ mt: 0.5 }}>
          <Box component="summary" sx={{ cursor: 'pointer', fontSize: '0.75rem', color: TOKENS.textSecondary }}>Container boot logs</Box>
          <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, bgcolor: TOKENS.bg, borderRadius: '6px', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto' }}>{r.run.logs}</Box>
        </Box>
      )}
    </Box>
  );
}

const KIND_LABEL: Record<string, string> = {
  happy: 'Normal use', unhappy: 'Bad input', edge: 'Edge case', abuse: 'Abuse attempt', real_world: 'Real-world',
};

/** "concurrency: [abuse] parallel_create_tampered_user_id" → { kind: "Abuse attempt", title: "parallel create tampered user id" } */
function prettyAttack(name: string): { kind?: string; title: string } {
  const m = /^[^:]*:\s*\[(\w+)\]\s*(.*)$/.exec(name);
  const kind = m ? KIND_LABEL[m[1]!] : undefined;
  const body = (m ? m[2]! : name.replace(/^[^:]*:\s*/, '')).replace(/[_-]+/g, ' ').trim();
  return { ...(kind ? { kind } : {}), title: body || name };
}

/** Turn a raw assertion error into a plain line; drop diff noise and jargon. */
function prettyError(err?: string): string | null {
  if (!err) return null;
  const e = err.trim();
  if (/fetch failed|ECONNREFUSED|socket hang up/i.test(e)) return "the app didn't respond";
  if (/did not come back healthy|never returned 200|didn't start/i.test(e)) return "the app didn't recover";
  if (/didn't report|timed out|crashed/i.test(e)) return "the attack timed out";
  // "duplicate note IDs detected 1 !== 20" → "duplicate note IDs detected (got 1, expected 20)"
  const cmp = /^(.*?)\s+(-?\d+)\s*!==\s*(-?\d+)\s*$/.exec(e);
  if (cmp) return `${cmp[1]!.trim()} (got ${cmp[2]}, expected ${cmp[3]})`;
  // Drop node:assert diff dumps ("+ actual - expected + '...' - '...' ^")
  const head = e.split(/\s*\+ actual| - expected|\n/)[0]!.trim();
  return head.length > 4 ? head.slice(0, 160) : e.slice(0, 160);
}

function QuestionResult({ q, single }: { q: Q; single: boolean }) {
  const marks = q.rubric_marks ?? [];
  const got = marks.reduce((s, m) => s + (m.not_scored ? 0 : m.earned), 0), max = marks.reduce((s, m) => s + (m.not_scored ? 0 : m.points), 0);
  const text = typeof q.answer === 'string' ? q.answer : null;
  return (
    <Box sx={{ bgcolor: '#fff', border: `1px solid ${TOKENS.border}`, borderRadius: '12px', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {!single && <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mr: 0.5 }}>Q{q.order}</Typography>}
        <Chip size="small" label={FORMAT_LABEL[q.format]} sx={{ bgcolor: TOKENS.borderLight, fontWeight: 600 }} />
        <Chip size="small" label={q.topic} sx={{ bgcolor: TOKENS.borderLight }} />
        <Chip size="small" label={q.difficulty} sx={{ bgcolor: TOKENS.borderLight, textTransform: 'capitalize' }} />
        <Verdict q={q} />
        {marks.length > 0 && <Chip size="small" label={`Rubric ${got}/${max}`} sx={{ bgcolor: TOKENS.borderLight, fontWeight: 600 }} />}
        <Box sx={{ flex: 1 }} />
        {/* Build tasks are worked on in their repo, so time on this page means nothing. */}
        {q.format !== 'build' && <Caption sx={{ color: TOKENS.textSecondary }}>Time spent: {minutes(q.time_ms)}</Caption>}
      </Box>

      {/* A build task's brief is long and already on the paper; the result shows only how they did. */}
      {q.format !== 'build' && <QuestionText text={q.prompt} />}

      {q.format === 'mcq' && q.options && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.75 }}>
          {q.options.map((o, i) => {
            const key = i === q.answer_key, picked = i === q.answer;
            return (
              <Box key={i} sx={{
                display: 'flex', gap: 1, alignItems: 'flex-start', px: 1.25, py: 0.75, borderRadius: '8px', fontSize: '0.85rem',
                bgcolor: key ? TOKENS.brandBg : picked ? RED_BG : TOKENS.bg, fontWeight: key || picked ? 600 : 400,
                border: `1px solid ${picked ? (key ? TOKENS.brand : '#FCA5A5') : 'transparent'}`,
              }}>
                <Box component="span" sx={{ color: TOKENS.textSecondary, minWidth: 16 }}>{LETTERS[i]}</Box>
                <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{o}</Box>
                {picked && <Caption sx={{ color: key ? TOKENS.success : '#B91C1C', fontWeight: 700, whiteSpace: 'nowrap' }}>Their pick</Caption>}
                {key && !picked && <Caption sx={{ color: TOKENS.success, fontWeight: 700, whiteSpace: 'nowrap' }}>Answer key</Caption>}
              </Box>
            );
          })}
        </Box>
      )}

      {q.format !== 'mcq' && (
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <Box sx={{ bgcolor: TOKENS.bg, borderRadius: '8px', px: 1.5, py: 1 }}>
            <Caption sx={{ color: TOKENS.textSecondary, display: 'block', mb: 0.25 }}>
              {q.format === 'build' ? (q.deliverable_type && q.deliverable_type !== 'code' ? 'Deliverable Submission' : 'Their repo') : 'Their answer'}
            </Caption>
            {q.format === 'build' && text ? (
              <Typography component="a" href={text} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.875rem', color: TOKENS.success, fontWeight: 600, overflowWrap: 'anywhere' }}>{text}</Typography>
            ) : (
              <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: text ? TOKENS.textPrimary : TOKENS.textMuted }}>{text || (q.format === 'build' ? 'No submission provided' : 'Not answered')}</Typography>
            )}
            {q.deliverable_files && q.deliverable_files.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                {q.deliverable_files.map((f, fi) => (
                  <Chip key={fi} size="small" label={`${f.name}${f.size ? ` (${Math.round(f.size / 1024)} KB)` : ''}`} variant="outlined" sx={{ borderRadius: '6px' }} />
                ))}
              </Box>
            )}
          </Box>
          {q.format === 'build' && (text || (q.deliverable_files && q.deliverable_files.length > 0)) && <BuildReviewNote q={q} repo={text || 'Uploaded deliverable files'} />}
          {Array.isArray(q.answer_key) && (
            <Caption sx={{ color: TOKENS.textSecondary }}>Answer key: {q.answer_key.join(' · ')}</Caption>
          )}
        </Box>
      )}

      {q.format !== 'written' && q.format !== 'build' && marks.length > 0 && (
        <Box sx={{ bgcolor: TOKENS.bg, borderRadius: '8px', px: 1.5, py: 1 }}>
          <Caption sx={{ color: TOKENS.textSecondary, display: 'block', mb: 0.25 }}>Their explanation</Caption>
          <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: q.explanation ? TOKENS.textPrimary : TOKENS.textMuted }}>{q.explanation || 'Left blank'}</Typography>
        </Box>
      )}

      {marks.length > 0 && (
        <Box sx={{ border: `1px solid ${TOKENS.borderLight}`, borderRadius: '8px', overflow: 'hidden' }}>
          {marks.map((m, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px', gap: 1, px: 1.5, py: 1.25, borderTop: i ? `1px solid ${TOKENS.borderLight}` : 'none' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: TOKENS.textPrimary }}>{m.criterion.split(':')[0]}</Typography>
                {m.criterion.includes(':') && <Caption sx={{ color: TOKENS.textMuted, display: 'block' }}>{m.criterion.split(':').slice(1).join(':').trim()}</Caption>}
                {m.tests && (
                  <Caption sx={{ display: 'block', fontWeight: 600, color: m.tests.passed === m.tests.total ? TOKENS.success : '#B45309' }}>
                    {m.tests.passed === m.tests.total
                      ? `Held up against all ${m.tests.total} checks`
                      : `Broke on ${m.tests.total - m.tests.passed} of ${m.tests.total} checks`}
                  </Caption>
                )}
                {/* Plain-English evaluation text for interviewers */}
                {(m.plain_explanation || m.reason) && (
                  <Typography sx={{ fontSize: '0.84rem', color: TOKENS.textPrimary, mt: 0.5, lineHeight: 1.4 }}>
                    {m.plain_explanation || m.reason}
                  </Typography>
                )}
                {/* Real-world business impact callout */}
                {m.business_impact && (
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', bgcolor: '#FFFBEB', border: '1px solid #FEF3C7', borderLeft: '3px solid #F59E0B', borderRadius: '4px', px: 1.25, py: 0.6, mt: 0.75 }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#92400E', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      Risk Impact:
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: '#78350F', lineHeight: 1.4 }}>
                      {m.business_impact}
                    </Typography>
                  </Box>
                )}

                {/* Collapsed Technical Attack Details for Engineers */}
                {(!!m.failed?.length || !!m.findings?.length || !!m.evidence?.length) && (
                  <Box component="details" sx={{ mt: 1 }}>
                    <Box component="summary" sx={{ cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: TOKENS.textSecondary, '&:hover': { color: TOKENS.textPrimary } }}>
                      Technical attack details & code traces {m.failed?.length ? `(${m.failed.length} checks failed)` : ''}
                    </Box>
                    <Box sx={{ pl: 1, pt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {!!m.failed?.length && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                          {m.failed.map((f, j) => {
                            const a = prettyAttack(f.name); const why = prettyError(f.error);
                            return (
                              <Box key={j} sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline' }}>
                                <Box component="span" sx={{ color: '#B91C1C', fontWeight: 700 }}>✕</Box>
                                <Box sx={{ minWidth: 0 }}>
                                  {a.kind && <Box component="span" sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: TOKENS.textMuted, mr: 0.75 }}>{a.kind}</Box>}
                                  <Box component="span" sx={{ fontSize: '0.84rem', color: TOKENS.textPrimary }}>{a.title}</Box>
                                  {why && <Caption sx={{ display: 'block', color: TOKENS.textSecondary }}>{why}</Caption>}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                      {!!m.findings?.length && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
                          {m.findings.map((f, j) => (
                            <Box key={j} sx={{ borderLeft: `3px solid ${SEVERITY_COLOR[f.severity]}`, pl: 1, display: 'grid', gap: 0.25 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                <Box component="span" sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: SEVERITY_COLOR[f.severity] }}>{f.severity}</Box>
                                <Typography component="span" sx={{ fontSize: '0.82rem', fontWeight: 600, color: TOKENS.textPrimary }}>{f.title}</Typography>
                                <Caption sx={{ color: TOKENS.textSecondary }}>
                                  {f.in_category ? (SEVERITY_SHARE[f.severity] ? `−${Math.round(SEVERITY_SHARE[f.severity] * m.points * 10) / 10} pts` : 'no deduction') : 'outside this category, not scored'}
                                </Caption>
                              </Box>
                              <Caption sx={{ color: TOKENS.textSecondary }}>Breaks: “{f.violates}”{f.why ? ` · ${f.why}` : ''}</Caption>
                              {!!f.evidence?.length && text && q.review?.sha && (
                                <Caption sx={{ color: TOKENS.textSecondary }}>
                                  {f.evidence.map((e, k) => (
                                    <Box key={k} component="a" href={`${text.replace(/\/$/, '')}/blob/${q.review!.sha}/${e.file}#L${e.line}`} target="_blank" rel="noopener noreferrer"
                                      sx={{ color: TOKENS.success, fontWeight: 600, fontFamily: 'monospace', textDecoration: 'none', mr: 1, '&:hover': { textDecoration: 'underline' } }}>
                                      {e.file}:{e.line}
                                    </Box>
                                  ))}
                                </Caption>
                              )}
                              <Box component="details">
                                <Box component="summary" sx={{ cursor: 'pointer', fontSize: '0.75rem', color: TOKENS.textSecondary }}>Proving attack (failed twice)</Box>
                                <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, bgcolor: TOKENS.bg, borderRadius: '6px', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflowY: 'auto' }}>{f.code}</Box>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                      {!!m.attack_bugs?.length && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                          {m.attack_bugs.map((x, j) => (
                            <Caption key={j} sx={{ color: TOKENS.textSecondary }}>Not counted: {x.attack} (the attack's own code failed) · {x.error}</Caption>
                          ))}
                        </Box>
                      )}
                      {!!m.set_aside?.length && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                          {m.set_aside.map((x, j) => (
                            <Caption key={j} sx={{ color: TOKENS.textSecondary }}>
                              Not counted: {x.attack} (it required {x.expected}, which the brief doesn't ask for) · {x.why}
                            </Caption>
                          ))}
                        </Box>
                      )}
                      {!!m.evidence?.length && text && q.review?.sha && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                          {m.evidence.map((e, j) => (
                            <Caption key={j} sx={{ color: TOKENS.textSecondary }}>
                              <Box component="a" href={`${text.replace(/\/$/, '')}/blob/${q.review!.sha}/${e.file}#L${e.line}`} target="_blank" rel="noopener noreferrer"
                                sx={{ color: TOKENS.success, fontWeight: 600, fontFamily: 'monospace', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                {e.file}:{e.line}
                              </Box>
                              {` · ${e.note}`}
                            </Caption>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
              {m.not_scored ? (
                <Caption sx={{ textAlign: 'right', color: TOKENS.textMuted }}>Not scored</Caption>
              ) : (
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: m.earned >= m.points ? TOKENS.success : m.earned > 0 ? '#B45309' : '#B91C1C' }}>
                  {m.earned}/{m.points}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** Why the scoreboard trusts (or discounts) this attempt. */
const LEVEL_WORD = { critical: 'Critical', high: 'High risk', review: 'Review', clean: 'Clean', none: 'No Helper' } as const;

/** The Trueyy Helper report: verdict (as the editable tag), summary, the moments that decided it. */
function IntegrityCard({ r, assessmentId, onChanged }: { r: AssessmentResultDetail; assessmentId: string; onChanged: (d: AssessmentResultDetail) => void }) {
  const it = r.integrity;
  const pending = it.report_status === 'pending';
  const [open, setOpen] = useState(true); // the header (verdict, effect, who changed it) always shows
  const effect = pending ? '' : it.factor === 0 ? 'Score set to 0 on the scoreboard.' : it.factor < 1 ? `Score × ${it.factor} on the scoreboard.` : 'No change to the score.';
  return (
    <Box sx={{ bgcolor: '#fff', border: `1px solid ${pending ? TOKENS.border : it.level === 'critical' || it.level === 'high' ? '#FCA5A5' : it.level === 'review' ? '#FDE68A' : TOKENS.border}`, borderRadius: '12px', p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{it.report_status ? 'Trueyy Helper report' : 'Integrity'}</Typography>
        <IntegrityPicker assessmentId={assessmentId} attemptId={r.id} it={it} onChanged={onChanged} />
        <Caption sx={{ color: TOKENS.textSecondary, flex: 1, minWidth: 0 }}>{effect}{it.overridden ? ` The report says ${LEVEL_WORD[it.auto_level]}.` : ''}</Caption>
        <Box component="button" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Hide the report' : 'Show the report'}
          sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', fontSize: '1.25rem', color: TOKENS.textSecondary, borderRadius: '6px', '&:hover': { color: TOKENS.textPrimary }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
          {open ? <MdExpandLess /> : <MdExpandMore />}
        </Box>
      </Box>
      {it.changed && <Caption sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{changedText(it.changed)}</Caption>}

      {open && pending && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={14} sx={{ color: TOKENS.brand }} />
          <Secondary sx={{ color: TOKENS.textSecondary }}>Writing the report from the timeline below. This takes a few seconds.</Secondary>
        </Box>
      )}
      {open && r.report && (
        <>
          <Typography sx={{ fontSize: '0.9rem', color: TOKENS.textPrimary, lineHeight: 1.6 }}>{r.report.summary}</Typography>
          {r.report.evidence.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {r.report.evidence.map((e, i) => (
                <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 1, fontSize: '0.85rem' }}>
                  <Box sx={{ color: TOKENS.textSecondary, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{e.at}</Box>
                  <Box sx={{ color: TOKENS.textPrimary }}>{e.text}</Box>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
      {open && it.report_status === 'failed' && (
        <Secondary sx={{ color: '#92400E' }}>The report couldn't be written, so the level comes from the Helper's alerts ({LEVEL_WORD[it.signals_level]}). Use Grade again to retry.</Secondary>
      )}
      {open && !it.report_status && (
        <Secondary sx={{ color: TOKENS.textSecondary }}>
          {it.reasons.length ? it.reasons.map((x) => x.text).join(' · ') : 'Take-home: no Trueyy Helper. Answer timing looked normal.'}
        </Secondary>
      )}
    </Box>
  );
}

const DOT: Record<TimelineItem['kind'], string> = {
  start: TOKENS.brand, submit: TOKENS.brand, answer: '#9CA3AF', app: '#B91C1C', keyboard: '#B45309', activity: '#B45309', voice: '#2563EB', audio: '#2563EB',
  focus: '#7C3AED', closed: '#D1D5DB',
};
const KIND: Record<TimelineItem['kind'], string> = {
  start: 'Start', submit: 'Submit', answer: 'Answer', app: 'App', keyboard: 'Keyboard', activity: 'Activity', voice: 'Voice', audio: 'Computer audio',
  focus: 'Focus', closed: 'Closed',
};

/** Everything in order from Start, like the interview report's activity feed. */
function Timeline({ items }: { items: TimelineItem[] }) {
  const [open, setOpen] = useState(false); // collapsed by default; the report above summarises it
  if (!items.length) return null;
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  const flagged = items.filter((t) => t.kind === 'app' || t.kind === 'keyboard' || t.kind === 'activity' || t.kind === 'voice' || t.kind === 'audio').length;
  return (
    <Box sx={{ bgcolor: '#fff', border: `1px solid ${TOKENS.border}`, borderRadius: '12px', p: 2 }}>
      <Box component="button" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Hide the timeline' : 'Show the timeline'}
        sx={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, borderRadius: '8px', '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Timeline</Typography>
          <Caption sx={{ color: TOKENS.textSecondary, display: 'block' }}>
            {items.length} events{flagged ? ` · ${flagged} from the Trueyy Helper` : ''} · apps, keyboard, voice and every answer, from Start
          </Caption>
        </Box>
        <Box component="span" sx={{ display: 'flex', fontSize: '1.25rem', color: TOKENS.textSecondary }}>{open ? <MdExpandLess /> : <MdExpandMore />}</Box>
      </Box>
      {open && <Box component="ol" sx={{ listStyle: 'none', m: 0, mt: 1.5, p: 0, position: 'relative', '&::before': { content: '""', position: 'absolute', left: 61, top: 6, bottom: 6, width: '2px', bgcolor: TOKENS.borderLight } }}>
        {items.map((t, i) => {
          const severe = /^(HIGH|CRITICAL)$/i.test(t.risk ?? '');
          return (
            <Box component="li" key={i} sx={{ display: 'grid', gridTemplateColumns: '48px 28px minmax(0,1fr)', alignItems: 'start', py: 0.5, position: 'relative' }}>
              <Box sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary, fontVariantNumeric: 'tabular-nums', pt: '1px' }}>{mmss(t.t_ms)}</Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: '5px' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.kind === 'answer' ? (t.ok ? TOKENS.success : t.ok === false ? '#F87171' : '#9CA3AF') : DOT[t.kind], boxShadow: '0 0 0 3px #fff', zIndex: 1 }} />
              </Box>
              <Box sx={{ fontSize: '0.85rem', minWidth: 0, overflowWrap: 'anywhere' }}>
                <Box component="span" sx={{ color: TOKENS.textSecondary, fontWeight: 600, mr: 0.75 }}>{KIND[t.kind]}</Box>
                <Box component="span" sx={{ color: severe ? '#B91C1C' : TOKENS.textPrimary, fontWeight: severe ? 600 : 400 }}>{t.text}</Box>
              </Box>
            </Box>
          );
        })}
      </Box>}
    </Box>
  );
}

/** /assessments/:id/results/:aid — one candidate's full result. */
export default function ResultDetailPage() {
  const { id = '', aid = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const [a, setA] = useState<Assessment | null>(null);
  const [r, setR] = useState<AssessmentResultDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [regrading, setRegrading] = useState(false);

  useEffect(() => {
    Promise.all([AssessmentService.get(id), AssessmentService.result(id, aid)])
      .then(([x, y]) => { setA(x.data ?? null); setR(y.data ?? null); })
      .catch((e) => setErr(e?.message || 'Could not load this result'));
  }, [id, aid]);

  // Keep checking while grading is still running.
  useEffect(() => {
    if (!r || ((r.grading_status === 'done' || r.grading_status === 'failed') && r.integrity.report_status !== 'pending')) return;
    const t = setInterval(() => AssessmentService.result(id, aid).then((y) => y.data && setR(y.data)).catch(() => undefined), 4000);
    return () => clearInterval(t);
  }, [aid, id, r]);

  if (err) return <Box sx={{ p: 3 }}><Alert severity="error">{err}</Alert></Box>;
  if (!a || !r) return <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress sx={{ color: TOKENS.brand }} /></Box>;

  const name = fullName(r.candidate) || r.candidate.email;
  const correct = r.questions.filter((q) => q.is_correct).length;
  const keyed = r.questions.filter((q) => q.is_correct != null).length;
  const totalMs = r.questions.reduce((s, q) => s + q.time_ms, 0);
  const regrade = async () => {
    setRegrading(true);
    try {
      const y = await AssessmentService.regrade(id, aid);
      if (y.data) setR(y.data);
      showSuccess('Graded again');
    } catch (e: any) {
      showError(e?.message || 'Could not grade again');
    } finally {
      setRegrading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Breadcrumb items={[{ label: 'Assessments', to: '/assessments' }, { label: a.title, to: `/assessments/${a.id}?tab=results` }, { label: name }]} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <PageTitle sx={{ color: TOKENS.textPrimary }}>{name}</PageTitle>
            {fullName(r.candidate) && <Secondary sx={{ color: TOKENS.textSecondary }}>{r.candidate.email}</Secondary>}
          </Box>
          {gradingTag(r)}
          <Box sx={{ flex: 1 }} />
          {a.mode !== 'take_home' && <ActionButton variant="secondary" startIcon={<MdRefresh />} onClick={regrade} loading={regrading} disabled={r.status !== 'submitted'}>Grade again</ActionButton>}
          {/* Next step after an aptitude test; a take-home result goes straight to an interview. */}
          {r.status === 'submitted' && a.mode !== 'take_home' && <AssignTakeHome variant="button" candidate={r.candidate} excludeId={a.id} />}
          {isCompanyManagerRole(user?.role) && r.status === 'submitted' && (
            <ActionButton startIcon={<MdVideoCall />} onClick={() => navigate(createInterviewUrl(a, r))}>Create interview</ActionButton>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, minmax(0,1fr))' }, gap: 1.5 }}>
        <Stat label="Score" value={r.final_score == null ? '—' : `${Math.round(r.final_score)}/100`}
          sub={r.score != null && INTEGRITY_WHY[r.integrity.level]
            ? `${Math.round(r.score)} × ${r.integrity.factor} · ${INTEGRITY_WHY[r.integrity.level]!.toLowerCase()}`
            : '70% reasoning · 30% accuracy'} />
        <Stat label="Accuracy" value={r.accuracy == null ? '—' : `${Math.round(r.accuracy)}%`} sub={keyed ? `${correct} of ${keyed} correct` : 'No keyed questions'} />
        <Stat label="Reasoning" value={r.reasoning == null ? '—' : `${Math.round(r.reasoning)}%`} sub="Rubric marks" />
        {a.mode === 'take_home'
          ? <Stat label="Time taken" value={minutes(timeTaken(a.mode, { time_ms: totalMs, started_at: r.started_at, submitted_at: r.submitted_at }))}
              sub={`${formatDuration('take_home', a.duration_min)} window`} />
          : <Stat label="Time taken" value={minutes(totalMs)} sub={`Limit ${a.duration_min} min`} />}
        <Stat label="Submitted" value={r.submitted_at ? dayjs(r.submitted_at).format('h:mm A') : '—'}
          sub={[r.submitted_at && dayjs(r.submitted_at).format('D MMM YYYY'), r.started_at && `Started ${dayjs(r.started_at).format(dayjs(r.started_at).isSame(r.submitted_at ?? r.started_at, 'day') ? 'h:mm A' : 'h:mm A, D MMM')}`].filter(Boolean).join(' · ') || undefined} />
      </Box>

      {r.grading_status === 'failed' && (
        <Alert severity="warning" sx={{ borderRadius: '10px' }}>Grading didn't finish for this candidate.{a.mode !== 'take_home' && ' Click Grade again to retry.'}</Alert>
      )}

      {/* Take-home has no Trueyy Helper: no integrity report, no timeline. */}
      {a.mode !== 'take_home' && <IntegrityCard r={r} assessmentId={a.id} onChanged={setR} />}
      {a.mode !== 'take_home' && <Timeline items={r.timeline} />}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {r.questions.map((q) => <QuestionResult key={q.id} q={q} single={r.questions.length === 1} />)}
      </Box>
    </Box>
  );
}
