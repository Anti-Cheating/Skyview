import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Insights as InsightsIcon } from "@mui/icons-material";
import { ENV } from "../../config/env";
import { useAuth } from "../../contexts/AuthContext";
import { MOCK_ANALYSIS_SCENARIOS, type MockScenario } from "../../mockData/postAnalysisMock";
import { MOCK_PAST_INTERVIEWS } from "../../mockData/interviewsMock";
import "./PostAnalysisPanel.css";

// ── Risk Gauge (Speedometer) ─────────────────────────────────────────────────
interface RiskGaugeProps {
  score: number;
  level: string;
  riskColor: string;
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ score, level, riskColor }) => {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, [score]);

  // Canvas: 300 wide, 185 tall. Pivot at bottom-center.
  const cx = 150, cy = 158;
  const R = 128, ir = 92;   // arc band thickness: 36px

  const toRad = (d: number) => (d * Math.PI) / 180;
  // Arc curves UPWARD (inverted U, opening at top) — needle sweeps left→right
  const pt = (deg: number, r: number): [number, number] => [
    cx + r * Math.cos(toRad(deg)),
    cy - r * Math.sin(toRad(deg)),  // negative: curves up
  ];

  // Donut arc segment from a1→a2, curving UPWARD through top (180°→0°)
  const seg = (a1: number, a2: number, fill: string) => {
    const [x1,y1] = pt(a1,R),  [x2,y2] = pt(a2,R);
    const [x3,y3] = pt(a2,ir), [x4,y4] = pt(a1,ir);
    return (
      <path fill={fill}
        d={`M${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} L${x3},${y3} A${ir},${ir} 0 0,0 ${x4},${y4}Z`}
      />
    );
  };

  // Full grey background track 180°→0° (horseshoe arc at top, opening down)
  const [bx1,by1] = pt(180,R),  [bx2,by2] = pt(0,R);
  const [bx3,by3] = pt(0,ir),   [bx4,by4] = pt(180,ir);
  const bgTrack = `M${bx1},${by1} A${R},${R} 0 0,1 ${bx2},${by2} L${bx3},${by3} A${ir},${ir} 0 0,0 ${bx4},${by4}Z`;

  // Tick marks at 0, 25, 50, 75, 100
  const ticks = [0, 25, 50, 75, 100].map(v => {
    const angle = 180 - v * 1.8;
    const [ox, oy] = pt(angle, R + 6);
    const [ix, iy] = pt(angle, R + 14);
    return <line key={v} x1={ox} y1={oy} x2={ix} y2={iy}
      stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" />;
  });

  // Tick labels: 0 at left, 50 at top, 100 at right
  const tickLabels = [
    { v: 0,   anchor: "end"    as const },
    { v: 50,  anchor: "middle" as const },
    { v: 100, anchor: "start"  as const },
  ].map(({ v, anchor }) => {
    const angle = 180 - v * 1.8;
    const [lx, ly] = pt(angle, R + 24);
    return (
      <text key={v} x={lx} y={ly + 3} fontSize="9" fill="#9CA3AF"
        fontWeight="600" textAnchor={anchor}
        fontFamily="-apple-system,system-ui">{v}</text>
    );
  });

  // Needle: starts at 180° (score=0, left) → sweeps to score position
  // CSS rotation: -180deg = pointing left (score 0), 0deg = pointing right (score 100)
  const rotation = animated ? (score / 100) * 180 - 180 : -180;

  // Needle tip position (pointing right at 0° = toward arc)
  const tipX = cx + ir - 8;  // stops just inside inner arc edge
  const tailX = cx - 20;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg viewBox="0 0 300 185" width="300" height="185">
        {/* Grey background track */}
        <path fill="#F3F4F6" d={bgTrack} />

        {/* Colored zones — score 0–33 = green, 34–66 = yellow, 67–100 = orange */}
        {seg(180, 121, "#4CD964")}  {/* Low    */}
        {seg(118,  62, "#FACC15")}  {/* Medium */}
        {seg(59,    0, "#F97316")}  {/* High   */}

        {/* Tick marks */}
        {ticks}
        {tickLabels}

        {/* Score value — large, centered inside gauge area */}
        <text x={cx} y={cy - 28}
          textAnchor="middle" fontSize="48" fontWeight="800" fill="#1F2937"
          fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui">
          {score}
        </text>

        {/* Animated needle — drawn pointing right, rotated from -180° to score angle */}
        <g style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: animated
            ? "transform 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)"
            : "none",
        }}>
          {/* Main needle shaft */}
          <line x1={tailX} y1={cy} x2={tipX} y2={cy}
            stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
          {/* Arrow triangle at tip */}
          <polygon
            points={`${tipX},${cy} ${tipX - 10},${cy - 5} ${tipX - 10},${cy + 5}`}
            fill="#1F2937"
          />
        </g>

        {/* Pivot hub */}
        <circle cx={cx} cy={cy} r="14" fill="#1F2937" />
        <circle cx={cx} cy={cy} r="7"  fill="#FFFFFF" />
        <circle cx={cx} cy={cy} r="3"  fill="#9CA3AF" />
      </svg>

      {/* Risk level label — below gauge */}
      <div style={{ fontSize: '17px', fontWeight: 700, color: riskColor, letterSpacing: '2px' }}>
        {level.toUpperCase()} 
      </div>
    </div>
  );
};

// ── Main interfaces ──────────────────────────────────────────────────────────
interface DetectedAppCategory {
  categoryId: string;
  categoryLabel: string;
  riskLevel: string;
  riskScore: number;
  apps: string[];
}

interface PostAnalysis {
  id: string;
  session_id: string;
  overall_score: number;
  risk_level: string;
  keystroke_summary: string;
  voice_summary: string;
  image_summary: string;
  full_transcript: string;
  keystroke_breakdown: Record<string, number>;
  risk_score: number;
  final_summary: string;
  detected_app_categories: DetectedAppCategory[];
  created_at: string;
}

// ── PostAnalysisPanel ────────────────────────────────────────────────────────
export const PostAnalysisPanel: React.FC = () => {
  const { user } = useAuth();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const mockScenario = searchParams.get("mock") as MockScenario | null;

  const [analysis, setAnalysis]   = useState<PostAnalysis | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [hoveredIndex, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (mockScenario && mockScenario in MOCK_ANALYSIS_SCENARIOS) {
        setAnalysis(MOCK_ANALYSIS_SCENARIOS[mockScenario] as PostAnalysis);
        setLoading(false);
        return;
      }
      if (!sessionId) { setError("Session ID not found"); setLoading(false); return; }
      try {
        const res = await axios.get(`${ENV.CORTEX_API_URL}/interviews/${sessionId}/analysis`);
        if (res.data.success) { setAnalysis(res.data.data); }
        else setError(res.data.error || "Failed to fetch analysis");
      } catch (e: any) {
        setError(e.response?.data?.error || "Failed to fetch analysis");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [sessionId, mockScenario]);

  if (loading) return <div className="post-analysis-loading">Loading analysis...</div>;
  if (error)   return <div className="post-analysis-error">Error: {error}</div>;
  if (!analysis) return <div className="post-analysis-empty">No analysis available</div>;

  const getRiskColor = (risk: string) => {
    switch (risk.toUpperCase()) {
      case "CRITICAL": return "#DC2626";
      case "HIGH":     return "#F97316";
      case "MEDIUM":   return "#FACC15";
      case "LOW":      return "#4CD964";
      default:         return "#9CA3AF";
    }
  };

  const getKeystrokeColor = (key: string) => {
    switch (key) {
      case "normal":        return "#4CD964";
      case "suspicious":    return "#F97316";
      case "auto_complete": return "#3B82F6";
      default:              return "#9CA3AF";
    }
  };

  const getKeystrokeDescription = (key: string) => {
    switch (key) {
      case "normal":        return "Regular typing patterns — genuine, unassisted input";
      case "suspicious":    return "Unusual patterns — copy-paste or external input detected";
      case "auto_complete": return "IDE auto-completion or code suggestions used";
      default:              return "Keystroke activity";
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  };

  const pieData = Object.entries(analysis.keystroke_breakdown).map(([key, value]) => ({
    name: key.replace(/_/g, " ").toUpperCase(),
    value,
    key,
  }));

  return (
    <div className="post-analysis-panel">

      {/* Greeting Banner */}
      <div className="greeting-banner">
        <div className="greeting-icon">
          <InsightsIcon />
        </div>
        <div className="greeting-content">
          <p className="greeting-message" ><strong>Post-Analysis</strong></p>
        </div>
      </div>



      {/* ── Header Card ─────────────────────────────────────────────── */}
      <div className="analysis-header">
        <div className="header-container">

          {/* Left: Speedometer Gauge */}
          <div className="score-info">
            <RiskGauge
              score={analysis.risk_score}
              level={analysis.risk_level}
              riskColor={getRiskColor(analysis.risk_level)}
            />
          </div>

          {/* Right: Full Pie Chart + Legend */}
          <div className="pie-chart-header">
            <div className="pie-chart-wrapper">
              <PieChart
                width={240} height={240}
                onMouseLeave={() => setHovered(null)}
              >
                <Pie
                  data={pieData}
                  cx={120} cy={120}
                  outerRadius={105}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  animationDuration={700}
                  animationEasing="ease-out"
                  stroke="none"
                  onMouseEnter={(_: any, i: number) => setHovered(i)}
                >
                  {pieData.map((e, i) => (
                    <Cell
                      key={e.key}
                      fill={getKeystrokeColor(e.key)}
                      opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.35}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#fff", border: "1px solid #E5E7EB",
                    borderRadius: "8px", padding: "8px 12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    fontSize: "12px", color: "#1F2937", fontWeight: 600,
                  }}
                  formatter={(v: any) => [`${v}%`]}
                />
              </PieChart>
            </div>

            {/* Legend */}
            <div className="pie-legend">
              {pieData.map((e, i) => (
                <div
                  key={e.key}
                  className="pie-legend-item"
                  style={{
                    opacity: hoveredIndex === null || hoveredIndex === i ? 1 : 0.35,
                    transition: "opacity 0.2s ease",
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="pie-legend-dot"
                    style={{ backgroundColor: getKeystrokeColor(e.key) }} />
                  <span className="pie-legend-label">{e.name}</span>
                  <span className="pie-legend-value">{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Keystroke cards below */}
        <div className="keystroke-analysis-below">
          <div className="keystroke-descriptions">
            {pieData.map(({ key }, i) => {
              const isHovered = hoveredIndex === i;
              const isDimmed  = hoveredIndex !== null && !isHovered;
              return (
                <div
                  key={key}
                  className="keystroke-description-item"
                  style={{
                    borderLeftColor: getKeystrokeColor(key),
                    opacity: isDimmed ? 0.4 : 1,
                    background: isHovered ? "#fff" : undefined,
                    boxShadow: isHovered
                      ? `0 4px 16px ${getKeystrokeColor(key)}30` : undefined,
                    transition: "opacity 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="description-dot"
                    style={{ backgroundColor: getKeystrokeColor(key) }} />
                  <div className="description-content">
                    <strong>{key.replace(/_/g, " ").toUpperCase()}</strong>
                    <p>{getKeystrokeDescription(key)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="final-summary">
        <h2 className="section-title">Summary</h2>
        <p>{analysis.final_summary}</p>
      </div>

      {/* ── 3 Fixed Cards ───────────────────────────────────────────── */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Image / Window Analysis</h3>
          <p>{analysis.image_summary}</p>
        </div>
        <div className="summary-card">
          <h3>Voice Analysis</h3>
          <p>{analysis.voice_summary}</p>
        </div>
        <div className="summary-card">
          <h3>Keyboard Analysis</h3>
          <p>{analysis.keystroke_summary}</p>
        </div>
      </div>

      {/* ── App Categories ──────────────────────────────────────────── */}
      {analysis.detected_app_categories?.length > 0 && (
        <div className="app-categories">
          <h2 className="section-title">Detected Application Categories</h2>
          <div className="categories-grid">
            {analysis.detected_app_categories.map((cat) => (
              <div key={cat.categoryId} className="category-card"
                style={{ borderTopColor: getRiskColor(cat.riskLevel) }}>
                <div className="category-header">
                  <h3>{cat.categoryLabel}</h3>
                  <span className="risk-badge"
                    style={{ backgroundColor: getRiskColor(cat.riskLevel) }}>
                    {cat.riskLevel}
                  </span>
                </div>
                <div className="category-score">
                  <span className="score">Risk Score: {cat.riskScore}/100</span>
                </div>
                <div className="category-apps">
                  <p className="apps-label">Detected Apps</p>
                  <div className="apps-list">
                    {cat.apps.map((app) => (
                      <span key={app} className="app-tag">{app}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Transcript ──────────────────────────────────────────────── */}
      <div className="transcript-section">
        <h2 className="section-title">Full Interview Transcript</h2>
        <div className="transcript-content">
          <pre>{analysis.full_transcript}</pre>
        </div>
      </div>
    </div>
  );
};

export default PostAnalysisPanel;
