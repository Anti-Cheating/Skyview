/**
 * CandidateSetupCard — pre-join checklist shown to the interviewer
 *
 * Rendered inside MonitoringView while the candidate is still going
 * through the Trueyy Helper setup flow. Four pills:
 *
 *   1. Helper installed    ← Trueyy Helper daemon connected to Cortex
 *   2. Screen Recording    ← TCC permission granted on macOS
 *   3. Microphone          ← TCC permission granted on macOS
 *   4. Joined meeting      ← candidate clicked "Open Meeting" in CandidateJoinPage
 *
 * Once all four flip true, MonitoringView hides this card and lets the
 * AnalyticsPanel take over. Card stays visible if any earlier step
 * regresses (permission revoked mid-interview), so the interviewer
 * can see why monitoring stopped.
 *
 * Status comes from `useRiskSocket().candidateStatus`, which is fed by:
 *   - GET /interview-sessions/:id  →  initial seed via setInitialCandidateStatus
 *   - socket.io `candidate-status` event  →  live updates as the candidate progresses
 */

import { Box, Typography, Tooltip } from "@mui/material";
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  HourglassEmpty as HourglassIcon,
} from "@mui/icons-material";
import type { CandidateStatus } from "../../hooks/useRiskSocket";
import { TOKENS } from "../../theme";

interface Props {
  status: CandidateStatus | null;
  /** True when this card reappears because permission was revoked mid-
   *  interview (vs the initial pre-join setup where the card shows for
   *  the first time). Changes the title and adds a warning banner. */
  revoked?: boolean;
}

// Was hardcoded "#4CD964" — now sourced from the canonical theme so a
// brand-colour change propagates without a search-and-replace.
const BRAND = TOKENS.brand;
const PENDING = TOKENS.textMuted;
const ROW_BG_DONE = "rgba(76, 217, 100, 0.08)";
const ROW_BG_PENDING = "#F9FAFB";

interface CheckRow {
  key: keyof Pick<CandidateStatus, "extension_installed" | "screen_recording" | "mic_granted" | "joined">;
  /** Short label shown inline on the pill. */
  label: string;
  /** Longer description shown in the pill's tooltip. */
  doneText: string;
  pendingText: string;
}

const ROWS: CheckRow[] = [
  {
    key: "extension_installed",
    label: "Trueyy Helper",
    doneText: "Trueyy Helper installed and connected",
    pendingText: "Waiting for candidate to install and launch Trueyy Helper",
  },
  {
    key: "screen_recording",
    label: "Screen Monitor",
    doneText: "Screen Recording granted",
    pendingText: "Waiting for Screen Recording permission",
  },
  {
    key: "mic_granted",
    label: "Microphone",
    doneText: "Microphone granted",
    pendingText: "Waiting for Microphone permission",
  },
  {
    key: "joined",
    // Was lowercase "joined" while the other three are Title Case.
    // Match the surrounding labels.
    label: "Joined",
    doneText: "Candidate joined the meeting",
    pendingText: "Waiting for candidate to open the meeting tab",
  },
];

export default function CandidateSetupCard({ status, revoked }: Props) {
  // Treat null status as "nothing started yet" — every check is pending,
  // every row pending. This is what the interviewer sees the very first
  // time they open MonitoringView for a brand-new extension interview.
  const flags: CandidateStatus = status ?? {
    extension_installed: false,
    screen_recording: false,
    mic_granted: false,
    joined: false,
    updated_at: null,
  };

  const totalDone = ROWS.filter((r) => flags[r.key]).length;

  const allDone = totalDone === ROWS.length;
  const headline = revoked
    ? "Monitoring paused"
    : allDone
      ? "Candidate ready"
      : "Waiting for candidate setup";

  return (
    <Box
      sx={{
        mx: { xs: 2, md: 3 },
        my: 1.5,
        p: { xs: 1.5, md: 2 },
        bgcolor: "#FFFFFF",
        border: `1px solid ${revoked ? "#FCA5A5" : "#E5E7EB"}`,
        borderRadius: 2,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        display: "flex",
        alignItems: "stretch",
        gap: { xs: 1.5, md: 2 },
        flexWrap: "wrap",
      }}
    >
      {/* ── Left: headline + count ────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          minWidth: 200,
          flex: "0 1 auto",
          pr: { md: 2 },
          borderRight: { md: "1px solid #F3F4F6" },
        }}
      >
        <HourglassIcon
          sx={{
            color: revoked ? "#EF4444" : allDone ? BRAND : PENDING,
            fontSize: 16,
          }}
        />
        <Typography
          sx={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: revoked ? "#DC2626" : "#1F2937",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          {headline}
        </Typography>
        <Box
          sx={{
            px: 0.75,
            py: 0.15,
            borderRadius: 999,
            bgcolor: allDone ? "rgba(76,217,100,0.15)" : "#F3F4F6",
            color: allDone ? BRAND : "#6B7280",
            fontSize: "0.65rem",
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {totalDone}/{ROWS.length}
        </Box>
      </Box>

      {/* ── Right: 4 status tiles in a horizontal grid ───────────── */}
      <Box
        sx={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(4, 1fr)",
          },
          gap: 1,
          minWidth: 0,
        }}
      >
        {ROWS.map((row) => {
          const done = !!flags[row.key];
          return (
            <Tooltip
              key={row.key}
              title={done ? row.doneText : row.pendingText}
              arrow
              placement="top"
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  px: 1.25,
                  py: 0.9,
                  borderRadius: 1.2,
                  bgcolor: done ? ROW_BG_DONE : ROW_BG_PENDING,
                  border: `1px solid ${done ? "rgba(76,217,100,0.3)" : "#E5E7EB"}`,
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    bgcolor: done ? "rgba(76,217,100,0.18)" : "#FFFFFF",
                    border: `1px solid ${done ? "rgba(76,217,100,0.35)" : "#E5E7EB"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {done ? (
                    <CheckIcon sx={{ color: BRAND, fontSize: 14 }} />
                  ) : (
                    <PendingIcon sx={{ color: PENDING, fontSize: 14 }} />
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: done ? "#065F46" : "#374151",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {row.label}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
