/**
 * CandidateSetupCard — pre-join checklist shown to the interviewer
 *
 * Renders inside MonitoringView while the candidate is still in the
 * extension setup flow. Three checks, in order:
 *
 *   1. Extension installed     ← extension's socket has connected
 *   2. Screen Recording granted ← Sentinel reported {type:"ready"}
 *   3. Joined meeting          ← candidate clicked "Open Meeting" in side panel
 *
 * Once `joined` flips true, MonitoringView hides this card and lets the
 * normal AnalyticsPanel take over. Card stays visible if any earlier step
 * regresses (e.g. Sentinel disconnects mid-interview), so the interviewer
 * can see why monitoring stopped.
 *
 * Status comes from `useRiskSocket().candidateStatus`, which is fed by:
 *   - GET /interview-sessions/:id  →  initial seed via setInitialCandidateStatus
 *   - socket.io `candidate-status` event  →  live updates as the candidate progresses
 */

import { Box, Typography, Chip } from "@mui/material";
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  HourglassEmpty as HourglassIcon,
} from "@mui/icons-material";
import type { CandidateStatus } from "../../hooks/useRiskSocket";

interface Props {
  status: CandidateStatus | null;
  /** True when this card reappears because permission was revoked mid-
   *  interview (vs the initial pre-join setup where the card shows for
   *  the first time). Changes the title and adds a warning banner. */
  revoked?: boolean;
}

const BRAND = "#4CD964";
const PENDING = "#9CA3AF";
const ROW_BG_DONE = "rgba(76, 217, 100, 0.08)";
const ROW_BG_PENDING = "#F9FAFB";

interface CheckRow {
  key: keyof Pick<CandidateStatus, "extension_installed" | "screen_recording" | "mic_granted" | "joined">;
  title: string;
  doneText: string;
  pendingText: string;
}

const ROWS: CheckRow[] = [
  {
    key: "extension_installed",
    title: "Trueyy Candidate Monitor extension",
    doneText: "Extension installed and connected",
    pendingText: "Waiting for the candidate to install and open the extension",
  },
  {
    key: "screen_recording",
    title: "Screen Recording permission",
    doneText: "Granted to Trueyy Helper on macOS",
    pendingText: "Waiting for the candidate to enable Screen Recording for Trueyy Helper",
  },
  {
    key: "mic_granted",
    title: "Microphone permission",
    doneText: "Granted to Trueyy Helper on macOS",
    pendingText: "Waiting for the candidate to enable Microphone for Trueyy Helper",
  },
  {
    key: "joined",
    title: "Joined meeting",
    doneText: "Candidate has opened the meeting tab",
    pendingText: "Waiting for the candidate to click Open Meeting in the side panel",
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

  return (
    <Box
      sx={{
        m: { xs: 2, md: 3 },
        p: { xs: 2, md: 3 },
        bgcolor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 2,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <HourglassIcon sx={{ color: revoked ? "#EF4444" : PENDING, fontSize: 22 }} />
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: "#1F2937" }}>
          {revoked ? "Monitoring paused" : "Waiting for candidate setup"}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={`${totalDone} / ${ROWS.length}`}
          size="small"
          sx={{
            height: 22,
            fontSize: "0.7rem",
            fontWeight: 700,
            bgcolor: totalDone === ROWS.length ? "rgba(76,217,100,0.15)" : "#F3F4F6",
            color: totalDone === ROWS.length ? BRAND : "#6B7280",
          }}
        />
      </Box>
      {revoked ? (
        <Typography sx={{ fontSize: "0.8rem", color: "#DC2626", mb: 2 }}>
          Screen Recording was disabled mid-interview. Captures are paused until the candidate
          re-enables Trueyy Helper and restarts Chrome.
        </Typography>
      ) : (
        <Typography sx={{ fontSize: "0.8rem", color: "#6B7280", mb: 2 }}>
          The candidate is going through the monitoring consent flow in their Chrome extension.
        </Typography>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {ROWS.map((row) => {
          const done = !!flags[row.key];
          return (
            <Box
              key={row.key}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: done ? ROW_BG_DONE : ROW_BG_PENDING,
                border: `1px solid ${done ? "rgba(76,217,100,0.3)" : "#E5E7EB"}`,
              }}
            >
              {done ? (
                <CheckIcon sx={{ color: BRAND, fontSize: 20, mt: 0.25 }} />
              ) : (
                <PendingIcon sx={{ color: PENDING, fontSize: 20, mt: 0.25 }} />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: done ? "#065F46" : "#1F2937",
                  }}
                >
                  {row.title}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#6B7280", mt: 0.25 }}>
                  {done ? row.doneText : row.pendingText}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

    </Box>
  );
}
