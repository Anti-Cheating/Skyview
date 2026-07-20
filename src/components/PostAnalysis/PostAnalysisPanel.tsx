import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowBack as BackIcon, ContentCopy as CopyIcon, FileDownload as ExportIcon } from "@mui/icons-material";
import { ENV } from "../../config/env";
import { STORAGE_KEYS } from "../../config/constants";
import { MOCK_ANALYSIS_SCENARIOS, type MockScenario } from "../../mockData/postAnalysisMock";
import { InterviewService } from "../../services/interview.service";
import { refreshAccessToken } from "../../services/api.service";
import type { InterviewSession } from "../../types/interview.types";
import "./PostAnalysisPanel.css";

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Render a summary (newline-joined "- bullet" string) as a clean list instead
 * of one flat paragraph. A short leading "Label:" is shown in bold so sections
 * read as headings. Same data, nicer layout. */
function renderBullet(line: string) {
  const m = line.match(/^([^:]{2,28}):\s+(.+)$/s);
  return m ? (<><strong>{m[1]}:</strong> {m[2]}</>) : <>{line}</>;
}
function Bullets({ text, empty, className }: { text?: string; empty: string; className?: string }) {
  const lines = String(text ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return <p className={className}>{empty}</p>;
  if (lines.length === 1) return <p className={className}>{renderBullet(lines[0]!)}</p>;
  return (
    <ul className={className} style={{ margin: 0, paddingLeft: 18 }}>
      {lines.map((l, i) => (
        <li key={i} style={{ margin: "3px 0" }}>{renderBullet(l)}</li>
      ))}
    </ul>
  );
}

function getInitials(first?: string, last?: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ── Transcript parser + chat renderer ────────────────────────────────────────
type ChatRole = "interviewer" | "candidate" | "divider";
interface ChatEntry {
  role: ChatRole;
  text: string;
  windowNum?: number;
}

function parseTranscript(raw: string): ChatEntry[] {
  if (!raw?.trim()) return [];

  const entries: ChatEntry[] = [];
  // Tokenise: split on role prefixes and window markers
  // Handles: "Interviewer: ...", "Candidate: ...", "[Window N]"
  const tokenRegex = /(\[Window\s*(\d+)\]|Interviewer\s*:|Candidate\s*:)/gi;
  const parts = raw.split(tokenRegex).filter(s => s !== undefined);

  let currentRole: "interviewer" | "candidate" | null = null;
  let i = 0;
  while (i < parts.length) {
    const part = parts[i].trim();
    if (!part) { i++; continue; }

    const windowMatch = part.match(/^\[Window\s*(\d+)\]$/i);
    if (windowMatch) {
      // Skip window markers — don't show them in the chat
      currentRole = null;
      i++;
      continue;
    }
    if (/^Interviewer\s*:$/i.test(part)) { currentRole = "interviewer"; i++; continue; }
    if (/^Candidate\s*:$/i.test(part))   { currentRole = "candidate";   i++; continue; }

    // Plain text — belongs to the current role
    if (currentRole && part) {
      // Text may contain embedded "Interviewer:" / "Candidate:" inline — split again
      const inline = part.split(/(?=Interviewer\s*:|Candidate\s*:)/i);
      for (const seg of inline) {
        const interviewerInline = seg.match(/^Interviewer\s*:\s*([\s\S]*)/i);
        const candidateInline   = seg.match(/^Candidate\s*:\s*([\s\S]*)/i);
        if (interviewerInline) {
          const txt = interviewerInline[1].trim();
          if (txt) entries.push({ role: "interviewer", text: txt });
          currentRole = "interviewer";
        } else if (candidateInline) {
          const txt = candidateInline[1].trim();
          if (txt) entries.push({ role: "candidate", text: txt });
          currentRole = "candidate";
        } else {
          const txt = seg.trim();
          if (txt) entries.push({ role: currentRole, text: txt });
        }
      }
    }
    i++;
  }

  // If nothing parsed (plain text, no role tags), treat whole thing as one block
  if (entries.length === 0 && raw.trim()) {
    entries.push({ role: "candidate", text: raw.trim() });
  }

  return entries;
}

// Mirrors the live-monitoring Transcript tab (AnalyticsPanel TranscriptFeed):
// interviewer bubbles on the right in brand green, candidate on the left in
// neutral grey, WhatsApp-style run grouping — the speaker label only appears
// on the first bubble of each run, but shows the actual participant name
// instead of the generic "Interviewer"/"Candidate" role.
const TranscriptChat: React.FC<{
  transcript: string;
  candidateName: string;
  interviewerName: string;
}> = ({ transcript, candidateName, interviewerName }) => {
  const entries = parseTranscript(transcript);

  if (entries.length === 0) {
    return <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No transcript available.</p>;
  }

  return (
    <div className="tc-feed">
      {entries.map((entry, idx) => {
        if (entry.role === "divider") {
          return (
            <div key={idx} className="tc-divider">
              <span className="tc-divider-label">{entry.text}</span>
            </div>
          );
        }

        const isInterviewer = entry.role === "interviewer";
        // First bubble of a run — look back past dividers for the previous speaker.
        let prevRole: ChatRole | null = null;
        for (let j = idx - 1; j >= 0; j--) {
          if (entries[j].role !== "divider") { prevRole = entries[j].role; break; }
        }
        const isNewSpeaker = prevRole !== entry.role;
        const side = isInterviewer ? "interviewer" : "candidate";

        return (
          <div key={idx} className={`tc-msg-row tc-msg-row-${side}${isNewSpeaker ? " tc-msg-row-new" : ""}`}>
            <div className="tc-msg-col">
              {isNewSpeaker && (
                <span className={`tc-msg-label tc-msg-label-${side}`}>
                  {isInterviewer ? interviewerName : candidateName}
                </span>
              )}
              <p className={`tc-msg-bubble tc-msg-bubble-${side}${isNewSpeaker ? " tc-msg-bubble-first" : ""}`}>
                {entry.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Speedometer gauge (pure SVG, no deps) ────────────────────────────────────
const RiskGauge: React.FC<{ score: number; level: string; riskColor: string }> = ({
  score, level, riskColor,
}) => {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 180); return () => clearTimeout(t); }, [score]);

  const cx = 150, cy = 155, R = 120, ir = 84;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const pt = (deg: number, r: number): [number, number] => [
    cx + r * Math.cos(toRad(deg)), cy - r * Math.sin(toRad(deg)),
  ];
  const arc = (a1: number, a2: number, fill: string) => {
    const [x1, y1] = pt(a1, R), [x2, y2] = pt(a2, R);
    const [x3, y3] = pt(a2, ir), [x4, y4] = pt(a1, ir);
    return <path fill={fill} d={`M${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} L${x3},${y3} A${ir},${ir} 0 0,0 ${x4},${y4}Z`} />;
  };
  const [bx1, by1] = pt(180, R), [bx2, by2] = pt(0, R);
  const [bx3, by3] = pt(0, ir), [bx4, by4] = pt(180, ir);
  const bg = `M${bx1},${by1} A${R},${R} 0 0,1 ${bx2},${by2} L${bx3},${by3} A${ir},${ir} 0 0,0 ${bx4},${by4}Z`;
  const needleAngle = animated ? (score / 100) * 180 - 180 : -180;

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 300 175" width="280" height="163">
        <path fill="#F0F0F0" d={bg} />
        {arc(180, 121, "#4CD964")} {/* Low */}
        {arc(118, 62, "#FACC15")} {/* Medium */}
        {arc(59, 0, "#F97316")}   {/* High */}
        {[0, 25, 50, 75, 100].map(v => {
          const a = 180 - v * 1.8;
          const [ox, oy] = pt(a, R + 4), [ix, iy] = pt(a, R + 12);
          return <line key={v} x1={ox} y1={oy} x2={ix} y2={iy} stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" />;
        })}
        <text x={cx} y={cy - 20} textAnchor="middle" fontSize="54" fontWeight="700"
          fill="#111827" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" letterSpacing="-1">
          {score}
        </text>
        <g style={{
          transform: `rotate(${needleAngle}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: animated ? "transform 1.1s cubic-bezier(0.34,1.56,0.64,1)" : "none",
        }}>
          <line x1={cx - 16} y1={cy} x2={cx + ir - 5} y2={cy}
            stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points={`${cx + ir - 5},${cy} ${cx + ir - 14},${cy - 5} ${cx + ir - 14},${cy + 5}`} fill="#1F2937" />
        </g>
        <circle cx={cx} cy={cy} r="11" fill="#1F2937" />
        <circle cx={cx} cy={cy} r="5" fill="#fff" />
      </svg>
      <div className="gauge-risk-label" style={{ color: riskColor }}>{level} RISK</div>
    </div>
  );
};

// ── Score breakdown cards (each modality independent 0-100) ──────────────────
interface ModalityRow {
  label: string;
  score: number | null;
  summary: string;
}

const scoreColor = (s: number) => {
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  const rgb = (r: number, g: number, b: number) => `rgb(${r},${g},${b})`;
  if (s >= 70) {
    const t = Math.min((s - 70) / 30, 1);
    return rgb(lerp(248, 153, t), lerp(113, 27, t), lerp(113, 27, t));
  }
  if (s >= 45) {
    const t = (s - 45) / 24;
    return rgb(lerp(253, 249, t), lerp(186, 115, t), lerp(116, 22, t));
  }
  if (s >= 20) {
    const t = (s - 20) / 24;
    return rgb(lerp(254, 234, t), lerp(240, 179, t), lerp(138, 8, t));
  }
  const t = Math.min(s / 19, 1);
  return rgb(lerp(134, 22, t), lerp(239, 163, t), lerp(172, 74, t));
};

const ScoreBreakdown: React.FC<{ rows: ModalityRow[] }> = ({ rows }) => {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t); }, []);

  return (
    <div className="sb-grid">
      {rows.map(({ label, score, summary }) => {
        const val = score ?? 0;
        const barColor = score !== null ? scoreColor(val) : "#D1D5DB";
        const isHovered = hovered === label;
        return (
          <div
            key={label}
            className="sb-card"
            onMouseEnter={() => setHovered(label)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="sb-card-header">
              <span className="sb-label">{label}</span>
              <span className="sb-score" style={{ color: barColor }}>
                {score !== null ? val : "—"}
              </span>
            </div>
            <div className="sb-track">
              <div
                className="sb-fill"
                style={{
                  width: animated ? `${val}%` : "0%",
                  background: barColor,
                  transition: animated ? "width 0.9s cubic-bezier(0.34,1.1,0.64,1)" : "none",
                }}
              />
            </div>
            {isHovered && summary && (
              <div className="sb-tooltip">{summary}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface DetectedAppCategory {
  categoryId: string; categoryLabel: string;
  riskLevel: string; riskScore: number; apps: string[];
}
interface PostAnalysis {
  id: string; session_id: string;
  overall_score: number; risk_level: string; confidence?: string;
  /** True when the backend's final synthesis LLM call failed/returned
   *  unparseable output (overall_score was null) — overall_score/risk_level
   *  above are placeholders and must not be rendered as a real verdict. */
  analysis_failed: boolean;
  keystroke_summary: string; voice_summary: string;
  app_summary?: string; image_summary: string;
  full_transcript: string;
  keystroke_score: number | null; voice_score: number | null;
  image_score: number | null; app_score: number | null;
  risk_score: number; final_summary: string;
  detected_app_categories: DetectedAppCategory[];
  created_at: string; status?: string;
  /** Consent coverage windows (GDPR): which portions of the interview
   *  were monitored. An open window has revoked_at = null. */
  consent_windows: { given_at: string; revoked_at: string | null; text_version: string }[];
}

function normalizeAnalysis(raw: Record<string, unknown>): PostAnalysis {
  // overall_score === null means the final synthesis LLM call failed or
  // returned unparseable output (see Cortex postAnalysisService.ts) — that
  // is NOT a real "0/Low" verdict, so it must never be coerced into one.
  const analysisFailed = raw.overall_score === null || raw.risk_level === "ANALYSIS_FAILED";
  const overall = typeof raw.overall_score === "number" ? raw.overall_score : 0;
  const toScore = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    id: String(raw.id ?? ""),
    session_id: String(raw.session_id ?? ""),
    overall_score: overall,
    risk_score: Number(raw.risk_score ?? overall),
    risk_level: analysisFailed ? "ANALYSIS_FAILED" : String(raw.risk_level ?? "Low"),
    analysis_failed: analysisFailed,
    confidence: raw.confidence != null ? String(raw.confidence) : undefined,
    keystroke_summary: String(raw.keystroke_summary ?? ""),
    voice_summary: String(raw.voice_summary ?? ""),
    app_summary: raw.app_summary != null ? String(raw.app_summary) : undefined,
    image_summary: String(raw.image_summary ?? ""),
    full_transcript: String(raw.full_transcript ?? ""),
    keystroke_score: toScore(raw.keystroke_score),
    voice_score: toScore(raw.voice_score),
    image_score: toScore(raw.image_score),
    app_score: toScore(raw.app_score),
    final_summary: String(raw.final_summary ?? ""),
    detected_app_categories: Array.isArray(raw.detected_app_categories)
      ? (raw.detected_app_categories as DetectedAppCategory[])
      : [],
    created_at: String(raw.created_at ?? raw.created_at_analysis ?? new Date().toISOString()),
    status: raw.status != null ? String(raw.status) : undefined,
    consent_windows: Array.isArray(raw.consent_windows)
      ? (raw.consent_windows as PostAnalysis["consent_windows"])
      : [],
  };
}

// ── Main Panel ────────────────────────────────────────────────────────────────
interface PostAnalysisPanelProps {
  /** Override the route param — lets the panel be embedded on another page. */
  sessionId?: string;
  /** Override the ?pending=1 search param when embedded. */
  pending?: boolean;
  /** When embedded, suppress the full-page loading placeholder (the host shows
   *  its own loader, e.g. on a button) and report status up via onStatusChange. */
  embedded?: boolean;
  onStatusChange?: (status: "loading" | "ready" | "error") => void;
}

export const PostAnalysisPanel: React.FC<PostAnalysisPanelProps> = ({
  sessionId: sessionIdProp,
  pending: pendingProp,
  embedded = false,
  onStatusChange,
}) => {
  const { roundId, processId, id, sessionId: sessionIdLegacy } = useParams<{ roundId?: string; processId?: string; id?: string; sessionId?: string }>();
  const sessionId = sessionIdProp ?? roundId ?? id ?? sessionIdLegacy;
  const [searchParams] = useSearchParams();
  const mockScenario = searchParams.get("mock") as MockScenario | null;
  const pendingPoll = pendingProp ?? searchParams.get("pending") === "1";
  const printRef = useRef<HTMLDivElement>(null);

  const [analysis, setAnalysis] = useState<PostAnalysis | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async (attempt = 0) => {
      if (mockScenario && mockScenario in MOCK_ANALYSIS_SCENARIOS) {
        setAnalysis(MOCK_ANALYSIS_SCENARIOS[mockScenario] as PostAnalysis);
        setLoading(false);
        return;
      }
      if (!sessionId) { setError("Session ID not found"); setLoading(false); return; }

      try {
        const [analysisRes, sessionRes] = await Promise.all([
          InterviewService.getPostAnalysis(sessionId),
          InterviewService.getById(sessionId),
        ]);
        if (cancelled) return;
        if (analysisRes.success && analysisRes.data) {
          setAnalysis(normalizeAnalysis(analysisRes.data));
          if (sessionRes.success && sessionRes.data) setSession(sessionRes.data);
          setError(null);
          setLoading(false);
        } else {
          setError(analysisRes.message || "Failed to fetch analysis");
          setLoading(false);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { status?: number; data?: { error?: string }; message?: string };
        const msg = err?.data?.error || err?.message || "Failed to fetch analysis";
        const notFound = err?.status === 404 || msg.toLowerCase().includes("not found");
        if ((pendingPoll || notFound) && attempt < 24) {
          setError(null); setLoading(true);
          pollTimer = setTimeout(() => load(attempt + 1), 5000);
          return;
        }
        setError(msg); setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; if (pollTimer) clearTimeout(pollTimer); };
  }, [sessionId, mockScenario, pendingPoll]);

  const handleExportPDF = async () => {
    if (!sessionId || pdfLoading) return;
    setPdfLoading(true);
    try {
      const pdfUrl = `${ENV.CORTEX_API_URL}/interviews/${sessionId}/analysis/pdf`;
      const fetchPdf = (tok: string | null) =>
        fetch(pdfUrl, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
      let res = await fetchPdf(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN));
      // Blob endpoint can't go through ApiService — refresh + retry once on 401.
      if (res.status === 401) {
        const fresh = await refreshAccessToken();
        if (fresh) res = await fetchPdf(fresh);
      }
      if (!res.ok) throw new Error(`PDF request failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cp = session?.interview_session_participants?.find(p => p.candidate_id && p.candidate)?.candidate;
      a.download = `Interview_Report_${cp ? `${cp.first_name} ${cp.last_name}`.trim() : sessionId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[PostAnalysis] PDF export failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCopyTranscript = async () => {
    const raw = analysis?.full_transcript ?? "";
    if (!raw.trim()) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = raw;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Report load status to an embedding host (e.g. so a button can hold the loader).
  useEffect(() => {
    if (!onStatusChange) return;
    if (loading) onStatusChange("loading");
    else if (error) onStatusChange("error");
    else if (analysis) onStatusChange("ready");
  }, [loading, error, analysis, onStatusChange]);

  if (loading) {
    // Embedded: stay invisible — the host shows its own loader (button spinner).
    if (embedded) return null;
    return (
      <div className="pa-state">
        <div className="pa-spinner" />
        <p>{pendingPoll ? "Analysis is running — this may take a moment." : "Loading analysis…"}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="pa-state pa-state-error">
        <p>{error}</p>
        {!embedded && sessionId && <Link to={`/interviews/${processId}/rounds/${sessionId}`} className="pa-back-link">Back to interview</Link>}
      </div>
    );
  }
  if (!analysis) return <div className="pa-state"><p>No analysis available</p></div>;
  if (analysis.status === "pending") {
    return <div className="pa-state"><div className="pa-spinner" /><p>Analysis is being processed…</p></div>;
  }
  if (analysis.analysis_failed) {
    return (
      <div className="pa-state">
        <p>Analysis could not be completed for this session.</p>
        <p className="pa-card-note">The synthesis step failed or returned an unreadable result — no risk score is available. Please retry the analysis.</p>
      </div>
    );
  }

  // ── Derived ──
  const getRiskColor = (r: string) => {
    switch (r.toUpperCase()) {
      case "SEVERE":   return "#7F1D1D";
      case "CRITICAL": return "#DC2626";
      case "HIGH":     return "#F97316";
      case "MEDIUM":   return "#FACC15";
      case "LOW":      return "#16A34A";
      default:         return "#9CA3AF";
    }
  };
  const riskColor = getRiskColor(analysis.risk_level);

  const modalityRows: ModalityRow[] = [
    { label: "Keystroke", score: analysis.keystroke_score, summary: analysis.keystroke_summary },
    { label: "Voice",     score: analysis.voice_score,     summary: analysis.voice_summary },
    { label: "Image",     score: analysis.image_score,     summary: analysis.image_summary },
    { label: "App Usage", score: analysis.app_score,       summary: analysis.app_summary ?? "" },
  ];
  const hasModalityScores = modalityRows.some(r => r.score !== null);

  const candidateP = session?.interview_session_participants?.find(p => p.candidate_id && p.candidate);
  const interviewerP = session?.interview_session_participants?.find(p => p.interviewer_id && p.interviewer);
  const candidate = candidateP?.candidate;
  const interviewer = interviewerP?.interviewer;
  const companyName = session?.company?.name;
  const interviewDate = session?.scheduled_start_at ? formatDate(session.scheduled_start_at) : "";
  const candidateName = candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : "Candidate";

  return (
    <div className={`pa-root${embedded ? " pa-embedded" : ""}`} ref={printRef}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="pa-nav no-print">
        {!embedded ? (
          <Link to={`/interviews/${processId}/rounds/${sessionId}`} className="pa-nav-back">
            <BackIcon sx={{ fontSize: 15 }} /> Back to Interview
          </Link>
        ) : <span />}
        <div className="pa-nav-actions">
          <button className="pa-copy-btn" onClick={handleCopyTranscript} title="Copy full transcript">
            <CopyIcon sx={{ fontSize: 15 }} /> {copied ? "Copied!" : "Copy Transcript"}
          </button>
          <button className="pa-export-btn" onClick={handleExportPDF} disabled={pdfLoading}>
            <ExportIcon sx={{ fontSize: 15 }} /> {pdfLoading ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </nav>

      {/* ── Hero — document masthead: identity row, then one meta line ──── */}
      <header className="pa-hero">
        <div className="pa-hero-top">
          <div className="pa-hero-left">
            <div className="pa-avatar">{getInitials(candidate?.first_name, candidate?.last_name)}</div>
            <div>
              <h1 className="pa-candidate-name">{candidateName}</h1>
              {candidate?.email && <p className="pa-candidate-email">{candidate.email}</p>}
            </div>
          </div>
          {/* Risk badge intentionally omitted — the gauge already shows the
              risk level, no need to say it twice. */}
          {analysis.confidence && (
            <div className="pa-hero-badges">
              <span className="pa-conf-badge">
                {analysis.confidence} CONFIDENCE
              </span>
            </div>
          )}
        </div>

        <div className="pa-hero-meta">
          {interviewer && (
            <div className="pa-meta-item">
              <span className="pa-meta-label">Interviewer</span>
              <span className="pa-meta-val">{`${interviewer.first_name} ${interviewer.last_name}`.trim()}</span>
            </div>
          )}
          {companyName && (
            <div className="pa-meta-item">
              <span className="pa-meta-label">Company</span>
              <span className="pa-meta-val">{companyName}</span>
            </div>
          )}
          {interviewDate && (
            <div className="pa-meta-item">
              <span className="pa-meta-label">Date</span>
              <span className="pa-meta-val">{interviewDate}</span>
            </div>
          )}
          {session?.title && (
            <div className="pa-meta-item">
              <span className="pa-meta-label">Role</span>
              <span className="pa-meta-val">{session.title}</span>
            </div>
          )}
          {analysis.consent_windows.length > 0 && (
            <div className="pa-meta-item">
              <span className="pa-meta-label">Monitoring coverage</span>
              <span className="pa-meta-val">
                {analysis.consent_windows
                  .map((w) =>
                    `${new Date(w.given_at).toLocaleTimeString()} – ${
                      w.revoked_at ? new Date(w.revoked_at).toLocaleTimeString() : 'end'
                    }`
                  )
                  .join(', ')}
                {analysis.consent_windows.some((w) => w.revoked_at) &&
                  ' (consent was withdrawn during this interview)'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Score + Donut ────────────────────────────────────────────────── */}
      <div className="pa-charts-row">
        <section className="pa-card pa-gauge-card">
          <h3 className="pa-card-title">Overall Score</h3>
          <RiskGauge score={analysis.risk_score} level={analysis.risk_level} riskColor={riskColor} />
          <p className="pa-card-note">Aggregated across voice, keystrokes and app usage.</p>
        </section>

        <section className="pa-card pa-donut-card">
          <h3 className="pa-card-title">Score Breakdown</h3>
          {hasModalityScores
            ? <ScoreBreakdown rows={modalityRows} />
            : <p className="pa-body pa-body-sm" style={{ textAlign: "center", paddingTop: "2rem" }}>No modality score data available.</p>
          }
        </section>
      </div>

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <section className="pa-card pa-summary-card">
        <h3 className="pa-card-title">Interview Summary</h3>
        <Bullets className="pa-body" text={analysis.final_summary} empty="No summary available." />
      </section>

      {/* ── Signal cards ─────────────────────────────────────────────────── */}
      <div className="pa-signals">
        <section className="pa-card pa-signal-card">
          <h3 className="pa-card-title">Voice Analysis</h3>
          <Bullets className="pa-body pa-body-sm" text={analysis.voice_summary} empty="No voice data recorded." />
        </section>
        <section className="pa-card pa-signal-card">
          <h3 className="pa-card-title">Keystroke Analysis</h3>
          <Bullets className="pa-body pa-body-sm" text={analysis.keystroke_summary} empty="No keystroke data recorded." />
        </section>
        <section className="pa-card pa-signal-card">
          <h3 className="pa-card-title">App Usage</h3>
          <Bullets className="pa-body pa-body-sm" text={analysis.app_summary} empty="No app usage data recorded." />
        </section>
      </div>

      {/* ── App categories ───────────────────────────────────────────────── */}
      {analysis.detected_app_categories?.length > 0 && (
        <section className="pa-card">
          <h3 className="pa-card-title">Detected Application Categories</h3>
          <div className="pa-cats">
            {analysis.detected_app_categories.map(cat => (
              <div key={cat.categoryId} className="pa-cat"
                style={{ borderLeftColor: getRiskColor(cat.riskLevel) }}>
                <div className="pa-cat-header">
                  <span className="pa-cat-name">{cat.categoryLabel}</span>
                  <span className="pa-cat-risk" style={{ color: getRiskColor(cat.riskLevel) }}>
                    {cat.riskLevel}
                  </span>
                </div>
                <p className="pa-cat-score">Risk score {cat.riskScore}/100</p>
                <div className="pa-cat-apps">
                  {cat.apps.map(a => <span key={a} className="pa-app-tag">{a}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Transcript ───────────────────────────────────────────────────── */}
      <section className="pa-card">
        <h3 className="pa-card-title">Full Interview Transcript</h3>
        <TranscriptChat
          transcript={analysis.full_transcript}
          candidateName={candidateName}
          interviewerName={interviewer ? `${interviewer.first_name} ${interviewer.last_name}`.trim() : "Interviewer"}
        />
      </section>

      {/* Print footer */}
      <footer className="pa-print-footer">
        <span>Trueyy Skyview — Confidential</span>
        <span>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
      </footer>
    </div>
  );
};

export default PostAnalysisPanel;
