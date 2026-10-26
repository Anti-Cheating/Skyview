/**
 * LiveCamPlayer — the candidate's webcam, live, with the eye arrows.
 *
 * Frames come from the candidate's Sentinel through Cortex (`cam-frame`,
 * never stored). Each frame carries the gaze numbers, and the arrows are
 * drawn here rather than burned into the image so a viewer can switch them
 * off. Shown as Sentinel's mirrored (selfie) view, so an arrow points to
 * the candidate's own side: they look right → it points right.
 *
 * Mini mode floats over the monitoring screen and can be dragged anywhere
 * (position saved per viewer as a fraction of the screen, so it survives a
 * resize). Maximized, the parent lays it out next to the analytics panel.
 */
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  OpenInFull as MaximizeIcon,
  CloseFullscreen as MinimizeIcon,
  Close as CloseIcon,
  Videocam as CamIcon,
  NearMe as ArrowsIcon,
} from '@mui/icons-material';
import type { CamFrame, CameraState } from '../../hooks/useRiskSocket';
import { TOKENS } from '../../theme';

// Same lengths as Sentinel's poc/eye_arrow (gaze_arrow.py), at 720p.
const EYE_ARROW_PX = 250;
const HEAD_ARROW_PX = 150;
const STALE_MS = 3000;
const MARGIN = 16;
const POS_KEY = 'skyview:camPos';
const ARROWS_KEY = 'skyview:camArrows';

const WARNING_TEXT: Record<string, string> = {
  'NO FACE': 'No face',
  'MULTIPLE FACES': 'Multiple faces',
  'HEAD MOVED': 'Head moved',
  'HEAD TURNED': 'Head turned',
  'EYES CLOSED': 'Eyes closed',
  'EYES AWAY': 'Eyes away',
};

const STATE_TEXT: Record<CameraState, string> = {
  starting: 'Starting camera…',
  live: '',
  off: 'Camera off',
  denied: "Camera permission is off on the candidate's computer",
  busy: "Another app is using the candidate's camera",
  error: "The candidate's camera isn't responding",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string, w: number) {
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const head = Math.max(8, len * 0.25);
  const a = Math.atan2(dy, dx);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - head * Math.cos(a - 0.45), y + dy - head * Math.sin(a - 0.45));
  ctx.lineTo(x + dx - head * Math.cos(a + 0.45), y + dy - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

interface LiveCamPlayerProps {
  candidateName: string;
  isConnected: boolean;
  cameraState: CameraState | null;
  onCamFrame: (cb: (f: CamFrame) => void) => () => void;
  watchCamera: (hd: boolean) => void;
  unwatchCamera: () => void;
  maximized: boolean;
  onMaximizedChange: (v: boolean) => void;
}

export default function LiveCamPlayer({
  candidateName,
  isConnected,
  cameraState,
  onCamFrame,
  watchCamera,
  unwatchCamera,
  maximized,
  onMaximizedChange,
}: LiveCamPlayerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const [arrows, setArrows] = useState(() => readJson(ARROWS_KEY, true));
  const arrowsRef = useRef(arrows);
  arrowsRef.current = arrows;
  const [pos, setPos] = useState(() => readJson(POS_KEY, { fx: 1, fy: 1 }));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasFrame, setHasFrame] = useState(false);
  const [stale, setStale] = useState(false);
  const lastFrameAt = useRef(0);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Join the stream while visible; Sentinel sends nothing when nobody watches.
  // Re-joins after a reconnect (rooms don't survive one).
  useEffect(() => {
    if (!isConnected || hidden) return;
    watchCamera(maximized);
    return () => unwatchCamera();
  }, [isConnected, hidden, maximized, watchCamera, unwatchCamera]);

  // Draw each frame as it arrives. Decoding is async, so a slow decode
  // drops frames rather than queueing them.
  useEffect(() => {
    if (!isConnected) return;
    let busy = false;
    return onCamFrame(async (f) => {
      lastFrameAt.current = Date.now();
      setStale(false);
      setHasFrame(true);
      setWarnings((prev) => {
        const next = f.warnings ?? [];
        return prev.join() === next.join() ? prev : next;
      });
      const canvas = canvasRef.current;
      if (busy || !canvas) return;
      busy = true;
      try {
        const bmp = await createImageBitmap(new Blob([f.jpeg], { type: 'image/jpeg' }));
        const { width: w, height: h } = bmp;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Drawn as sent: Sentinel's view is already mirrored (selfie).
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        if (arrowsRef.current) {
          const s = h / 720;
          const lw = Math.max(2, 3 * s);
          if (f.nose && f.head) {
            drawArrow(ctx, f.nose[0] * w, f.nose[1] * h, f.head[0] * HEAD_ARROW_PX * s, f.head[1] * HEAD_ARROW_PX * s, '#3B82F6', lw);
          }
          if (f.eye) {
            for (const [ix, iy] of f.irises ?? []) {
              drawArrow(ctx, ix * w, iy * h, f.eye[0] * EYE_ARROW_PX * s, f.eye[1] * EYE_ARROW_PX * s, '#EF4444', lw);
            }
          }
        }
      } catch {
        /* a bad frame is skipped; the next one redraws */
      } finally {
        busy = false;
      }
    });
  }, [isConnected, onCamFrame]);

  // "No video" after STALE_MS without a frame.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (lastFrameAt.current && Date.now() - lastFrameAt.current > STALE_MS) setStale(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const toggleArrows = () => {
    setArrows((v: boolean) => {
      writeJson(ARROWS_KEY, !v);
      return !v;
    });
  };

  const hide = () => {
    setHidden(true);
    onMaximizedChange(false);
  };

  // ── Drag (mini only). Position = fraction of the free space, so it
  // stays in the same spot relative to the screen across resizes.
  const moveTo = (fx: number, fy: number) => {
    const next = { fx: clamp01(fx), fy: clamp01(fy) };
    setPos(next);
    return next;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (maximized || (e.target as HTMLElement).closest('button')) return;
    const r = rootRef.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    rootRef.current!.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!drag.current || !el || !parent) return;
    const c = parent.getBoundingClientRect();
    const freeX = c.width - 2 * MARGIN - el.offsetWidth;
    const freeY = c.height - 2 * MARGIN - el.offsetHeight;
    moveTo(
      freeX > 0 ? (e.clientX - drag.current.dx - c.left - MARGIN) / freeX : 1,
      freeY > 0 ? (e.clientY - drag.current.dy - c.top - MARGIN) / freeY : 1,
    );
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    writeJson(POS_KEY, pos);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (maximized || e.target !== rootRef.current) return;
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05],
    };
    const d = step[e.key];
    if (!d) return;
    e.preventDefault();
    writeJson(POS_KEY, moveTo(pos.fx + d[0], pos.fy + d[1]));
  };

  if (hidden) {
    return (
      <Box
        component="button"
        type="button"
        onClick={() => setHidden(false)}
        sx={{
          position: 'absolute', right: MARGIN, bottom: MARGIN, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 0.75,
          border: 0, borderRadius: 999, px: 1.75, py: 1, cursor: 'pointer',
          bgcolor: TOKENS.sidebar, color: '#fff', font: 'inherit', fontSize: '0.75rem', fontWeight: 600,
          boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)',
          '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 },
        }}
      >
        <CamIcon sx={{ fontSize: 16 }} /> Show camera
      </Box>
    );
  }

  const overlay = !isConnected
    ? 'Reconnecting…'
    : !cameraState
      ? "Waiting for the candidate's Trueyy Helper…"
      : cameraState !== 'live'
        ? STATE_TEXT[cameraState]
        : !hasFrame
          ? 'Starting camera…'
          : stale
            ? 'No video for a few seconds…'
            : '';
  const isLive = cameraState === 'live' && hasFrame && !stale && isConnected;
  const btnSx = { color: '#fff', bgcolor: 'rgba(255,255,255,0.14)', borderRadius: '6px', p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.26)' } };
  const W = { xs: '220px', sm: '300px', lg: '340px' };

  return (
    <Box
      ref={rootRef}
      tabIndex={maximized ? -1 : 0}
      role="group"
      aria-label={maximized ? `${candidateName}'s camera` : `${candidateName}'s camera. Drag it, or use the arrow keys to move it.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      sx={maximized ? {
        position: 'relative', minWidth: 0, minHeight: 0, height: '100%',
        bgcolor: '#0B110E', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      } : {
        '--cam-w': W,
        position: 'absolute', zIndex: 5, width: 'var(--cam-w)',
        left: `calc(${MARGIN}px + (100% - ${2 * MARGIN}px - var(--cam-w)) * ${pos.fx})`,
        top: `calc(${MARGIN}px + (100% - ${2 * MARGIN}px - var(--cam-w) * 9 / 16) * ${pos.fy})`,
        aspectRatio: '16 / 9', borderRadius: '10px', overflow: 'hidden',
        bgcolor: '#0B110E', cursor: 'grab', touchAction: 'none', userSelect: 'none',
        boxShadow: '0 14px 36px -10px rgba(0,0,0,0.55)',
        '&:active': { cursor: 'grabbing' },
        '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 3 },
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          display: 'block', width: '100%', height: '100%', objectFit: 'contain',
          visibility: hasFrame ? 'visible' : 'hidden',
        }}
      />

      {overlay && (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', px: 2, bgcolor: hasFrame ? 'rgba(0,0,0,0.55)' : 'transparent',
        }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.75rem', fontWeight: 500 }}>{overlay}</Typography>
        </Box>
      )}

      <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', alignItems: 'flex-start', gap: 0.5, pointerEvents: 'none' }}>
        <Box sx={{
          fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: '#fff', px: 0.75, py: 0.25, borderRadius: '4px',
          bgcolor: isLive ? 'rgba(220,38,38,0.92)' : 'rgba(100,110,105,0.9)', display: 'flex', alignItems: 'center', gap: 0.5,
        }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fff' }} />
          {isLive ? 'LIVE' : 'OFF'}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 'auto', alignItems: 'flex-end' }} aria-live="polite">
          {isLive && warnings.map((w) => (
            <Box key={w} sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', bgcolor: 'rgba(220,38,38,0.9)', px: 0.75, py: 0.25, borderRadius: '4px' }}>
              {WARNING_TEXT[w] ?? w}
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{
        position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1, py: 0.6, background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
      }}>
        <Typography noWrap sx={{ flex: 1, color: '#fff', fontSize: '0.72rem', fontWeight: 600 }}>
          {candidateName} <Box component="span" sx={{ opacity: 0.7, fontWeight: 400 }}>· live, not recorded</Box>
        </Typography>
        <Tooltip title={arrows ? 'Hide eye arrows' : 'Show eye arrows'} arrow>
          <IconButton size="small" onClick={toggleArrows} aria-pressed={arrows} aria-label="Eye arrows" sx={{ ...btnSx, opacity: arrows ? 1 : 0.55 }}>
            <ArrowsIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={maximized ? 'Make small' : 'Make large'} arrow>
          <IconButton size="small" onClick={() => onMaximizedChange(!maximized)} aria-label={maximized ? 'Make camera small' : 'Make camera large'} sx={btnSx}>
            {maximized ? <MinimizeIcon sx={{ fontSize: 15 }} /> : <MaximizeIcon sx={{ fontSize: 15 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Hide camera (it keeps running)" arrow>
          <IconButton size="small" onClick={hide} aria-label="Hide camera" sx={btnSx}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
