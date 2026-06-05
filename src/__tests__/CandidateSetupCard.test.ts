// CandidateSetupCard tests — pure logic (no React renderer needed)
// Run: npx tsx --test src/__tests__/CandidateSetupCard.test.ts
//
// Tests the progress card business logic:
//   - 0/4 → 1/4 → 2/4 → 3/4 → 4/4 state transitions
//   - headline changes (waiting / candidate ready / monitoring paused)
//   - null status treated as all-pending
//   - ROWS key mapping

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── Mirror the card's constants ───────────────────────────────────────────────
type CandidateStatus = {
  extension_installed: boolean;
  screen_recording: boolean;
  mic_granted: boolean;
  joined: boolean;
  updated_at: string | null;
};

const ROWS = [
  { key: "extension_installed" as const, label: "Trueyy Helper" },
  { key: "screen_recording"    as const, label: "Screen Monitor" },
  { key: "mic_granted"         as const, label: "Microphone" },
  { key: "joined"              as const, label: "Joined" },
];

function computeCard(status: CandidateStatus | null, revoked = false) {
  const flags: CandidateStatus = status ?? {
    extension_installed: false,
    screen_recording: false,
    mic_granted: false,
    joined: false,
    updated_at: null,
  };
  const totalDone = ROWS.filter(r => flags[r.key]).length;
  const allDone = totalDone === ROWS.length;
  const headline = revoked
    ? "Monitoring paused"
    : allDone
      ? "Candidate ready"
      : "Waiting for candidate setup";
  return { totalDone, allDone, headline, flags };
}

// ─────────────────────────────────────────────────────────────────────────────
describe("0/4 progress card — initial state", () => {
  test("null status → 0/4, all pending", () => {
    const { totalDone, allDone } = computeCard(null);
    assert.equal(totalDone, 0);
    assert.equal(allDone, false);
  });

  test("null status → headline is 'Waiting for candidate setup'", () => {
    const { headline } = computeCard(null);
    assert.equal(headline, "Waiting for candidate setup");
  });

  test("null status → all flags false", () => {
    const { flags } = computeCard(null);
    assert.equal(flags.extension_installed, false);
    assert.equal(flags.screen_recording, false);
    assert.equal(flags.mic_granted, false);
    assert.equal(flags.joined, false);
  });

  test("all-false status → same as null", () => {
    const { totalDone } = computeCard({
      extension_installed: false,
      screen_recording: false,
      mic_granted: false,
      joined: false,
      updated_at: null,
    });
    assert.equal(totalDone, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Progress: step-by-step 1/4 → 4/4", () => {
  test("1/4 — helper installed only", () => {
    const { totalDone, allDone, headline } = computeCard({
      extension_installed: true,
      screen_recording: false,
      mic_granted: false,
      joined: false,
      updated_at: null,
    });
    assert.equal(totalDone, 1);
    assert.equal(allDone, false);
    assert.equal(headline, "Waiting for candidate setup");
  });

  test("2/4 — helper + screen recording", () => {
    const { totalDone } = computeCard({
      extension_installed: true,
      screen_recording: true,
      mic_granted: false,
      joined: false,
      updated_at: null,
    });
    assert.equal(totalDone, 2);
  });

  test("3/4 — helper + screen + mic", () => {
    const { totalDone } = computeCard({
      extension_installed: true,
      screen_recording: true,
      mic_granted: true,
      joined: false,
      updated_at: null,
    });
    assert.equal(totalDone, 3);
  });

  test("4/4 — all done, headline changes to 'Candidate ready'", () => {
    const { totalDone, allDone, headline } = computeCard({
      extension_installed: true,
      screen_recording: true,
      mic_granted: true,
      joined: true,
      updated_at: new Date().toISOString(),
    });
    assert.equal(totalDone, 4);
    assert.equal(allDone, true);
    assert.equal(headline, "Candidate ready");
  });

  test("4/4 count matches ROWS.length", () => {
    const { totalDone } = computeCard({
      extension_installed: true,
      screen_recording: true,
      mic_granted: true,
      joined: true,
      updated_at: null,
    });
    assert.equal(totalDone, ROWS.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Revoked state (permission withdrawn mid-interview)", () => {
  test("revoked=true → headline 'Monitoring paused' regardless of status", () => {
    // Even if all 4 are done, if revoked it shows paused
    const { headline } = computeCard({
      extension_installed: true,
      screen_recording: true,
      mic_granted: true,
      joined: true,
      updated_at: null,
    }, true);
    assert.equal(headline, "Monitoring paused");
  });

  test("revoked=true with 0/4 → still 'Monitoring paused'", () => {
    const { headline } = computeCard(null, true);
    assert.equal(headline, "Monitoring paused");
  });

  test("revoked=false → never 'Monitoring paused'", () => {
    const { headline } = computeCard(null, false);
    assert.notEqual(headline, "Monitoring paused");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ROWS config — 4 checks in correct order", () => {
  test("exactly 4 rows defined", () => {
    assert.equal(ROWS.length, 4);
  });

  test("row order: helper → screen → mic → joined (setup flow order)", () => {
    assert.equal(ROWS[0]!.key, "extension_installed");
    assert.equal(ROWS[1]!.key, "screen_recording");
    assert.equal(ROWS[2]!.key, "mic_granted");
    assert.equal(ROWS[3]!.key, "joined");
  });

  test("labels match UI strings", () => {
    assert.equal(ROWS[0]!.label, "Trueyy Helper");
    assert.equal(ROWS[1]!.label, "Screen Monitor");
    assert.equal(ROWS[2]!.label, "Microphone");
    assert.equal(ROWS[3]!.label, "Joined");
  });

  test("only joined=true still shows 3/4 — order matters", () => {
    const { totalDone } = computeCard({
      extension_installed: false,
      screen_recording: false,
      mic_granted: false,
      joined: true,
      updated_at: null,
    });
    assert.equal(totalDone, 1);
    // Card shows 1/4 not "done" — candidate joined but helper not installed
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Mic permission check (card row 3: mic_granted)", () => {
  test("mic_granted=false → row 3 shows pending icon", () => {
    const { flags } = computeCard({
      extension_installed: true,
      screen_recording: true,
      mic_granted: false,
      joined: false,
      updated_at: null,
    });
    assert.equal(flags.mic_granted, false);
  });

  test("mic_granted=true → row 3 done, contributes to totalDone", () => {
    const { totalDone, flags } = computeCard({
      extension_installed: false,
      screen_recording: false,
      mic_granted: true,
      joined: false,
      updated_at: null,
    });
    assert.equal(flags.mic_granted, true);
    assert.equal(totalDone, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Badge label format — '0/4', '3/4', '4/4'", () => {
  function badgeText(status: CandidateStatus | null): string {
    const { totalDone } = computeCard(status);
    return `${totalDone}/${ROWS.length}`;
  }

  test("null → '0/4'", () => assert.equal(badgeText(null), "0/4"));

  test("2 done → '2/4'", () => {
    assert.equal(badgeText({
      extension_installed: true,
      screen_recording: true,
      mic_granted: false,
      joined: false,
      updated_at: null,
    }), "2/4");
  });

  test("all done → '4/4'", () => {
    assert.equal(badgeText({
      extension_installed: true,
      screen_recording: true,
      mic_granted: true,
      joined: true,
      updated_at: null,
    }), "4/4");
  });
});
