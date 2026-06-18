/**
 * Activity Explorer — post-interview replay of the captured monitoring data
 * for a COMPLETED interview. Lives as its own top tab next to Basic Info /
 * Analysis. Four monitoring-style tabs (Alerts, Risk Timeline, Image Analysis,
 * Transcript), each lazy-loading its stored data from Cortex with offset/limit
 * pagination + infinite scroll, rendered with the SAME components the live
 * Monitoring panel uses. Data for completed interviews is static, so plain
 * offset/limit paging is stable.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Chip, CircularProgress, Tooltip, Typography } from "@mui/material";
import { ENV } from "../../config/env";
import { getDefaultPagination } from "../../config/constants";
import { ApiService } from "../../services/api.service";
import { TOKENS } from "../../theme";
import PulseAlertBanner from "../Monitoring/PulseAlertBanner";
import { WindowCard, TranscriptFeed, ImageAnalysisCard, ScreenshotLightbox } from "../Monitoring/AnalyticsPanel";
import type { WindowResult, ImageAnalysisResult, PulseAlert, TranscriptFragment } from "../../hooks/useRiskSocket";

const { offset: DEFAULT_OFFSET, limit: PAGE } = getDefaultPagination();
type Tab4 = "pulse" | "window" | "image" | "transcript";
const TABS: { v: Tab4; label: string; tip: string; path: string }[] = [
  { v: "pulse", label: "Alerts", tip: "Risky apps and copy/paste flagged in real time — AI tools, remote access, and VMs.", path: "pulse-events" },
  { v: "window", label: "Risk Timeline", tip: "The candidate's risk score over time, scored every 30 seconds from apps, typing, and voice.", path: "windows" },
  { v: "image", label: "Image Analysis", tip: "Screenshots captured during the interview and what the AI found in them.", path: "image-analysis" },
  { v: "transcript", label: "Transcript", tip: "The interviewer and candidate conversation, transcribed live.", path: "transcript" },
];

// Endpoint path only — ApiService prepends the base URL, adds the auth header,
// and transparently refreshes the access token + retries on a 401.
const endpoint = (sessionId: string, path: string, participantId: string | undefined, limit: number, offset: number) =>
  `/interview-sessions/${sessionId}/${path}?limit=${limit}&offset=${offset}` +
  (participantId ? `&participant_id=${encodeURIComponent(participantId)}` : "");

// ── per-tab total counts (for badges), fetched once ────────────────────────
function useCounts(sessionId?: string, participantId?: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    TABS.forEach(async (t) => {
      try {
        const r = await ApiService.get(endpoint(sessionId, t.path, participantId, 1, 0), undefined, ENV.CORTEX_API_URL);
        if (!cancelled) setCounts((c) => ({ ...c, [t.v]: (r.data as any)?.total ?? 0 }));
      } catch { /* badge just won't show */ }
    });
    return () => { cancelled = true; };
  }, [sessionId, participantId]);
  return counts;
}

// ── generic paginated fetch + infinite scroll ──────────────────────────────
function useInfiniteList<T>(path: string, sessionId?: string, participantId?: string) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(DEFAULT_OFFSET);
  const inflight = useRef(false);
  const hasMore = total === null || items.length < total;

  const loadMore = useCallback(async () => {
    if (!sessionId || inflight.current) return;
    if (total !== null && items.length >= total) return;
    inflight.current = true;
    setLoading(true);
    setError(null);
    try {
      const resp = await ApiService.get(endpoint(sessionId, path, participantId, PAGE, offsetRef.current), undefined, ENV.CORTEX_API_URL);
      const data = (resp.data ?? {}) as { results?: T[]; total?: number };
      const batch = data.results ?? [];
      offsetRef.current += batch.length;
      setItems((prev) => [...prev, ...batch]);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [sessionId, participantId, path, total, items.length]);

  useEffect(() => { if (items.length === 0 && total === null && !inflight.current) loadMore(); /* eslint-disable-next-line */ }, [sessionId]);

  return { items, loading, error, hasMore, loadMore };
}

function ScrollSentinel({ onHit, disabled }: { onHit: () => void; disabled: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (disabled || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) onHit(); }, { rootMargin: "240px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onHit, disabled]);
  return <div ref={ref} style={{ height: 1 }} />;
}

// No inner card — feeds sit directly on the one common surface (like the live
// Monitoring panel), so it reads as unified instead of a box-inside-a-box.
function FeedFrame({ children }: { children: React.ReactNode }) {
  return <Box>{children}</Box>;
}
function FeedStatus({ loading, error, empty, label }: { loading: boolean; error: string | null; empty: boolean; label: string }) {
  if (error) return <Typography sx={{ p: 2, fontSize: 13, color: "#dc2626" }}>Couldn't load {label}: {error}</Typography>;
  if (empty && !loading) return <Typography sx={{ p: 2, fontSize: 13, color: TOKENS.textMuted }}>No {label} recorded for this interview.</Typography>;
  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}><CircularProgress size={20} /></Box>;
  return null;
}

function PulseFeed({ sessionId, participantId }: { sessionId?: string; participantId?: string }) {
  const { items, loading, error, hasMore, loadMore } = useInfiniteList<PulseAlert>("pulse-events", sessionId, participantId);
  return (
    <FeedFrame>
      {items.length > 0 && <PulseAlertBanner alerts={items} gap={1.25} />}
      <FeedStatus loading={loading} error={error} empty={items.length === 0} label="alerts" />
      <ScrollSentinel onHit={loadMore} disabled={!hasMore || loading} />
    </FeedFrame>
  );
}
function WindowFeed({ sessionId, participantId }: { sessionId?: string; participantId?: string }) {
  const { items, loading, error, hasMore, loadMore } = useInfiniteList<WindowResult>("windows", sessionId, participantId);
  return (
    <FeedFrame>
      {items.map((w) => <WindowCard key={w.window_id} result={w} isLatest={false} onExpandScreenshot={() => {}} />)}
      <FeedStatus loading={loading} error={error} empty={items.length === 0} label="risk windows" />
      <ScrollSentinel onHit={loadMore} disabled={!hasMore || loading} />
    </FeedFrame>
  );
}
function ImageFeed({ sessionId, participantId }: { sessionId?: string; participantId?: string }) {
  const { items, loading, error, hasMore, loadMore } = useInfiniteList<ImageAnalysisResult>("image-analysis", sessionId, participantId);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  return (
    <FeedFrame>
      {items.map((ia) => (
        <ImageAnalysisCard key={ia.analysis_id} result={ia} onExpand={(urls, index) => setLightbox({ urls, index })} />
      ))}
      <FeedStatus loading={loading} error={error} empty={items.length === 0} label="image analyses" />
      <ScrollSentinel onHit={loadMore} disabled={!hasMore || loading} />
      {lightbox && (
        <ScreenshotLightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChange={(i) => setLightbox((p) => (p ? { ...p, index: i } : null))}
        />
      )}
    </FeedFrame>
  );
}
interface RawFragment { speaker_role: string; text: string; captured_at: string }
function TranscriptHistFeed({ sessionId, participantId }: { sessionId?: string; participantId?: string }) {
  const { items, loading, error, hasMore, loadMore } = useInfiniteList<RawFragment>("transcript", sessionId, participantId);
  const fragments: TranscriptFragment[] = items.map((r) => ({
    text: r.text, is_final: true, timestamp: r.captured_at, speaker_role: r.speaker_role as TranscriptFragment["speaker_role"],
  }));
  return (
    <FeedFrame>
      {fragments.length > 0 && <TranscriptFeed fragments={fragments} isActive transcriptionOn={false} sessionAnchorIso={null} />}
      <FeedStatus loading={loading} error={error} empty={items.length === 0} label="transcript" />
      <ScrollSentinel onHit={loadMore} disabled={!hasMore || loading} />
    </FeedFrame>
  );
}

// ── main ───────────────────────────────────────────────────────────────────
export default function ActivityExplorer({ sessionId, participantId }: { sessionId?: string; participantId?: string }) {
  const [tab, setTab] = useState<Tab4>("pulse");
  const counts = useCounts(sessionId, participantId);
  return (
    <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start" }}>
      {/* Left rail — vertical nav (distinct from the horizontal top tabs) */}
      <Box sx={{ width: 190, flexShrink: 0, borderRight: `1px solid ${TOKENS.border}`, pr: 1.5, position: "sticky", top: 12 }}>
        {TABS.map((t) => {
          const active = tab === t.v;
          return (
            <Tooltip key={t.v} title={t.tip} placement="right" arrow>
              <Box
                onClick={() => setTab(t.v)}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  px: 1.2, py: 1, mb: 0.5, borderRadius: "8px", cursor: "pointer",
                  fontSize: "0.85rem", fontWeight: 600,
                  color: active ? TOKENS.brand : TOKENS.textSecondary,
                  bgcolor: active ? `${TOKENS.brand}14` : "transparent",
                  borderLeft: `3px solid ${active ? TOKENS.brand : "transparent"}`,
                  transition: "background-color 0.15s",
                  "&:hover": { bgcolor: active ? `${TOKENS.brand}14` : "rgba(0,0,0,0.04)" },
                }}
              >
                <span>{t.label}</span>
                {(counts[t.v] ?? 0) > 0 && (
                  <Chip label={counts[t.v]} size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: active ? `${TOKENS.brand}22` : "rgba(0,0,0,0.06)", color: active ? TOKENS.brand : TOKENS.textMuted, "& .MuiChip-label": { px: 0.6 } }} />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Right — the selected feed */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {tab === "pulse" && <PulseFeed sessionId={sessionId} participantId={participantId} />}
        {tab === "window" && <WindowFeed sessionId={sessionId} participantId={participantId} />}
        {tab === "image" && <ImageFeed sessionId={sessionId} participantId={participantId} />}
        {tab === "transcript" && <TranscriptHistFeed sessionId={sessionId} participantId={participantId} />}
      </Box>
    </Box>
  );
}
