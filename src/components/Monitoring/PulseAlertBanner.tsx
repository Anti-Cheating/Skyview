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
import { formatClock } from '../../utils/dateFormat';
import type { PulseAlert, KeyboardAlert } from '../../hooks/useRiskSocket';

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

const CLEAN_APP_NAMES = [
  'google chrome', 'chrome', 'firefox', 'safari',
  'microsoft edge', 'edge', 'opera', 'brave',
  'visual studio code', 'code', 'warp', 'webstorm', 'goland',
  'phpstorm', 'datagrip', 'clion', 'rider', 'jetbrains',
  'android studio', 'sublime', 'neovim', 'zed editor',
  'codesignal', 'codility', 'hackerearth',
];

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

function formatDuration(ms: number): string {
  const diffSec = Math.floor(ms / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ${diffMin % 60}m`;
}

interface AppEventRow {
  app: string;
  ts: number;
  kind: 'open' | 'close';
  categoryId: string;
  categoryLabel: string;
  /** For 'close' rows: length of the open→close cycle that just ended. */
  cycleMs?: number;
}

/**
 * Walks the chronological alert stream once and emits one row per
 * open/close TRANSITION (not a mutated per-app pill) — every open and
 * every close is its own event, stacked in order, matching the same
 * "one row per event" principle as the window Timeline.
 */
function buildAppEventRows(
  sortedAlerts: PulseAlert[],
  stealthAppsSet: Set<string>
): AppEventRow[] {
  const rows: AppEventRow[] = [];
  const openByKey = new Map<string, { ts: number; categoryLabel: string }>();

  for (const alert of sortedAlerts) {
    const ts = new Date(alert.timestamp).getTime();

    for (const detection of alert.detections) {
      for (const app of detection.apps) {
        // If this app is flagged as a stealth overlay (e.g. Aside with is_excluded: true in a mixed set),
        // re-categorize it under cheating_platforms even if historical pulse payload categorized it as general_usage.
        const isStealth = stealthAppsSet.has(app.toLowerCase());
        const effectiveCategoryId = isStealth ? 'cheating_platforms' : detection.categoryId;
        const effectiveCategoryLabel = isStealth ? 'Cheating Platform Detected' : detection.categoryLabel;

        const key = `${effectiveCategoryId}|${app.toLowerCase()}`;
        if (!openByKey.has(key)) {
          openByKey.set(key, { ts, categoryLabel: effectiveCategoryLabel });
          rows.push({
            app,
            ts,
            kind: 'open',
            categoryId: effectiveCategoryId,
            categoryLabel: effectiveCategoryLabel,
          });
        }
      }
    }

    for (const activity of alert.activities) {
      if (!activity.startsWith('app_closed:')) continue;
      const appName = activity.substring('app_closed:'.length);
      const appKey = appName.toLowerCase();
      // A close event carries no category — close the app in every category
      // it's currently open under.
      for (const [key, openData] of openByKey) {
        if (!key.endsWith(`|${appKey}`)) continue;
        openByKey.delete(key);
        rows.push({
          app: appName,
          ts,
          kind: 'close',
          categoryId: key.slice(0, -(appKey.length + 1)),
          categoryLabel: openData.categoryLabel,
          cycleMs: ts - openData.ts,
        });
      }
    }
  }

  return rows;
}

export default function PulseAlertBanner({ alerts, gap = 0.5 }: PulseAlertBannerProps) {
  const activityCounts = new Map<string, number>();

  // Sort alerts chronologically to trace state transitions accurately
  const sortedAlerts = [...alerts].sort((x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime());

  // Map of app_name (lowercase) to its latest info (window_title, is_excluded)
  const infoByApp = new Map<string, { app_name: string; window_title: string; is_excluded: boolean }>();
  for (const alert of sortedAlerts) {
    for (const detection of alert.detections) {
      if (detection.appInfos) {
        for (const info of detection.appInfos) {
          const k = info.app_name.toLowerCase();
          const existing = infoByApp.get(k);
          if (!existing) {
            infoByApp.set(k, { ...info });
          } else {
            if ((info.window_title || '').length > existing.window_title.length) {
              existing.window_title = info.window_title;
            }
            if (info.is_excluded === true) {
              existing.is_excluded = true;
            }
          }
        }
      }
    }
    for (const activity of alert.activities) {
      if (activity.startsWith("app_closed:")) continue;
      activityCounts.set(activity, (activityCounts.get(activity) || 0) + 1);
    }
  }

  // Detect stealth overlay apps (e.g., Aside) that were previously or currently
  // categorized under general_usage. If sharing state is reliable (some windows excluded,
  // some not), any non-clean app with is_excluded=true is escalated to cheating_platforms.
  const allInfos = Array.from(infoByApp.values());
  const totalInfos = allInfos.length;
  const excludedInfos = allInfos.filter((i) => i.is_excluded === true).length;
  const sharingReliable = excludedInfos > 0 && excludedInfos < totalInfos;

  const isCleanApp = (name: string) =>
    CLEAN_APP_NAMES.some((clean) => name.toLowerCase().includes(clean));

  const stealthAppsSet = new Set<string>();
  if (sharingReliable) {
    for (const info of allInfos) {
      if (info.is_excluded === true && !isCleanApp(info.app_name)) {
        stealthAppsSet.add(info.app_name.toLowerCase());
      }
    }
  }

  // Flat chronological open/close event list (one row per transition).
  const appEventRows = buildAppEventRows(sortedAlerts, stealthAppsSet);

  // Sort rows chronologically ("timebuild wise"). If timestamps are equal,
  // cheating platforms & higher risk sort first.
  const isTopPriority = (id: string) => id.startsWith('cheating_platforms');
  const sortedAppRows = [...appEventRows].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    if (isTopPriority(a.categoryId) && !isTopPriority(b.categoryId)) return -1;
    if (!isTopPriority(a.categoryId) && isTopPriority(b.categoryId)) return 1;
    return 0;
  });

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
  if (sortedAppRows.length === 0 && allActivities.length === 0 && allKeyboardAlerts.length === 0) return null;

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
      {/* Individual cards for each app open/close event, ordered chronologically */}
      {sortedAppRows.map((row, i) => {
        const config = getConfig(row.categoryId);
        const Icon = config.icon;
        const info = infoByApp.get(row.app.toLowerCase());
        const label =
          row.kind === 'open'
            ? `opened ${row.app}${info?.window_title ? ` — "${info.window_title}"` : ''}`
            : `closed ${row.app}${
                row.cycleMs != null ? ` — open ${formatDuration(row.cycleMs)}` : ''
              }`;

        return (
          <Box
            key={`${row.app}-${row.kind}-${row.ts}-${i}`}
            data-testid="pulse-event-card"
            sx={{
              p: 1.25,
              borderRadius: '8px',
              bgcolor: '#FFFFFF',
              border: `1px solid ${config.color}25`,
              borderLeft: `3px solid ${config.color}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: `${config.color}50`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              },
            }}
          >
            {/* Left: App Icon + Opened/Closed Label */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '6px',
                  bgcolor: config.bg,
                  color: config.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ fontSize: 15 }} />
              </Box>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: row.kind === 'open' ? 700 : 500,
                  color: row.kind === 'open' ? '#111827' : '#6B7280',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Typography>
            </Box>

            {/* Right: Category badge + Formatted Timestamp */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Box
                sx={{
                  px: 0.75,
                  py: 0.2,
                  borderRadius: '4px',
                  bgcolor: config.bg,
                  border: `1px solid ${config.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: config.color,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.categoryLabel}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: '#6B7280',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatClock(row.ts)}
              </Typography>
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
              {formatClock(k.timestamp)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
