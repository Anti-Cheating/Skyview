import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import {
  Robot01Icon,
  SecurityWarningIcon,
  Alert02Icon,
  ScreenShareIcon,
  Message01Icon,
  Mortarboard01Icon,
  SourceCodeIcon,
  Search01Icon,
  TranslateIcon,
  Key01Icon,
  Note01Icon,
  Mail01Icon,
  Share01Icon,
  CloudIcon,
  LaptopIcon,
  ClipboardIcon,
  Copy01Icon,
  ArrowLeftRightIcon,
  Camera01Icon,
  EyeOffIcon,
  Cancel01Icon,
  BrowserIcon,
  Link01Icon,
  KeyboardIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons';
import { formatClock } from '../../utils/dateFormat';
import type { PulseAlert, KeyboardAlert } from '../../hooks/useRiskSocket';

// Risk → colour for the keyboard-event feed (matches the app-detection palette).
const KB_RISK_COLOR: Record<string, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#F97316',
  MEDIUM: '#EAB308',
  LOW: '#16A34A',
};

function kbIcon(type: string): IconSvgElement {
  switch (type) {
    case 'screenshot':
    case 'screen_record':
      return Camera01Icon;
    case 'app_switch_storm':
      return ArrowLeftRightIcon;
    case 'select_all_copy':
      return Copy01Icon;
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
const CATEGORY_CONFIG: Record<string, { icon: IconSvgElement; color: string; bg: string }> = {
  cheating_platforms:    { icon: SecurityWarningIcon, color: '#B91C1C', bg: 'rgba(185, 28, 28, 0.12)' },
  ai_tools:              { icon: Robot01Icon,         color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  remote_access:         { icon: ScreenShareIcon,     color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  messaging:             { icon: Message01Icon,       color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  education_platforms:   { icon: Mortarboard01Icon,   color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  code_resources:        { icon: SourceCodeIcon,      color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  search_engines:        { icon: Search01Icon,        color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  translation:           { icon: TranslateIcon,       color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  vpn_proxy:             { icon: Key01Icon,           color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  note_taking:           { icon: Note01Icon,          color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' },
  email:                 { icon: Mail01Icon,          color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' },
  social_media:          { icon: Share01Icon,         color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' },
  cloud_storage:         { icon: CloudIcon,           color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' },
  virtual_machines:      { icon: LaptopIcon,          color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  automation:            { icon: ClipboardIcon,       color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
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
  return CATEGORY_CONFIG[baseId] || { icon: Alert02Icon, color: '#475569', bg: 'rgba(71, 85, 105, 0.10)' };
}

// Activity → icon, label, color mapping. Light-theme palette — same
// severity ladder as CATEGORY_CONFIG above. Foregrounds anchor at
// 600/700-step values so AA contrast holds on the white panel surface.
const ACTIVITY_CONFIG: Record<string, { icon: IconSvgElement; label: string; color: string; bg: string }> = {
  clipboard_paste:           { icon: ClipboardIcon,       label: 'Paste Detected',            color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  clipboard_copy:            { icon: Copy01Icon,          label: 'Copy Detected',             color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  clipboard_paste_frequent:  { icon: ClipboardIcon,       label: 'Frequent Pasting (5+)',     color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  clipboard_paste_heavy:     { icon: ClipboardIcon,       label: 'Heavy Pasting (10+)',       color: '#B91C1C', bg: 'rgba(185, 28, 28, 0.12)' },
  clipboard_paste_excessive: { icon: ClipboardIcon,       label: 'Suspicious Pasting (20+)',  color: '#991B1B', bg: 'rgba(153, 27, 27, 0.14)' },
  clipboard_paste_extreme:   { icon: ClipboardIcon,       label: 'Extreme Pasting (50+)',     color: '#7F1D1D', bg: 'rgba(127, 29, 29, 0.16)' },
  clipboard_copy_frequent:   { icon: Copy01Icon,          label: 'Frequent Copying (5+)',     color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  clipboard_copy_heavy:      { icon: Copy01Icon,          label: 'Heavy Copying (10+)',       color: '#B91C1C', bg: 'rgba(185, 28, 28, 0.12)' },
  clipboard_copy_excessive:  { icon: Copy01Icon,          label: 'Suspicious Copying (20+)',  color: '#991B1B', bg: 'rgba(153, 27, 27, 0.14)' },
  clipboard_copy_extreme:    { icon: Copy01Icon,          label: 'Extreme Copying (50+)',     color: '#7F1D1D', bg: 'rgba(127, 29, 29, 0.16)' },
  app_switching:             { icon: ArrowLeftRightIcon,  label: 'App Switching',             color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  search_launch:             { icon: Search01Icon,        label: 'Search / Launcher',         color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  hide_window:               { icon: EyeOffIcon,          label: 'Window Hidden',             color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  close_window:              { icon: Cancel01Icon,        label: 'Window Closed',             color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
  screenshot:                { icon: Camera01Icon,        label: 'Screenshot Taken',          color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  new_browser_tab:           { icon: BrowserIcon,         label: 'New Browser Tab',           color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  new_browser_window:        { icon: BrowserIcon,         label: 'New Browser Window',        color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  address_bar:               { icon: Link01Icon,          label: 'Address Bar Focused',       color: '#A16207', bg: 'rgba(161, 98, 7, 0.10)' },
  dev_tools:                 { icon: SourceCodeIcon,      label: 'Developer Tools',           color: '#C2410C', bg: 'rgba(194, 65, 12, 0.10)' },
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

function cleanTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/\s*—\s*Trueyy$/i, '')
    .replace(/\s*-\s*Trueyy$/i, '')
    .replace(/\s*—\s*Google Chrome$/i, '')
    .replace(/\s*-\s*Google Chrome$/i, '')
    .trim();
}

function summarizeLabel(label: string): string {
  // If label matches "Rapid app switching (N×): A → B → A → B..."
  const match = label.match(/^(Rapid app switching \(\d+×\)):\s*(.+)$/);
  if (match) {
    const prefix = match[1];
    const chainStr = match[2];
    const steps = chainStr.split('→').map((s) => s.trim()).filter(Boolean);
    const unique = [...new Set(steps)];
    if (unique.length === 2) {
      return `${prefix}: between ${unique[0]} and ${unique[1]}`;
    }
    if (unique.length > 2) {
      if (unique.length <= 4) {
        return `${prefix}: across ${unique.join(', ')}`;
      }
      return `${prefix}: across ${unique.slice(0, 3).join(', ')} +${unique.length - 3} more`;
    }
    if (unique.length === 1) {
      return `${prefix}: in ${unique[0]}`;
    }
  }
  return label;
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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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

  const isTopPriority = (id: string) => id.startsWith('cheating_platforms');

  // Track latest timestamp per activity for chronological placement
  const latestTsByActivity = new Map<string, number>();
  for (const alert of sortedAlerts) {
    const ts = new Date(alert.timestamp).getTime();
    for (const activity of alert.activities) {
      if (activity.startsWith("app_closed:")) continue;
      latestTsByActivity.set(activity, ts);
    }
  }

  // Keyboard alerts
  const allKeyboardAlerts = alerts
    .flatMap((a) => (a.keyboardAlerts ?? []).map((k: KeyboardAlert) => ({ ...k, timestamp: a.timestamp })));

  // Build unified items array so all modalities/events interleave in 100% chronological order
  type UnifiedItem =
    | { type: 'app'; key: string; ts: number; isPriority: boolean; row: AppEventRow }
    | { type: 'keyboard'; key: string; ts: number; isPriority: boolean; alert: KeyboardAlert & { timestamp: string } }
    | { type: 'activity'; key: string; ts: number; isPriority: boolean; activity: string; count: number };

  const appItems: UnifiedItem[] = appEventRows.map((row, i) => ({
    type: 'app',
    key: `app-${row.app}-${row.kind}-${row.ts}-${i}`,
    ts: row.ts,
    isPriority: isTopPriority(row.categoryId),
    row,
  }));

  const keyboardItems: UnifiedItem[] = allKeyboardAlerts.map((k, i) => ({
    type: 'keyboard',
    key: `kb-${k.timestamp}-${k.type}-${i}`,
    ts: new Date(k.timestamp).getTime(),
    isPriority: k.riskLevel === 'CRITICAL' || k.riskLevel === 'HIGH',
    alert: k,
  }));

  const activityItems: UnifiedItem[] = Array.from(activityCounts.entries()).map(([activity, count]) => ({
    type: 'activity',
    key: `act-${activity}`,
    ts: latestTsByActivity.get(activity) ?? 0,
    isPriority: false,
    activity,
    count,
  }));

  // Pure chronological sort: oldest first. When timestamps match, high priority sorts first.
  const unifiedTimeline = [...appItems, ...keyboardItems, ...activityItems].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    return 0;
  });

  if (alerts.length === 0 || unifiedTimeline.length === 0) return null;

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
      {/* Unified chronological timeline feed — all events ordered purely by time */}
      {unifiedTimeline.map((item) => {
        if (item.type === 'app') {
          const row = item.row;
          const config = getConfig(row.categoryId);
          const Icon = config.icon;
          const info = infoByApp.get(row.app.toLowerCase());
          const cleanedTitle = cleanTitle(info?.window_title);

          return (
            <Box
              key={item.key}
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
              {/* Left: App Icon + Status Pill (Open/Closed) + App Name + Category Badge + Minimal Title */}
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
                  <HugeiconsIcon icon={Icon} size={15} color={config.color} />
                </Box>

                {/* Open / Closed pill */}
                <Box
                  sx={{
                    px: 0.6,
                    py: 0.15,
                    borderRadius: '4px',
                    bgcolor: row.kind === 'open' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                    border: `1px solid ${row.kind === 'open' ? 'rgba(22, 163, 74, 0.25)' : 'rgba(107, 114, 128, 0.25)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: row.kind === 'open' ? '#16A34A' : '#6B7280',
                      lineHeight: 1.2,
                    }}
                  >
                    {row.kind === 'open' ? 'Open' : 'Close'}
                  </Typography>
                </Box>

                {/* App Name */}
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: row.kind === 'open' ? '#111827' : '#4B5563',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {row.app}
                </Typography>

                {/* Window Title (with expand option) — BESIDE APP */}
                {row.kind === 'open' && cleanedTitle && (() => {
                  const isExpanded = expandedKeys.has(item.key);
                  const displayTitle = isExpanded
                    ? (info?.window_title || cleanedTitle)
                    : (cleanedTitle.length > 32 ? `${cleanedTitle.slice(0, 30)}...` : cleanedTitle);
                  return (
                    <Box
                      data-testid="pulse-window-title"
                      onClick={() => toggleExpand(item.key)}
                      title={info?.window_title || cleanedTitle}
                      aria-expanded={isExpanded}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        minWidth: 0,
                        maxWidth: isExpanded ? '100%' : { xs: 140, sm: 220, md: 340 },
                        bgcolor: 'rgba(0,0,0,0.03)',
                        px: 0.75,
                        py: 0.2,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.06)',
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.675rem',
                          color: '#4B5563',
                          fontWeight: 500,
                          minWidth: 0,
                          overflow: isExpanded ? 'visible' : 'hidden',
                          textOverflow: isExpanded ? 'clip' : 'ellipsis',
                          whiteSpace: isExpanded ? 'normal' : 'nowrap',
                          wordBreak: isExpanded ? 'break-word' : 'normal',
                        }}
                      >
                        {displayTitle}
                      </Typography>
                      {cleanedTitle.length > 25 && (
                        <Box
                          component="span"
                          role="button"
                          data-testid="expand-title-toggle"
                          aria-label={isExpanded ? 'Collapse title' : 'Expand title'}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: '#9CA3AF',
                            flexShrink: 0,
                            '&:hover': { color: '#4B5563' },
                          }}
                        >
                          <HugeiconsIcon icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon} size={11} color="#6B7280" />
                        </Box>
                      )}
                    </Box>
                  );
                })()}

                {/* Category Badge — BESIDE WINDOW TITLE */}
                <Box
                  sx={{
                    px: 0.75,
                    py: 0.2,
                    borderRadius: '4px',
                    bgcolor: config.bg,
                    border: `1px solid ${config.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
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

                {/* Closed duration (without em-dashes) */}
                {row.kind === 'close' && row.cycleMs != null && (
                  <Typography
                    sx={{
                      fontSize: '0.625rem',
                      color: '#6B7280',
                      bgcolor: 'rgba(0,0,0,0.04)',
                      px: 0.5,
                      py: 0.1,
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    open {formatDuration(row.cycleMs)}
                  </Typography>
                )}

              </Box>

              {/* Right: Formatted Timestamp Only */}
              <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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
        }

        if (item.type === 'keyboard') {
          const k = item.alert;
          const color = KB_RISK_COLOR[k.riskLevel] ?? '#6B7280';
          const KbIcon = kbIcon(k.type);
          const label = summarizeLabel(k.label);

          return (
            <Box
              key={item.key}
              sx={{
                p: 1.25,
                borderRadius: '8px',
                bgcolor: '#FFFFFF',
                border: `1px solid ${color}25`,
                borderLeft: `3px solid ${color}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: `${color}50`,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '6px',
                    bgcolor: `${color}15`,
                    color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <HugeiconsIcon icon={KbIcon} size={15} color={color} />
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#111827',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                {k.riskLevel && k.riskLevel !== 'LOW' && (
                  <Box
                    sx={{
                      px: 0.75,
                      py: 0.2,
                      borderRadius: '4px',
                      bgcolor: `${color}15`,
                      border: `1px solid ${color}30`,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        color,
                        letterSpacing: '0.02em',
                        textTransform: 'uppercase',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {k.riskLevel}
                    </Typography>
                  </Box>
                )}
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    color: '#6B7280',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatClock(k.timestamp)}
                </Typography>
              </Box>
            </Box>
          );
        }

        const actConfig = getActivityConfig(item.activity);
        const ActIcon = actConfig.icon;
        return (
          <Box
            key={item.key}
            sx={{
              p: 1.25,
              borderRadius: '8px',
              bgcolor: '#FFFFFF',
              border: `1px solid ${actConfig.color}25`,
              borderLeft: `3px solid ${actConfig.color}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: `${actConfig.color}50`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '6px',
                  bgcolor: actConfig.bg,
                  color: actConfig.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <HugeiconsIcon icon={ActIcon} size={15} color={actConfig.color} />
              </Box>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#111827',
                  letterSpacing: '0.01em',
                  textTransform: 'uppercase',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {actConfig.label}
              </Typography>
              {item.count > 1 && (
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
                    {item.count}×
                  </Typography>
                </Box>
              )}
            </Box>
            {item.ts > 0 && (
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: '#6B7280',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatClock(item.ts)}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
