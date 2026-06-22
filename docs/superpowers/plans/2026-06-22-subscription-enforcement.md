# Subscription Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate interview creation, team invites, interview duration, and live monitoring behind the active subscription plan using a shared SubscriptionContext.

**Architecture:** Single `SubscriptionContext` fetches and caches subscription data app-wide (no per-component fetches). Derived booleans (`canCreateInterview`, `canInviteMember`) are computed once in context. Gate points consume context and render disabled states + `/billing` CTAs. MonitoringView polls subscription and shows a 10-minute countdown banner when the session is about to be force-stopped.

**Tech Stack:** React context + hooks, MUI Tooltip/Alert/Chip, existing `BillingService`, existing `Subscription` / `Plan` types from `billing.types.ts`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/contexts/SubscriptionContext.tsx` | **Create** | Fetch subscription, compute derived booleans, expose via context |
| `src/hooks/useSubscription.ts` | **Create** | Thin hook — `useContext(SubscriptionContext)` with guard |
| `src/components/common/SubscriptionGate.tsx` | **Create** | Reusable wrapper: disabled + tooltip + `/billing` CTA |
| `src/components/Monitoring/PlanExpiryBanner.tsx` | **Create** | Sticky countdown banner for MonitoringView |
| `src/App.tsx` | **Modify** | Wrap `AppRoutes` with `SubscriptionProvider` |
| `src/components/AppLayout/AppInterviewList.tsx` | **Modify** | Gate "New Interview" button + usage counter |
| `src/components/AppLayout/CreateInterviewPage.tsx` | **Modify** | Gate submit (edit bypass) + clamp duration dropdown |
| `src/components/Team/TeamPage.tsx` | **Modify** | Gate "Invite teammate" + usage counter |
| `src/components/Monitoring/MonitoringView.tsx` | **Modify** | Mount `PlanExpiryBanner` |

---

## Task 1: SubscriptionContext

**Files:**
- Create: `src/contexts/SubscriptionContext.tsx`

- [ ] **Step 1: Create the context file**

```tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BillingService } from '../services/billing.service';
import type { Subscription } from '../types/billing.types';

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  canCreateInterview: boolean;
  canInviteMember: boolean;
  interviewsRemaining: number;
  seatsRemaining: number | null;
  maxMinutesPerInterview: number;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const ALLOWED_STATUSES = new Set(['trial', 'active', 'charged', 'created']);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const sub = await BillingService.getSubscription();
      setSubscription(sub);
    } catch {
      // fail open — don't block user on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refetch every 5 minutes to catch expiry while user is idle
    const t = setInterval(refresh, 5 * 60 * 1000);
    // Refetch when tab regains focus
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const isStatusAllowed = subscription ? ALLOWED_STATUSES.has(subscription.status) : false;

  const canCreateInterview =
    isStatusAllowed && (subscription?.interviews_remaining ?? 0) > 0;

  const canInviteMember = (() => {
    if (!isStatusAllowed || !subscription) return false;
    const maxSeats = subscription.plan.max_seats;
    if (maxSeats === null) return true; // unlimited
    return subscription.seats_used < maxSeats;
  })();

  const interviewsRemaining = subscription?.interviews_remaining ?? 0;

  const seatsRemaining = (() => {
    if (!subscription) return null;
    const maxSeats = subscription.plan.max_seats;
    if (maxSeats === null) return null; // unlimited
    return Math.max(0, maxSeats - subscription.seats_used);
  })();

  const maxMinutesPerInterview = subscription?.plan.minutes_per_interview ?? 60;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        canCreateInterview,
        canInviteMember,
        interviewsRemaining,
        seatsRemaining,
        maxMinutesPerInterview,
        refresh,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextType {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/SubscriptionContext.tsx
git commit -m "feat: add SubscriptionContext with derived gate booleans"
```

---

## Task 2: Wire SubscriptionProvider into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and wrap**

Find this in `App.tsx`:
```tsx
import { CompanyProvider } from './contexts/CompanyContext';
```

Add after it:
```tsx
import { SubscriptionProvider } from './contexts/SubscriptionContext';
```

- [ ] **Step 2: Wrap AppRoutes**

Find the return in the root `App` component (or wherever `AuthProvider` wraps everything). Add `SubscriptionProvider` inside `AuthProvider` but outside `AppRoutes`:

```tsx
<AuthProvider>
  <CompanyProvider>
    <SnackbarProvider>
      <SubscriptionProvider>
        <AppRoutes />
      </SubscriptionProvider>
    </SnackbarProvider>
  </CompanyProvider>
</AuthProvider>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wrap app with SubscriptionProvider"
```

---

## Task 3: SubscriptionGate component

**Files:**
- Create: `src/components/common/SubscriptionGate.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface SubscriptionGateProps {
  gate: 'interview' | 'seat';
  children: React.ReactElement;
}

/**
 * Wraps any clickable element. When the relevant gate is closed,
 * clones the child with disabled=true and wraps in a Tooltip explaining why.
 * Does not render its own CTA — callers add that separately where needed.
 */
export function SubscriptionGate({ gate, children }: SubscriptionGateProps) {
  const { canCreateInterview, canInviteMember, subscription, loading } = useSubscription();

  if (loading) return children;

  const allowed = gate === 'interview' ? canCreateInterview : canInviteMember;
  if (allowed) return children;

  const isTrial = subscription?.status === 'trial';
  const isHalted = subscription?.status === 'halted';
  const noSub = !subscription;

  let tip = 'Upgrade your plan to continue.';
  if (gate === 'interview') {
    if (isTrial) tip = 'Trial interviews exhausted. Choose a plan to continue.';
    else if (isHalted) tip = 'Payment failed. Resume your subscription to create interviews.';
    else if (noSub) tip = 'No active plan. Choose a plan to get started.';
    else tip = 'Interview limit reached. Upgrade to continue.';
  } else {
    tip = `Seat limit reached. Upgrade your plan to add more members.`;
  }

  return (
    <Tooltip title={tip} placement="top" arrow>
      <span>
        {/* span wrapper needed — Tooltip needs a DOM node, disabled buttons don't forward events */}
        {React.cloneElement(children, { disabled: true })}
      </span>
    </Tooltip>
  );
}
```

Add `import React from 'react';` at the top.

- [ ] **Step 2: Export from common index (if one exists)**

Check `src/components/common/index.ts`. If it exists, add:
```ts
export { SubscriptionGate } from './SubscriptionGate';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/common/SubscriptionGate.tsx
git commit -m "feat: add reusable SubscriptionGate component"
```

---

## Task 4: Gate "New Interview" in AppInterviewList + usage counter

**Files:**
- Modify: `src/components/AppLayout/AppInterviewList.tsx`

- [ ] **Step 1: Import useSubscription and SubscriptionGate**

At top of file add:
```tsx
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SubscriptionGate } from '../common/SubscriptionGate';
```

- [ ] **Step 2: Consume subscription in component body**

Inside `AppInterviewList()`, after existing hooks:
```tsx
const { canCreateInterview, interviewsRemaining, subscription } = useSubscription();
const interviewsTotal = subscription?.plan.interviews_per_cycle ?? 0;
```

- [ ] **Step 3: Wrap "New Interview" button with SubscriptionGate**

Find the existing "New Interview" `ActionButton` (it has `onClick={() => navigate('/interviews/new')}`). Wrap it:

```tsx
<SubscriptionGate gate="interview">
  <ActionButton
    startIcon={<AddIcon sx={{ fontSize: 16 }} />}
    onClick={() => navigate('/interviews/new')}
  >
    New Interview
  </ActionButton>
</SubscriptionGate>
```

- [ ] **Step 4: Add usage counter next to header**

Find the page header `Box` that contains the title ("Interviews"). Add usage chip after the title text, only for staff:

```tsx
{isInterviewer && subscription && (
  <Chip
    label={`${subscription.interviews_used} / ${interviewsTotal} interviews used`}
    size="small"
    sx={{
      ml: 1.5,
      fontSize: '0.75rem',
      bgcolor: interviewsRemaining === 0 ? '#FEE2E2' : '#F3F4F6',
      color: interviewsRemaining === 0 ? '#DC2626' : '#6B7280',
      fontWeight: 500,
    }}
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AppLayout/AppInterviewList.tsx
git commit -m "feat: gate New Interview button and show usage counter"
```

---

## Task 5: Gate submit + clamp duration in CreateInterviewPage

**Files:**
- Modify: `src/components/AppLayout/CreateInterviewPage.tsx`

- [ ] **Step 1: Import useSubscription**

```tsx
import { useSubscription } from '../../contexts/SubscriptionContext';
```

- [ ] **Step 2: Consume in component body**

Inside `CreateInterviewPage()`:
```tsx
const { canCreateInterview, maxMinutesPerInterview, subscription } = useSubscription();
const isEditMode = !!editingId;
```

- [ ] **Step 3: Clamp duration dropdown**

Find the `DURATIONS` constant at the top of the file. Instead of using it directly, filter it inside the component:

```tsx
const allowedDurations = DURATIONS.filter((d) => d.value <= maxMinutesPerInterview);
```

Replace `{DURATIONS.map(...)` in the Duration `FormField` with `{allowedDurations.map(...)}`.

- [ ] **Step 4: Clamp pre-selected duration in edit mode + show warning**

Add state for duration warning:
```tsx
const [durationClamped, setDurationClamped] = useState(false);
```

In the prefill `useEffect`, after `setDuration(...)`:
```tsx
const computedDuration = Math.max(15, end.diff(start, 'minute'));
if (computedDuration > maxMinutesPerInterview) {
  setDuration(maxMinutesPerInterview);
  setDurationClamped(true);
} else {
  setDuration(computedDuration);
}
```

Render warning below the Duration field:
```tsx
{durationClamped && (
  <Alert severity="warning" sx={{ borderRadius: '10px', mt: 1 }}>
    Your plan allows up to {maxMinutesPerInterview} min per interview. Duration has been adjusted.
  </Alert>
)}
```

- [ ] **Step 5: Block submit when quota exhausted (create mode only)**

At the top of `handleSubmit`, before other checks:
```tsx
if (!isEditMode && !canCreateInterview) {
  setError('Interview limit reached. Upgrade your plan to create more interviews.');
  return;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/AppLayout/CreateInterviewPage.tsx
git commit -m "feat: gate interview creation submit and clamp duration to plan limit"
```

---

## Task 6: Gate "Invite teammate" + usage counter in TeamPage

**Files:**
- Modify: `src/components/Team/TeamPage.tsx`

- [ ] **Step 1: Import**

```tsx
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SubscriptionGate } from '../common/SubscriptionGate';
```

- [ ] **Step 2: Consume**

Inside `TeamPage()`:
```tsx
const { canInviteMember, seatsRemaining, subscription } = useSubscription();
const maxSeats = subscription?.plan.max_seats ?? null;
const seatsUsed = subscription?.seats_used ?? 0;
```

- [ ] **Step 3: Wrap "Invite teammate" button**

Find the `ActionButton` with `onClick={handleOpenDialog}`. Wrap:

```tsx
<SubscriptionGate gate="seat">
  <ActionButton startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={handleOpenDialog}>
    Invite teammate
  </ActionButton>
</SubscriptionGate>
```

- [ ] **Step 4: Guard handleSubmit before API call**

At the top of `handleSubmit`:
```tsx
if (!canInviteMember) {
  showError('Seat limit reached. Upgrade your plan to add more members.');
  return;
}
```

- [ ] **Step 5: Add seats counter in header**

After the "Invite teammates" description `Secondary` text:
```tsx
{maxSeats !== null && subscription && (
  <Chip
    label={`${seatsUsed} / ${maxSeats} seats used`}
    size="small"
    sx={{
      mt: 0.5,
      fontSize: '0.75rem',
      bgcolor: seatsRemaining === 0 ? '#FEE2E2' : '#F3F4F6',
      color: seatsRemaining === 0 ? '#DC2626' : '#6B7280',
      fontWeight: 500,
    }}
  />
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Team/TeamPage.tsx
git commit -m "feat: gate invite teammate button and show seat usage counter"
```

---

## Task 7: PlanExpiryBanner component

**Files:**
- Create: `src/components/Monitoring/PlanExpiryBanner.tsx`

- [ ] **Step 1: Create the banner**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface PlanExpiryBannerProps {
  /** Timestamp (ms) when the session was flagged for termination */
  flaggedAt: number;
  /** Max countdown seconds — capped to min(600, timeRemainingInSession) by caller */
  countdownSeconds: number;
  onExpired: () => void;
}

export function PlanExpiryBanner({ flaggedAt, countdownSeconds, onExpired }: PlanExpiryBannerProps) {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(countdownSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - flaggedAt) / 1000);
      const left = Math.max(0, countdownSeconds - elapsed);
      setRemaining(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [flaggedAt, countdownSeconds, onExpired]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <Box
      sx={{
        width: '100%',
        bgcolor: '#FEF3C7',
        borderBottom: '1px solid #FCD34D',
        px: 3,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <WarningIcon sx={{ color: '#D97706', fontSize: 20, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#92400E' }}>
          Analysis stopping in{' '}
          <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {timeStr}
          </Box>
          {' '}— subscription issue detected.
        </Typography>
      </Box>
      <Button
        size="small"
        variant="contained"
        onClick={() => navigate('/billing')}
        sx={{
          bgcolor: '#D97706',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.8125rem',
          textTransform: 'none',
          borderRadius: '8px',
          flexShrink: 0,
          '&:hover': { bgcolor: '#B45309' },
        }}
      >
        Upgrade Plan
      </Button>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Monitoring/PlanExpiryBanner.tsx
git commit -m "feat: add PlanExpiryBanner countdown component for MonitoringView"
```

---

## Task 8: Wire PlanExpiryBanner into MonitoringView

**Files:**
- Modify: `src/components/Monitoring/MonitoringView.tsx`

- [ ] **Step 1: Import**

```tsx
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanExpiryBanner } from './PlanExpiryBanner';
```

- [ ] **Step 2: Consume subscription + expiry state**

Inside `MonitoringView()`:
```tsx
const { subscription, refresh: refreshSubscription } = useSubscription();

// Tracks when plan expiry was first detected during this live session.
// null = not flagged. Once set, PlanExpiryBanner mounts and counts down.
const [expiryFlaggedAt, setExpiryFlaggedAt] = useState<number | null>(null);
```

- [ ] **Step 3: Poll subscription during live session**

Add effect after existing hooks:
```tsx
useEffect(() => {
  if (!interview || interview.status !== 'ACTIVE') return;

  const check = async () => {
    await refreshSubscription();
  };

  // Check every 60s while session is live
  const t = setInterval(check, 60_000);
  return () => clearInterval(t);
}, [interview?.status, refreshSubscription]);
```

- [ ] **Step 4: Detect expiry and set flaggedAt**

Add effect that watches subscription status:
```tsx
const ALLOWED = new Set(['trial', 'active', 'charged', 'created']);

useEffect(() => {
  if (!subscription || !interview || interview.status !== 'ACTIVE') return;
  const isAllowed = ALLOWED.has(subscription.status);
  const hasQuota = subscription.interviews_remaining > 0;
  if (!isAllowed || !hasQuota) {
    // Only flag once — don't reset if already counting down
    setExpiryFlaggedAt((prev) => prev ?? Date.now());
  }
}, [subscription, interview?.status]);
```

- [ ] **Step 5: Compute capped countdown seconds**

```tsx
const countdownSeconds = (() => {
  if (!expiryFlaggedAt || !interview?.scheduled_end_at) return 600;
  const sessionEnd = new Date(interview.scheduled_end_at).getTime();
  const timeLeftInSession = Math.max(0, Math.floor((sessionEnd - expiryFlaggedAt) / 1000));
  return Math.min(600, timeLeftInSession); // cap at 10 minutes
})();
```

- [ ] **Step 6: Mount banner in render**

In the JSX, find the outermost `Box` wrapper of `MonitoringView`. Add the banner as the **first child**, before any existing content:

```tsx
<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
  {expiryFlaggedAt && (
    <PlanExpiryBanner
      flaggedAt={expiryFlaggedAt}
      countdownSeconds={countdownSeconds}
      onExpired={() => {
        // Analysis already stopped server-side. Navigate to post-analysis.
        navigate(`/interviews/${interviewId}/analysis`);
      }}
    />
  )}
  {/* ... rest of existing MonitoringView JSX ... */}
</Box>
```

- [ ] **Step 7: Commit**

```bash
git add src/components/Monitoring/MonitoringView.tsx
git commit -m "feat: show plan expiry countdown in MonitoringView, redirect on expire"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Interview creation gate — Task 4 + 5
- [x] Edit mode bypasses quota — Task 5 Step 5 (`!isEditMode` guard)
- [x] Cancel does NOT restore quota — no quota restoration code anywhere ✓
- [x] Trial auto-assign — handled server-side, no frontend task needed ✓
- [x] Pending invites do NOT count seats — `seats_used` from server only counts accepted members ✓
- [x] Owner counts against max_seats — `seats_used` from server includes owner ✓
- [x] Duration cap with warn+clamp — Task 5 Steps 3+4
- [x] Fail open on fetch error — Task 1 (catch block, setLoading(false), subscription stays null, `canCreateInterview` = false... wait)

**Gap found:** With `subscription = null` (fetch failed), `canCreateInterview = false` blocks user. That's fail-closed, not fail-open. Fix in Task 1:

Add a separate `fetchFailed` flag:
```tsx
const [fetchFailed, setFetchFailed] = useState(false);

// in refresh():
try {
  const sub = await BillingService.getSubscription();
  setSubscription(sub);
  setFetchFailed(false);
} catch {
  setFetchFailed(true); // fail open — don't change subscription state
} finally {
  setLoading(false);
}

// derived booleans:
const canCreateInterview =
  fetchFailed || (isStatusAllowed && (subscription?.interviews_remaining ?? 0) > 0);

const canInviteMember =
  fetchFailed || (() => { ... })();
```

Update Task 1 Step 1 accordingly.

- [x] Halted mid-interview → finish current session — Task 8 polls subscription. Banner shows. Countdown runs. Session finishes naturally. Hard stop only fires `onExpired` after countdown. ✓
- [x] Countdown capped at min(10min, time_remaining) — Task 8 Step 5 ✓
- [x] Upgrade CTA → `/billing` — SubscriptionGate tooltip + PlanExpiryBanner both navigate to `/billing` ✓
- [x] Usage counters — Task 4 Step 4, Task 6 Step 5 ✓
- [x] Seat counter shows only when max_seats !== null — Task 6 Step 5 (`maxSeats !== null` guard) ✓

### No placeholders — confirmed all steps have actual code.

### Type consistency
- `useSubscription()` returns `SubscriptionContextType` — all consumers destructure matching fields ✓
- `PlanExpiryBanner` props: `flaggedAt: number`, `countdownSeconds: number`, `onExpired: () => void` — Task 8 passes all three ✓
- `SubscriptionGate` prop `gate: 'interview' | 'seat'` — Task 4 passes `"interview"`, Task 6 passes `"seat"` ✓
