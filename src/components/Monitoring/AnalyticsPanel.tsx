import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  // useTheme,
  Chip,
  LinearProgress,
  CircularProgress,
  Tooltip,
  Button,
  Collapse,
  Tabs,
  Tab,
  Badge,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  // Circle as CircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Monitor as ScreenIcon,
  Keyboard as KeyboardIcon,
  Mic as VoiceIcon,
  Link as CorrelationIcon,
  Schedule as TimelineIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon,
  CameraAlt as CameraIcon,
  VideoCall as VideoCallIcon,
  FiberManualRecord as DotIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  TrendingFlat as TrendFlatIcon,
  UnfoldMore as UnfoldMoreIcon,
} from '@mui/icons-material';
import type { WindowResult, ModalityRisk, Correlation, UseRiskSocketReturn } from '../../hooks/useRiskSocket';
// CortexService import removed — capture button disabled (interviewer has no local Sentinel)
import PulseAlertBanner from './PulseAlertBanner';
import { ResponsiveContainer, LineChart, Line, Tooltip as RechartsTooltip, ReferenceArea, YAxis } from 'recharts';

interface AnalyticsPanelProps {
  interview?: any;
  riskData: UseRiskSocketReturn;
  // Derived ( transcriptionOn || analysisOn ) — only drives the header
  // "monitoring active" dot/label. Individual toggle state lives below.
  isMonitoring?: boolean;
  transcriptionOn?: boolean;
  analysisOn?: boolean;
  onToggleTranscription?: (next: boolean) => void;
  onToggleAnalysis?: (next: boolean) => void;
  onClose: () => void;
  participantId?: string;
}

/* ── Colors ── */

const BRAND = '#4CD964';
// Skyview light theme — matches the rest of the app (whites + greys)
const DARK_BG = '#FFFFFF';
const DARK_SURFACE = '#F8F9FA';
const DARK_BORDER = '#E5E7EB';
const DARK_TEXT = '#1F2937';
const DARK_TEXT_SECONDARY = '#6B7280';
const DARK_TEXT_MUTED = '#9CA3AF';

function getRiskColor(risk: string): string {
  switch (risk?.toLowerCase()) {
    case 'critical': return '#dc2626';
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#22c55e';
    case 'no': return '#22c55e';
    default: return '#94a3b8';
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#dc2626';
  if (score >= 60) return '#ef4444';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#eab308';
  return '#22c55e';
}

function getConfidenceColor(confidence?: string): string {
  switch (confidence?.toLowerCase()) {
    case 'high': return '#22c55e';
    case 'medium': return '#f59e0b';
    case 'low': return '#ef4444';
    default: return '#94a3b8';
  }
}

function getImpactColor(impact: string): string {
  switch (impact) {
    case 'strong': return '#dc2626';
    case 'moderate': return '#f59e0b';
    case 'weak': return '#eab308';
    default: return '#94a3b8';
  }
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatSignal(signal: string): string {
  return signal.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ── Sub-components ── */

function ModalityCard({ label, icon, modality }: { label: string; icon: React.ReactNode; modality: ModalityRisk }) {
  const [expanded, setExpanded] = useState(false);
  const color = getRiskColor(modality.risk_level);
  const hasDetails = (modality.signals?.length > 0) || (modality.evidence?.length > 0) || modality.summary;

  return (
    <Box sx={{ borderRadius: '8px', border: `1px solid ${color}20`, bgcolor: `${color}08`, overflow: 'hidden' }}>
      <Box
        onClick={() => hasDetails && setExpanded(!expanded)}
        sx={{ px: 1.2, py: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: hasDetails ? 'pointer' : 'default', '&:hover': hasDetails ? { bgcolor: `${color}12` } : {}, transition: 'background 0.15s' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
          <Box sx={{ color, display: 'flex', alignItems: 'center', '& svg': { fontSize: 14 } }}>{icon}</Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: DARK_TEXT }}>{label}</Typography>
          <Chip label={modality.risk_level?.toUpperCase() || 'N/A'} size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: `${color}20`, color, '& .MuiChip-label': { px: 0.5 } }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: getScoreColor(modality.risk_score) }}>{modality.risk_score}</Typography>
          {hasDetails && <Box sx={{ color: DARK_TEXT_MUTED, display: 'flex', '& svg': { fontSize: 16 } }}>{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</Box>}
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 1.2, pb: 1, pt: 0.3 }}>
          {modality.summary && <Typography sx={{ fontSize: '0.675rem', color: DARK_TEXT_SECONDARY, lineHeight: 1.5, mb: 0.6, fontStyle: 'italic' }}>{modality.summary}</Typography>}
          {modality.signals?.length > 0 && (
            <Box sx={{ mb: 0.6 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.4 }}>Signals</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                {modality.signals.map((s, i) => <Chip key={i} label={formatSignal(s)} size="small" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 500, bgcolor: `${color}15`, color, border: `1px solid ${color}25`, '& .MuiChip-label': { px: 0.6 } }} />)}
              </Box>
            </Box>
          )}
          {modality.evidence?.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.3 }}>Evidence</Typography>
              {modality.evidence.map((item, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 0.5, mb: 0.2, alignItems: 'flex-start' }}>
                  <DotIcon sx={{ fontSize: 5, color, mt: '5px', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.625rem', color: DARK_TEXT_SECONDARY, lineHeight: 1.4 }}>{item}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function CorrelationCard({ correlation }: { correlation: Correlation }) {
  const color = getImpactColor(correlation.impact);
  return (
    <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'flex-start', px: 1, py: 0.5, borderRadius: '6px', bgcolor: `${color}10`, border: `1px solid ${color}20` }}>
      <CorrelationIcon sx={{ fontSize: 11, color, mt: '2px', flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '0.625rem', color: DARK_TEXT, lineHeight: 1.4 }}>{correlation.finding}</Typography>
        <Box sx={{ display: 'flex', gap: 0.3, mt: 0.3, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={correlation.impact.toUpperCase()} size="small" sx={{ height: 14, fontSize: '0.45rem', fontWeight: 700, bgcolor: `${color}20`, color, '& .MuiChip-label': { px: 0.4 } }} />
          {correlation.signals_involved?.map((s, i) => (
            <Typography key={i} sx={{ fontSize: '0.55rem', color: DARK_TEXT_SECONDARY }}>{formatSignal(s)}{i < correlation.signals_involved.length - 1 ? ',' : ''}</Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function WindowCard({ result, isLatest, onExpandScreenshot: _onExpandScreenshot }: { result: WindowResult; isLatest: boolean; onExpandScreenshot: (urls: string[], startIndex: number) => void }) {
  const [expanded, setExpanded] = useState(isLatest);
  const color = getRiskColor(result.risk);
  const hasModalities = result.per_modality && (result.per_modality.app_metadata || result.per_modality.keystroke || result.per_modality.voice);
  const hasCorrelations = result.correlations && result.correlations.length > 0;
  const hasExpandable = hasModalities || hasCorrelations || result.timeline_note;

  return (
    <Box sx={{ mb: 0.8, borderRadius: '10px', border: `1px solid ${isLatest ? color + '30' : DARK_BORDER}`, bgcolor: isLatest ? `${color}08` : DARK_SURFACE, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <Box onClick={() => hasExpandable && setExpanded(!expanded)} sx={{ p: 1.2, cursor: hasExpandable ? 'pointer' : 'default', '&:hover': hasExpandable ? { bgcolor: `${color}08` } : {} }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Chip label={result.risk?.toUpperCase()} size="small" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: `${color}20`, color, '& .MuiChip-label': { px: 0.6 } }} />
            {result.confidence && (
              <Tooltip title={`Confidence: ${result.confidence}`} arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                  <ShieldIcon sx={{ fontSize: 11, color: getConfidenceColor(result.confidence) }} />
                  <Typography sx={{ fontSize: '0.55rem', color: getConfidenceColor(result.confidence), fontWeight: 600 }}>{result.confidence}</Typography>
                </Box>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.675rem', color: DARK_TEXT_MUTED }}>{formatTime(result.processed_at)}</Typography>
            {hasExpandable && <Box sx={{ color: DARK_TEXT_MUTED, display: 'flex', '& svg': { fontSize: 16 } }}>{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</Box>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.3 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: getScoreColor(result.score), lineHeight: 1 }}>{result.score}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: DARK_TEXT_MUTED }}>/100</Typography>
          </Box>
          {result.per_modality && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {result.per_modality.app_metadata && <Tooltip title={`Apps: ${result.per_modality.app_metadata.risk_score}`} arrow><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}><ScreenIcon sx={{ fontSize: 11, color: getRiskColor(result.per_modality.app_metadata.risk_level) }} /><Typography sx={{ fontSize: '0.55rem', fontWeight: 600, color: getRiskColor(result.per_modality.app_metadata.risk_level) }}>{result.per_modality.app_metadata.risk_score}</Typography></Box></Tooltip>}
              {result.per_modality.keystroke && <Tooltip title={`Keys: ${result.per_modality.keystroke.risk_score}`} arrow><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}><KeyboardIcon sx={{ fontSize: 11, color: getRiskColor(result.per_modality.keystroke.risk_level) }} /><Typography sx={{ fontSize: '0.55rem', fontWeight: 600, color: getRiskColor(result.per_modality.keystroke.risk_level) }}>{result.per_modality.keystroke.risk_score}</Typography></Box></Tooltip>}
              {result.per_modality.voice && <Tooltip title={`Voice: ${result.per_modality.voice.risk_score}`} arrow><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}><VoiceIcon sx={{ fontSize: 11, color: getRiskColor(result.per_modality.voice.risk_level) }} /><Typography sx={{ fontSize: '0.55rem', fontWeight: 600, color: getRiskColor(result.per_modality.voice.risk_level) }}>{result.per_modality.voice.risk_score}</Typography></Box></Tooltip>}
            </Box>
          )}
        </Box>
        {result.summary && <Typography sx={{ fontSize: '0.675rem', color: DARK_TEXT_SECONDARY, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: expanded ? 5 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{result.summary}</Typography>}
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 1.2, pb: 1.2, pt: 0.2 }}>
          {hasModalities && (
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Breakdown</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {result.per_modality!.app_metadata && <ModalityCard label="Apps" icon={<ScreenIcon />} modality={result.per_modality!.app_metadata} />}
                {result.per_modality!.keystroke && <ModalityCard label="Keystrokes" icon={<KeyboardIcon />} modality={result.per_modality!.keystroke} />}
                {result.per_modality!.voice && <ModalityCard label="Voice" icon={<VoiceIcon />} modality={result.per_modality!.voice} />}
              </Box>
            </Box>
          )}
          {hasCorrelations && (
            <Box sx={{ mb: 0.8 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Correlations</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>{result.correlations!.map((c, i) => <CorrelationCard key={i} correlation={c} />)}</Box>
            </Box>
          )}
          {result.timeline_note && (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', px: 1, py: 0.5, borderRadius: '6px', bgcolor: 'rgba(0,0,0,0.03)' }}>
              <TimelineIcon sx={{ fontSize: 11, color: DARK_TEXT_MUTED, mt: '2px', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.625rem', color: DARK_TEXT_SECONDARY, lineHeight: 1.4 }}>{result.timeline_note}</Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

/* ── Window grouping helpers ── */

interface WindowGroup {
  risk: string;
  windows: WindowResult[];
  startTime: string;
  endTime: string;
}

function buildWindowGroups(results: WindowResult[]): WindowGroup[] {
  if (results.length === 0) return [];
  const groups: WindowGroup[] = [];
  let current: WindowGroup = {
    risk: results[0].risk,
    windows: [results[0]],
    startTime: results[0].processed_at,
    endTime: results[0].processed_at,
  };

  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    if (r.risk?.toLowerCase() === current.risk?.toLowerCase()) {
      current.windows.push(r);
      current.endTime = r.processed_at;
    } else {
      groups.push(current);
      current = { risk: r.risk, windows: [r], startTime: r.processed_at, endTime: r.processed_at };
    }
  }
  groups.push(current);
  return groups;
}

function computeTrend(results: WindowResult[]): { direction: 'up' | 'down' | 'stable'; recentAvg: number; priorAvg: number } {
  if (results.length < 4) return { direction: 'stable', recentAvg: 0, priorAvg: 0 };
  const recent = results.slice(-3);
  const prior = results.slice(-6, -3);
  const recentAvg = Math.round(recent.reduce((s, r) => s + r.score, 0) / recent.length);
  const priorAvg = prior.length > 0 ? Math.round(prior.reduce((s, r) => s + r.score, 0) / prior.length) : recentAvg;
  const diff = recentAvg - priorAvg;
  const direction = diff >= 10 ? 'up' : diff <= -10 ? 'down' : 'stable';
  return { direction, recentAvg, priorAvg };
}

function getTopSignals(results: WindowResult[], max: number = 5): string[] {
  const freq = new Map<string, number>();
  for (const r of results) {
    if (!r.per_modality) continue;
    const allSigs = [
      ...(r.per_modality.app_metadata?.signals || []),
      ...(r.per_modality.keystroke?.signals || []),
      ...(r.per_modality.voice?.signals || []),
    ];
    for (const s of allSigs) freq.set(s, (freq.get(s) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([s]) => s);
}

/* ── Score Timeline Chart ── */

function ScoreTimelineChart({ results }: { results: WindowResult[] }) {
  if (results.length < 2) return null;
  const data = results.map((r) => ({ time: formatTime(r.processed_at), score: r.score }));
  const latestScore = results[results.length - 1].score;

  return (
    <Box sx={{ mt: 0.8, mb: 0.3 }}>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <YAxis domain={[0, 100]} hide />
          <ReferenceArea y1={0} y2={20} fill="#22c55e" fillOpacity={0.06} />
          <ReferenceArea y1={20} y2={40} fill="#eab308" fillOpacity={0.06} />
          <ReferenceArea y1={40} y2={60} fill="#f59e0b" fillOpacity={0.06} />
          <ReferenceArea y1={60} y2={80} fill="#ef4444" fillOpacity={0.06} />
          <ReferenceArea y1={80} y2={100} fill="#dc2626" fillOpacity={0.08} />
          <RechartsTooltip
            contentStyle={{ background: DARK_SURFACE, border: `1px solid ${DARK_BORDER}`, borderRadius: 8, fontSize: '0.7rem', color: DARK_TEXT }}
            labelStyle={{ color: DARK_TEXT_MUTED, fontSize: '0.6rem' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any) => [`${value}`, 'Score']) as any}
          />
          <Line type="monotone" dataKey="score" stroke={getScoreColor(latestScore)} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: getScoreColor(latestScore) }} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

/* ── Rolling Summary Card ── */

function RollingSummaryCard({ results }: { results: WindowResult[] }) {
  if (results.length === 0) return null;
  const latest = results[results.length - 1];
  const trend = computeTrend(results);
  const topSignals = getTopSignals(results);
  const TrendIcon = trend.direction === 'up' ? TrendUpIcon : trend.direction === 'down' ? TrendDownIcon : TrendFlatIcon;
  const trendColor = trend.direction === 'up' ? '#ef4444' : trend.direction === 'down' ? '#22c55e' : DARK_TEXT_MUTED;
  const trendLabel = trend.direction === 'up' ? 'Rising' : trend.direction === 'down' ? 'Declining' : 'Stable';

  return (
    <Box sx={{ mb: 1, borderRadius: '10px', bgcolor: DARK_SURFACE, border: `1px solid ${DARK_BORDER}`, overflow: 'hidden', p: 1.2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: DARK_TEXT_MUTED }}>Summary</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <TrendIcon sx={{ fontSize: 13, color: trendColor }} />
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: trendColor }}>
            {trendLabel}{trend.priorAvg > 0 ? ` (${trend.priorAvg} → ${trend.recentAvg})` : ''}
          </Typography>
        </Box>
      </Box>
      {latest.summary && (
        <Typography sx={{ fontSize: '0.7rem', color: DARK_TEXT_SECONDARY, lineHeight: 1.5, mb: 0.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {latest.summary}
        </Typography>
      )}
      {topSignals.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
          {topSignals.map((s) => (
            <Chip key={s} label={formatSignal(s)} size="small" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 500, bgcolor: 'rgba(0,0,0,0.04)', color: DARK_TEXT_SECONDARY, border: `1px solid ${DARK_BORDER}`, '& .MuiChip-label': { px: 0.6 } }} />
          ))}
        </Box>
      )}
    </Box>
  );
}

/* ── Grouped Window Header ── */

function WindowGroupHeader({ group, isExpanded, onToggle }: { group: WindowGroup; isExpanded: boolean; onToggle: () => void }) {
  const color = getRiskColor(group.risk);
  const count = group.windows.length;
  const timeRange = count === 1
    ? formatTime(group.startTime)
    : `${formatTime(group.startTime)}–${formatTime(group.endTime)}`;

  return (
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.5, mb: 0.4,
        borderRadius: '8px', bgcolor: `${color}08`, border: `1px solid ${color}15`,
        cursor: 'pointer', '&:hover': { bgcolor: `${color}12` }, transition: 'background 0.15s',
      }}
    >
      <Chip label={group.risk?.toUpperCase()} size="small" sx={{ height: 18, fontSize: '0.5rem', fontWeight: 700, bgcolor: `${color}20`, color, '& .MuiChip-label': { px: 0.5 } }} />
      <Typography sx={{ fontSize: '0.65rem', color: DARK_TEXT_SECONDARY, flex: 1 }}>
        {count === 1 ? '1 window' : `${count} windows`} · {timeRange}
      </Typography>
      <UnfoldMoreIcon sx={{ fontSize: 14, color: DARK_TEXT_MUTED, transform: isExpanded ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }} />
    </Box>
  );
}

/* ── Main Component ── */

export default function AnalyticsPanel({
  riskData,
  isMonitoring = false,
  transcriptionOn = false,
  analysisOn = false,
  onToggleTranscription,
  onToggleAnalysis,
  onClose: _onClose,
  participantId: _participantId,
  interview,
}: AnalyticsPanelProps) {
  const { results, latestResult, averageScore, recentScore, highestRisk, isConnected, pulseAlerts, imageAnalysisResults } = riskData;
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const openScreenshotViewer = (urls: string[], startIndex: number) => {
    setLightbox({ urls, index: startIndex });
  };
  const [activeTab, setActiveTab] = useState(0);

  // Group consecutive windows by risk level (in chronological order)
  const windowGroups = useMemo(() => buildWindowGroups(results), [results]);

  // Auto-expand last group when results arrive
  const lastGroupIdx = windowGroups.length - 1;

  const totalSignals = results.reduce((count, r) => {
    if (!r.per_modality) return count;
    return count + (r.per_modality.app_metadata?.signals?.length || 0) + (r.per_modality.keystroke?.signals?.length || 0) + (r.per_modality.voice?.signals?.length || 0);
  }, 0);
  const totalCorrelations = results.reduce((count, r) => count + (r.correlations?.length || 0), 0);

  return (
    <Box sx={{ height: '100%', width: '100%', bgcolor: DARK_BG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ─── Header (status on left, Start/Stop compact on right) ─── */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${DARK_BORDER}`, gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: isConnected ? `${BRAND}18` : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: isConnected ? BRAND : DARK_TEXT_MUTED, ...(isConnected && isMonitoring && { boxShadow: `0 0 8px ${BRAND}` }) }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.813rem', fontWeight: 600, color: DARK_TEXT, lineHeight: 1.2 }}>Risk Analytics</Typography>
            <Typography sx={{ fontSize: '0.625rem', color: DARK_TEXT_SECONDARY, lineHeight: 1.2 }}>
              {isMonitoring ? 'Monitoring active' : isConnected ? 'Connected' : 'Connecting...'}
            </Typography>
          </Box>
        </Box>
        {(onToggleTranscription || onToggleAnalysis) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
            {interview?.provider_metadata?.join_url && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<VideoCallIcon sx={{ fontSize: '14px !important' }} />}
                onClick={() =>
                  window.open(
                    interview.provider_metadata.join_url,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
                sx={{
                  fontSize: '0.7rem',
                  textTransform: 'none',
                  py: 0.5,
                  px: 1.5,
                  borderRadius: '8px',
                  borderColor: DARK_BORDER,
                  color: DARK_TEXT,
                  '&:hover': { borderColor: DARK_TEXT_SECONDARY, bgcolor: 'rgba(0,0,0,0.04)' },
                }}
              >
                Open meeting link
              </Button>
            )}
            <Tooltip
              title={
                !analysisOn
                  ? 'Turn on Analysis to capture screenshots'
                  : riskData.candidateStatus && !riskData.candidateStatus.screen_recording
                  ? 'Screen Recording disabled — captures paused'
                  : riskData.isImageAnalysisProcessing
                  ? 'Previous capture is still being analyzed'
                  : ''
              }
              arrow
              placement="top"
            >
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CameraIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => {
                    riskData.incrementPendingImageAnalysis(1);
                    riskData.emitCaptureScreenshots();
                  }}
                  disabled={!analysisOn || riskData.isImageAnalysisProcessing || (riskData.candidateStatus != null && !riskData.candidateStatus.screen_recording)}
                  sx={{ fontSize: '0.7rem', textTransform: 'none', py: 0.5, px: 1.5, borderRadius: '8px', borderColor: `${BRAND}40`, color: BRAND, '&:hover': { borderColor: BRAND, bgcolor: `${BRAND}12` }, '&.Mui-disabled': { borderColor: DARK_BORDER, color: DARK_TEXT_MUTED } }}
                >
                  Capture
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Stream candidate + interviewer voice to Deepgram. Runs continuously while on." arrow placement="top">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={transcriptionOn}
                    onChange={(_, checked) => onToggleTranscription?.(checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: BRAND },
                    }}
                  />
                }
                label={<Typography sx={{ fontSize: '0.7rem', color: DARK_TEXT }}>Transcription</Typography>}
                sx={{ m: 0 }}
              />
            </Tooltip>
            <Tooltip title="Cortex drives 5s pulse + 30s window analysis while on. Toggle off to pause LLM spend." arrow placement="top">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={analysisOn}
                    onChange={(_, checked) => onToggleAnalysis?.(checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: BRAND },
                    }}
                  />
                }
                label={<Typography sx={{ fontSize: '0.7rem', color: DARK_TEXT }}>Analysis</Typography>}
                sx={{ m: 0 }}
              />
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* ─── Summary Stats ─── */}
      {results.length > 0 && (
        <Box sx={{ px: 2, py: 1.2, borderBottom: `1px solid ${DARK_BORDER}` }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 1, mb: 1 }}>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.2 }}>Recent</Typography>
              <Tooltip title="Average score over the last 5 minutes" arrow>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: getScoreColor(recentScore), lineHeight: 1, cursor: 'default' }}>{recentScore}</Typography>
              </Tooltip>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.2 }}>Session</Typography>
              <Tooltip title="Average score across all windows" arrow>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: getScoreColor(averageScore), lineHeight: 1, cursor: 'default' }}>{averageScore}</Typography>
              </Tooltip>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.2 }}>Risk</Typography>
              <Chip label={highestRisk.toUpperCase()} size="small" sx={{ height: 22, fontSize: '0.6rem', fontWeight: 700, bgcolor: getRiskColor(highestRisk) + '20', color: getRiskColor(highestRisk), mt: 0.2 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.2 }}>Windows</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: DARK_TEXT, lineHeight: 1 }}>{results.length}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: DARK_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.2 }}>Signals</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: totalSignals > 0 ? '#f59e0b' : DARK_TEXT, lineHeight: 1 }}>{totalSignals}</Typography>
            </Box>
          </Box>

          <ScoreTimelineChart results={results} />

          {latestResult && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.6rem', color: DARK_TEXT_SECONDARY }}>Latest</Typography>
                  {latestResult.confidence && (
                    <Tooltip title={`Confidence: ${latestResult.confidence}`} arrow>
                      <Chip icon={<ShieldIcon sx={{ fontSize: '9px !important' }} />} label={latestResult.confidence} size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 600, bgcolor: `${getConfidenceColor(latestResult.confidence)}18`, color: getConfidenceColor(latestResult.confidence), '& .MuiChip-icon': { color: getConfidenceColor(latestResult.confidence), ml: 0.3 }, '& .MuiChip-label': { px: 0.4 } }} />
                    </Tooltip>
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: getScoreColor(latestResult.score) }}>{latestResult.score}/100</Typography>
              </Box>
              <LinearProgress variant="determinate" value={latestResult.score} sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.04)', '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(latestResult.score), borderRadius: 3 } }} />
              {totalCorrelations > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.5 }}>
                  <WarningIcon sx={{ fontSize: 10, color: '#f59e0b' }} />
                  <Typography sx={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 600 }}>{totalCorrelations} correlation{totalCorrelations !== 1 ? 's' : ''} detected</Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* ─── Tab Bar ─── */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: `1px solid ${DARK_BORDER}`,
          '& .MuiTabs-indicator': { bgcolor: BRAND, height: 2 },
          '& .MuiTab-root': {
            minHeight: 36, py: 0.5, fontSize: '0.7rem', fontWeight: 600,
            textTransform: 'none', color: DARK_TEXT_MUTED,
            '&.Mui-selected': { color: BRAND },
          },
        }}
      >
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>Pulse</span>
            {pulseAlerts.length > 0 && (
              <Badge badgeContent={pulseAlerts.length} sx={{ '& .MuiBadge-badge': { bgcolor: '#f59e0b', color: '#000', fontSize: '0.5rem', fontWeight: 700, minWidth: 16, height: 16, right: -6, top: -2 } }}><Box /></Badge>
            )}
          </Box>
        } />
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>Analysis</span>
            {results.length > 0 && (
              <Chip label={results.length} size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: `${BRAND}20`, color: BRAND, '& .MuiChip-label': { px: 0.4 } }} />
            )}
          </Box>
        } />
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>Screenshots</span>
            {imageAnalysisResults.length > 0 && (
              <Chip label={imageAnalysisResults.length} size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: `${BRAND}20`, color: BRAND, '& .MuiChip-label': { px: 0.4 } }} />
            )}
          </Box>
        } />
      </Tabs>

      {/* ─── Tab 0: Pulse ─── */}
      {activeTab === 0 && (
        <Box
          sx={{
            flex: 1, overflow: 'auto', minHeight: 0,
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.15)', borderRadius: '4px' },
          }}
        >
          {pulseAlerts.length > 0 ? (
            <PulseAlertBanner alerts={pulseAlerts} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DotIcon sx={{ fontSize: 14, color: DARK_TEXT_MUTED }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: DARK_TEXT, mb: 0.3 }}>No alerts yet</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: DARK_TEXT_SECONDARY }}>Real-time app &amp; activity detections will appear here</Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ─── Tab 1: Analysis ─── */}
      {activeTab === 1 && (
        <Box
          sx={{
            flex: 1, overflow: 'auto', px: 1.5, py: 1, minHeight: 0,
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.15)', borderRadius: '4px' },
          }}
        >
          {results.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
              {!isConnected ? (
                <>
                  <CircularProgress size={24} thickness={4} sx={{ color: BRAND }} />
                  <Typography sx={{ color: DARK_TEXT_SECONDARY, fontSize: '0.75rem' }}>Connecting...</Typography>
                </>
              ) : (
                <>
                  <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: `${BRAND}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: BRAND, animation: 'panelPulse 2s infinite', '@keyframes panelPulse': { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.4, transform: 'scale(1.2)' } } }} />
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: DARK_TEXT, mb: 0.3 }}>Monitoring active</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: DARK_TEXT_SECONDARY }}>First analysis in ~30 seconds</Typography>
                  </Box>
                </>
              )}
            </Box>
          ) : (
            <>
              {/* Rolling summary */}
              <RollingSummaryCard results={results} />

              {/* Auto analysis results — grouped by risk level */}
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: DARK_TEXT_MUTED, mb: 0.6 }}>Auto Analysis</Typography>
              {[...windowGroups].reverse().map((group, reversedIdx) => {
                const groupIdx = windowGroups.length - 1 - reversedIdx;
                const isLastGroup = groupIdx === lastGroupIdx;
                const isSingleTransition = group.windows.length === 1;
                const isExpanded = isLastGroup || isSingleTransition || expandedGroups.has(groupIdx);

                // Single window: show card directly
                if (group.windows.length === 1) {
                  return (
                    <WindowCard key={group.windows[0].window_id} result={group.windows[0]} isLatest={isLastGroup} onExpandScreenshot={openScreenshotViewer} />
                  );
                }

                // Multi-window group
                return (
                  <Box key={`group-${groupIdx}`} sx={{ mb: 0.4 }}>
                    <WindowGroupHeader
                      group={group}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(groupIdx)) next.delete(groupIdx);
                        else next.add(groupIdx);
                        return next;
                      })}
                    />
                    <Collapse in={isExpanded}>
                      {[...group.windows].reverse().map((result, idx) => (
                        <WindowCard key={result.window_id} result={result} isLatest={isLastGroup && idx === 0} onExpandScreenshot={openScreenshotViewer} />
                      ))}
                    </Collapse>
                  </Box>
                );
              })}
            </>
          )}
        </Box>
      )}

      {/* ─── Tab 2: Screenshots ─── */}
      {activeTab === 2 && (
        <Box
          sx={{
            flex: 1, overflow: 'auto', px: 1.5, py: 1, minHeight: 0,
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.15)', borderRadius: '4px' },
          }}
        >
          {/* Capture button moved to the header row alongside Start/Stop */}

          {/* Screenshot analysis results */}
          {imageAnalysisResults.length > 0 ? (
            <Box>
              {[...imageAnalysisResults].reverse().map((ia) => {
                const iaColor = getRiskColor(ia.risk);
                return (
                  <Box key={ia.analysis_id} sx={{ mb: 0.8, borderRadius: '10px', border: `1px solid ${iaColor}25`, bgcolor: `${iaColor}08`, overflow: 'hidden' }}>
                    <Box sx={{ p: 1.2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CameraIcon sx={{ fontSize: 14, color: iaColor }} />
                          <Chip label={ia.risk?.toUpperCase()} size="small" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: `${iaColor}15`, color: iaColor }} />
                          <Typography sx={{ fontSize: '0.55rem', color: DARK_TEXT_MUTED }}>{ia.image_count} images</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.3 }}>
                          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: getScoreColor(ia.score), lineHeight: 1 }}>{ia.score}</Typography>
                          <Typography sx={{ fontSize: '0.6rem', color: DARK_TEXT_MUTED }}>/100</Typography>
                          <Typography sx={{ fontSize: '0.65rem', color: DARK_TEXT_MUTED, ml: 0.5 }}>{formatTime(ia.processed_at)}</Typography>
                        </Box>
                      </Box>
                      {ia.summary && <Typography sx={{ fontSize: '0.675rem', color: DARK_TEXT_SECONDARY, lineHeight: 1.5, mb: 0.5 }}>{ia.summary}</Typography>}
                      {ia.thumbnail_urls?.length > 0 && (
                        <ThumbnailCarousel urls={ia.thumbnail_urls} onClickThumb={(i) => openScreenshotViewer(ia.thumbnail_urls, i)} />
                      )}
                      {ia.image_signals?.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                          {ia.image_signals.map((s, i) => (
                            <Chip key={i} label={formatSignal(s)} size="small" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 500, bgcolor: `${iaColor}10`, color: iaColor, border: `1px solid ${iaColor}20`, '& .MuiChip-label': { px: 0.6 } }} />
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CameraIcon sx={{ fontSize: 18, color: DARK_TEXT_MUTED }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: DARK_TEXT, mb: 0.3 }}>No screenshots yet</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: DARK_TEXT_SECONDARY }}>Screenshot analysis results will appear here</Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ─── Lightbox modal ─── */}
      {lightbox && (
        <ScreenshotLightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChange={(i) => setLightbox((prev) => prev ? { ...prev, index: i } : null)}
        />
      )}

    </Box>
  );
}

// ── Screenshot lightbox — fullscreen modal with prev/next ────────────

function ScreenshotLightbox({
  urls, index, onClose, onChange,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  const goPrev = () => { if (index > 0) onChange(index - 1); };
  const goNext = () => { if (index < urls.length - 1) onChange(index + 1); };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const arrowBtn = {
    position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)',
    width: 40, height: 40, borderRadius: '50%',
    bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    fontSize: '22px', fontWeight: 700, backdropFilter: 'blur(4px)',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
    transition: 'background 0.15s',
  };

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed', inset: 0, zIndex: 9999,
        bgcolor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Close button */}
      <Box
        onClick={onClose}
        sx={{
          position: 'absolute', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.1)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '18px',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
        }}
      >
        ✕
      </Box>

      {/* Counter */}
      <Box sx={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>
          {index + 1} / {urls.length}
        </Typography>
      </Box>

      {/* Left arrow */}
      {index > 0 && (
        <Box onClick={(e) => { e.stopPropagation(); goPrev(); }} sx={{ ...arrowBtn, left: 16 }}>
          ‹
        </Box>
      )}

      {/* Image */}
      <Box
        component="img"
        src={urls[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        sx={{
          maxWidth: '85vw', maxHeight: '85vh',
          objectFit: 'contain', borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      />

      {/* Right arrow */}
      {index < urls.length - 1 && (
        <Box onClick={(e) => { e.stopPropagation(); goNext(); }} sx={{ ...arrowBtn, right: 16 }}>
          ›
        </Box>
      )}
    </Box>
  );
}

// ── Thumbnail carousel — arrows only when content overflows ──────────

function ThumbnailCarousel({ urls, onClickThumb }: { urls: string[]; onClickThumb: (i: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    el.addEventListener('scroll', checkOverflow, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', checkOverflow); };
  }, [checkOverflow, urls.length]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  const arrowSx = {
    position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)',
    zIndex: 2, width: 28, height: 28, borderRadius: '50%',
    bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    fontSize: '16px', fontWeight: 700, backdropFilter: 'blur(4px)',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
    transition: 'opacity 0.2s',
  };

  return (
    <Box sx={{ position: 'relative', mb: 0.8 }}>
      {showLeft && (
        <Box onClick={() => scroll(-1)} sx={{ ...arrowSx, left: 0 }}>‹</Box>
      )}
      <Box
        ref={scrollRef}
        sx={{
          display: 'flex', gap: 0.8, overflowX: 'auto',
          px: (showLeft || showRight) ? 3.5 : 0,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {urls.map((url, i) => (
          <Box
            key={i}
            component="img"
            src={url}
            alt=""
            onClick={() => onClickThumb(i)}
            sx={{
              width: 160, minWidth: 160, height: 100,
              objectFit: 'cover', borderRadius: '8px',
              border: `1px solid ${DARK_BORDER}`, cursor: 'pointer',
              '&:hover': { opacity: 0.85, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },
              transition: 'opacity 0.15s, box-shadow 0.15s',
            }}
          />
        ))}
      </Box>
      {showRight && (
        <Box onClick={() => scroll(1)} sx={{ ...arrowSx, right: 0 }}>›</Box>
      )}
    </Box>
  );
}
