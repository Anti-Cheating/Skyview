import { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import {
  SmartToy as AiIcon,
  Chat as MessagingIcon,
  Code as CodeIcon,
  Search as SearchIcon,
  School as EducationIcon,
  ScreenShare as RemoteIcon,
  NoteAlt as NoteIcon,
  Email as EmailIcon,
  Share as SocialIcon,
  Cloud as CloudIcon,
  DesktopWindows as VmIcon,
  Translate as TranslateIcon,
  VpnKey as VpnIcon,
  ContentPaste as ClipboardIcon,
  ContentCopy as CopyIcon,
  Warning as FallbackIcon,
  SwapHoriz as AppSwitchIcon,
  Screenshot as ScreenshotIcon,
  Visibility as HideIcon,
  Close as CloseIcon,
  Tab as TabIcon,
  OpenInNew as WindowIcon,
  Link as AddressBarIcon,
  DeveloperMode as DevToolsIcon,
  Keyboard as KeyboardIcon,
} from '@mui/icons-material';
import { formatDateTime } from '../../utils/dateFormat';
import type { PulseAlert, PulseDetection, KeyboardAlert } from '../../hooks/useRiskSocket';

// Risk → colour for the keyboard-event feed (matches the app-detection palette).
const KB_RISK_COLOR: Record<string, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#F97316',
  MEDIUM: '#EAB308',
  LOW: '#16A34A',
};

function kbIcon(type: string) {
  switch (type) {
    case 'screenshot':
    case 'screen_record':
      return ScreenshotIcon;
    case 'app_switch_storm':
      return AppSwitchIcon;
    case 'select_all_copy':
      return CopyIcon;
    case 'copy_paste_roundtrip':
    case 'paste_into_ai':
    case 'rapid_paste':
    case 'cut':
      return ClipboardIcon;
    default:
      return KeyboardIcon;
  }
}

interface PulseAlertBannerProps {
  alerts: PulseAlert[];
  /** Vertical gap (MUI spacing units) between alert bands. Default 0.5 keeps
   *  the live monitoring panel tight; the wider Activity Explorer passes more. */
  gap?: number;
}

// Light-theme palette. Was authored against a dark surface (300/400-step
// reds + 8% backgrounds), which read OK on near-black but washes out on
// the white-on-#F8F9FA Skyview surface where this banner now lives.
// Three changes:
//   1. Foreground colours pinned to 600/700 steps so text + icons hit
//      WCAG AA on white.
//   2. Background tints raised from 8–10% → 14–18% so the chip border
//      is actually visible.
//   3. Severity tiers stay the same shape: red = critical/high,
//      orange = medium, yellow = low, slate = neutral/observational.
const CATEGORY_CONFIG: Record<string, { icon: typeof AiIcon; color: string; bg: string }> = {
  cheating_platforms:    { icon: AiIcon,        color: '#B91C1C', bg: 'rgba(185, 28, 28, 0.12)' },
  ai_tools:              { icon: AiIcon,        color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  remote_access:         { icon: RemoteIcon,    color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  messaging:             { icon: MessagingIcon, color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  education_platforms:   { icon: EducationIcon, color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  code_resources:        { icon: CodeIcon,      color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  search_engines:        { icon: SearchIcon,    color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  translation:           { icon: TranslateIcon, color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  vpn_proxy:             { icon: VpnIcon,       color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  note_taking:           { icon: NoteIcon,      color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' },
  email:                 { icon: EmailIcon,     color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' },
  social_media:          { icon: SocialIcon,    color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' },
  cloud_storage:         { icon: CloudIcon,     color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' },
  virtual_machines:      { icon: VmIcon,        color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  automation:            { icon: ClipboardIcon, color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
};

function getConfig(categoryId: string) {
  const baseId = categoryId.includes('::') ? categoryId.split('::')[0] : categoryId;
  return CATEGORY_CONFIG[baseId] || { icon: FallbackIcon, color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' };
}

// Activity → icon, label, color mapping. Light-theme palette — same
// severity ladder as CATEGORY_CONFIG above. Foregrounds anchor at
// 600/700-step values so AA contrast holds on the white panel surface.
const ACTIVITY_CONFIG: Record<string, { icon: typeof AiIcon; label: string; color: string; bg: string }> = {
  clipboard_paste:           { icon: ClipboardIcon,  label: 'Paste Detected',            color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  clipboard_copy:            { icon: CopyIcon,       label: 'Copy Detected',             color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  clipboard_paste_frequent:  { icon: ClipboardIcon,  label: 'Frequent Pasting (5+)',     color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  clipboard_paste_heavy:     { icon: ClipboardIcon,  label: 'Heavy Pasting (10+)',       color: '#B91C1C', bg: 'rgba(185, 28, 28, 0.12)' },
  clipboard_paste_excessive: { icon: ClipboardIcon,  label: 'Suspicious Pasting (20+)',  color: '#991B1B', bg: 'rgba(153, 27, 27, 0.14)' },
  clipboard_paste_extreme:   { icon: ClipboardIcon,  label: 'Extreme Pasting (50+)',     color: '#7F1D1D', bg: 'rgba(127, 29, 29, 0.16)' },
  clipboard_copy_frequent:   { icon: CopyIcon,       label: 'Frequent Copying (5+)',     color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  clipboard_copy_heavy:      { icon: CopyIcon,       label: 'Heavy Copying (10+)',       color: '#B91C1C', bg: 'rgba(185, 28, 28, 0.12)' },
  clipboard_copy_excessive:  { icon: CopyIcon,       label: 'Suspicious Copying (20+)',  color: '#991B1B', bg: 'rgba(153, 27, 27, 0.14)' },
  clipboard_copy_extreme:    { icon: CopyIcon,       label: 'Extreme Copying (50+)',     color: '#7F1D1D', bg: 'rgba(127, 29, 29, 0.16)' },
  app_switching:      { icon: AppSwitchIcon,  label: 'App Switching',        color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  search_launch:      { icon: SearchIcon,     label: 'Search / Launcher',    color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  hide_window:        { icon: HideIcon,       label: 'Window Hidden',        color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  close_window:       { icon: CloseIcon,      label: 'Window Closed',        color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  screenshot:         { icon: ScreenshotIcon, label: 'Screenshot Taken',     color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  new_browser_tab:    { icon: TabIcon,        label: 'New Browser Tab',      color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  new_browser_window: { icon: WindowIcon,     label: 'New Browser Window',   color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  address_bar:        { icon: AddressBarIcon, label: 'Address Bar Focused',  color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  dev_tools:          { icon: DevToolsIcon,   label: 'Developer Tools',      color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
};

function getActivityConfig(activity: string) {
  return ACTIVITY_CONFIG[activity] || {
    icon: KeyboardIcon,
    label: activity.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    color: '#475569',
    bg: 'rgba(71, 85, 105, 0.10)',
  };
}

function formatDuration(firstSeenISO: string): string {
  const diffMs = Date.now() - new Date(firstSeenISO).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ${diffMin % 60}m`;
}

export default function PulseAlertBanner({ alerts, gap = 0.5 }: PulseAlertBannerProps) {
  const [, setTick] = useState(0);

  // Track first-seen timestamp per app (persists across re-renders)
  const appFirstSeen = useRef<Map<string, string>>(new Map());

  // Re-render every 15s so durations update
  useEffect(() => {
    if (alerts.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, [alerts.length]);

  // Aggregate all detections across all alerts
  const allDetections: PulseDetection[] = [];
  const activityCounts = new Map<string, number>();
  const seenCategories = new Set<string>();

  for (const alert of alerts) {
    for (const detection of alert.detections) {
      // Track first-seen time per app
      for (const app of detection.apps) {
        if (!appFirstSeen.current.has(app)) {
          appFirstSeen.current.set(app, alert.timestamp);
        }
      }

      if (!seenCategories.has(detection.categoryId)) {
        seenCategories.add(detection.categoryId);
        allDetections.push(detection);
      } else {
        const existing = allDetections.find((d) => d.categoryId === detection.categoryId);
        if (existing) {
          for (const app of detection.apps) {
            if (!existing.apps.includes(app)) existing.apps.push(app);
          }
        }
      }
    }
    for (const activity of alert.activities) {
      activityCounts.set(activity, (activityCounts.get(activity) || 0) + 1);
    }
  }

  // Cheating platforms always on top
  const isTopPriority = (id: string) => id.startsWith('cheating_platforms');
  allDetections.sort((a, b) =>
    isTopPriority(a.categoryId) ? -1 : isTopPriority(b.categoryId) ? 1 : 0
  );

  // Sorted unique activities with their counts
  const allActivities = Array.from(activityCounts.entries())
    .map(([activity, count]) => ({ activity, count }));

  // Keyboard alerts — a flat chronological FEED, every occurrence (NO dedup).
  // Unlike app detections (deduped per category), each keyboard event is a
  // distinct moment we want the interviewer to see each time it happens.
  const allKeyboardAlerts = alerts
    .flatMap((a) => (a.keyboardAlerts ?? []).map((k: KeyboardAlert) => ({ ...k, timestamp: a.timestamp })))
    .sort((x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime());

  if (alerts.length === 0) return null;
  if (allDetections.length === 0 && allActivities.length === 0 && allKeyboardAlerts.length === 0) return null;

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        gap,
      }}
    >
      {/* App detections by category — always expanded */}
      {allDetections.map((detection) => {
        const config = getConfig(detection.categoryId);
        const Icon = config.icon;

        return (
          <Box
            key={detection.categoryId}
            sx={{
              borderRadius: '8px',
              bgcolor: config.bg,
              border: `1px solid ${config.color}20`,
              overflow: 'hidden',
            }}
          >
            {/* Header row */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.5,
              }}
            >
              <Icon sx={{ fontSize: 14, color: config.color, flexShrink: 0 }} />
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: config.color,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                {detection.categoryLabel}
              </Typography>

              {/* App count badge */}
              <Box
                sx={{
                  minWidth: 16,
                  height: 16,
                  borderRadius: '4px',
                  bgcolor: `${config.color}25`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 0.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: config.color,
                    lineHeight: 1,
                  }}
                >
                  {detection.apps.length}
                </Typography>
              </Box>
            </Box>

            {/* App list — always visible */}
            <Box
              sx={{
                px: 1,
                pb: 0.75,
                pt: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
              }}
            >
              {detection.apps.map((app) => {
                const firstSeen = appFirstSeen.current.get(app);
                return (
                  <Box
                    key={app}
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: '4px',
                      bgcolor: `${config.color}15`,
                      border: `1px solid ${config.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        color: '#1F2937',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {app}
                    </Typography>
                    {firstSeen && (
                      <Typography
                        sx={{
                          fontSize: '0.6rem',
                          fontWeight: 500,
                          color: '#9CA3AF',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        since {formatDateTime(firstSeen)} ({formatDuration(firstSeen)})
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}

      {/* Keyboard & clipboard activities with occurrence counts */}
      {allActivities.map(({ activity, count }) => {
        const actConfig = getActivityConfig(activity);
        const ActIcon = actConfig.icon;
        return (
          <Box
            key={activity}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              py: 0.5,
              borderRadius: '8px',
              bgcolor: actConfig.bg,
              border: `1px solid ${actConfig.color}20`,
            }}
          >
            <ActIcon sx={{ fontSize: 14, color: actConfig.color, flexShrink: 0 }} />
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: actConfig.color,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                flex: 1,
              }}
            >
              {actConfig.label}
            </Typography>
            {count > 1 && (
              <Box
                sx={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: '4px',
                  bgcolor: `${actConfig.color}25`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 0.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: actConfig.color,
                    lineHeight: 1,
                  }}
                >
                  {count}×
                </Typography>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Keyboard event FEED — every occurrence, with app context + time. */}
      {allKeyboardAlerts.map((k, i) => {
        const color = KB_RISK_COLOR[k.riskLevel] ?? '#6B7280';
        const KbIcon = kbIcon(k.type);
        return (
          <Box
            key={`${k.timestamp}-${i}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              py: 0.5,
              borderRadius: '8px',
              bgcolor: `${color}12`,
              border: `1px solid ${color}30`,
            }}
          >
            <KbIcon sx={{ fontSize: 15, color, flexShrink: 0 }} />
            <Typography
              sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#1F2937', flex: 1, minWidth: 0 }}
            >
              {k.label}
            </Typography>
            <Typography
              sx={{ fontSize: '0.6rem', fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {formatDateTime(k.timestamp)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
