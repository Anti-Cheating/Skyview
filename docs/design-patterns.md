# Skyview Design Patterns

A short, opinionated catalog of the components, primitives, and patterns every new page in Skyview should reach for. **Read this before adding a new page or copying patterns from elsewhere.** If a page in `src/` doesn't follow these patterns, it's older than this doc — bring it in line when you next touch it.

The Trueyy aesthetic is **Linear / Vercel / Notion / antd** — neutral grays, brand green for actions, subtle motion, dense but breathable lists. Avoid bespoke CSS, avoid raw MUI `<Typography variant=…>` and `<Button variant=…>` — there is a primitive for that.

## TL;DR — the canonical page

```tsx
<Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
  {/* 1. Header */}
  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
    <Box>
      <PageTitle>{title}</PageTitle>
      <Secondary>{subtitle}</Secondary>
    </Box>
    <ActionButton onClick={onPrimary}>Primary action</ActionButton>
  </Stack>

  {/* 2. (optional) Tabs — see "Tabs" section below for the canonical sx block */}
  <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
        sx={TABS_SX}>
    {TABS.map(t => <Tab key={t.value} value={t.value} label={t.label} />)}
  </Tabs>
  {/* tab content goes directly below — NO wrapping Paper */}

  {/* 3. (optional) Search */}
  <TextField size="small" fullWidth placeholder="Search …"
             value={q} onChange={...} sx={{ mb: 2, bgcolor: '#fff' }}
             InputProps={{ startAdornment:
               <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />

  {/* 4. List */}
  <DataTable columns={columns} rows={rows} rowKey={r => r.id} loading={loading}
             emptyState={<Secondary>No data yet.</Secondary>}
             pagination={{ page, pageSize, total, showSizeChanger: false, onChange: setPage }} />
</Box>
```

## Typography

Always use the semantic wrappers in `src/components/layout/Typography.tsx`. **Never** use raw `<Typography variant=…>` or `sx={{ fontSize: … }}`.

| Component | When |
|---|---|
| `<PageTitle>` | Top-of-page heading. One per route. |
| `<SectionHeading>` | Major section inside a page. |
| `<CardTitle>` | Title of a card / stepper / dialog. |
| `<SubHeading>` / `<MicroHeading>` | Nested sub-titles inside a card. |
| `<Body>` | Default paragraph text. |
| `<Secondary>` | Muted paragraph / helper text. |
| `<Caption>` | Small meta — "2 min ago", row sublabels, monospace ids. |
| `<Overline>` | Uppercase tracked label — "RECENT", "APPS". |

Only override `color` via `sx={{ color: TOKENS.textSecondary }}` etc. Never override `fontSize`.

## Buttons

```tsx
<ActionButton onClick={save}>Save</ActionButton>            // primary CTA
<ActionButton variant="secondary" onClick={cancel}>Cancel</ActionButton>
<ActionButton loading>Saving…</ActionButton>
```

`ActionButton` lives in `src/components/common/ActionButton.tsx`. It forwards all MUI `ButtonProps` — `startIcon`, `disabled`, `fullWidth`, etc. work. **Never** use raw `<Button variant="contained">`.

## Form inputs

```tsx
<FormField label="Email" value={email} onChange={...} />
<FormField label="Role" select value={role}>{...menu...}</FormField>
<FormField label="Email" value={meta.email} locked />          // non-editable but readable
<FormField label="Notes" multiline minRows={2} ... />
```

`FormField` lives in `src/components/common/FormField.tsx`. Renders an external label above an MUI `<TextField>` styled with the shared `INPUT_SX`. Use this for every form input in Skyview. **Never** use a raw `<TextField>` for form fields.

(One exception: search inputs in list headers use a raw `<TextField size="small">` with `InputAdornment` because they aren't form fields — they're search bars. See the AppInterviewList / TenantList header pattern above.)

## Tables — the `<DataTable>` primitive

Every list view uses `<DataTable>` from `src/components/common/DataTable.tsx`. It gives you:

- antd-style header (`#FAFAFA` bg, bold near-black text)
- hairline row borders, subtle hover tint
- skeleton rows while `loading`
- centered `emptyState` slot
- controlled pagination (caller owns `page` / `pageSize` state)
- optional sticky header (`maxBodyHeight`)
- row actions slot via your last column

```tsx
const columns: DataTableColumn<Row>[] = [
  { key: 'name',   header: 'Name',   render: r => <Body sx={{ fontWeight: 600 }}>{r.name}</Body> },
  { key: 'status', header: 'Status', render: r => <StatusChip status={r.status} /> },
  { key: 'act',    header: '',       align: 'right',
    render: r => <IconButton onClick={() => open(r)}><ChevronRightIcon /></IconButton> },
];

<DataTable
  columns={columns}
  rows={rows}
  rowKey={r => r.id}
  loading={loading}
  emptyState={<Secondary>No items.</Secondary>}
  pagination={{ page, pageSize: 20, total, showSizeChanger: false, onChange: setPage }}
/>
```

Sort UI was deliberately dropped — pick a server-side default order. Click-to-sort is chrome users don't reach for.

## Tabs — the canonical underline-tab block

**This is the ONLY tab pattern in Skyview.** Used on the Users page, TenantDetail, SettingsLayout, etc. Don't introduce sidebar-nav tabs, MUI segmented buttons, or pills — they all read as the same gesture inconsistently. One pattern, applied everywhere.

```tsx
<Tabs
  value={tab}
  onChange={(_, v) => setTab(v)}
  variant="scrollable"
  scrollButtons="auto"
  sx={{
    mb: 2.5,
    minHeight: 36,
    borderBottom: `1px solid ${TOKENS.border}`,
    '& .MuiTabs-flexContainer': { gap: 2.5 },
    '& .MuiTab-root': {
      textTransform: 'none',
      fontWeight: 500,
      fontSize: '0.875rem',
      minHeight: 36,
      px: 0,
      py: 1,
      minWidth: 0,
      color: TOKENS.textSecondary,
      '&:hover': { color: TOKENS.textPrimary },
    },
    '& .Mui-selected': { color: `${TOKENS.textPrimary} !important`, fontWeight: 600 },
    '& .MuiTabs-indicator': { backgroundColor: TOKENS.brand, height: 2 },
  }}
>
  <Tab value="members" label={
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      Members
      <TabCountBadge count={membersTotal} active={tab === 'members'} />
    </Box>
  } />
  <Tab value="pending" label={
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      Pending invitations
      <TabCountBadge count={pendingTotal} active={tab === 'pending'} />
    </Box>
  } />
</Tabs>

{tab === 'members' && <MembersPane />}
{tab === 'pending' && <PendingPane />}
```

**Tab content lives directly below the `<Tabs>` element — no wrapping `<Paper>`.**

Visual reference: the Users page (`/users`) renders this exactly.

### Tab count badges

```tsx
function TabCountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        ml: 0.75, px: 0.75, height: 18, minWidth: 18, borderRadius: '999px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.6875rem', fontWeight: 600,
        bgcolor: active ? TOKENS.brandBg : '#F3F4F6',
        color:   active ? TOKENS.brandHover : TOKENS.textSecondary,
      }}
    >
      {count}
    </Box>
  );
}
```

### Routed tabs (e.g. SettingsLayout)

When each tab is its own route (so deep-links + browser back work), drive `value` from `useLocation()` and call `navigate()` in `onChange`. See `SettingsLayout.tsx` for the exact wiring.

### Anti-patterns — don't do these

- **Sidebar-nav tabs** (the old `SettingsLayout` 240px-wide left rail). Replaced.
- **`<Paper>` wrapping the tabs + body**. Tabs are not a card.
- **MUI defaults** — uppercase, big 600 weight on idle, no underline indicator color override. Hideous.
- **`<Chip>`-style tab pills**. Reserve chips for status.

## Search input (in list headers)

```tsx
<TextField
  size="small"
  fullWidth
  placeholder="Search …"
  value={search}
  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
  sx={{ mb: 2, bgcolor: '#fff' }}
  InputProps={{
    startAdornment: (
      <InputAdornment position="start">
        <SearchIcon fontSize="small" sx={{ color: TOKENS.textSecondary }} />
      </InputAdornment>
    ),
  }}
/>
```

Note: search inputs in lists are **not** `<FormField>` — they aren't form fields.

## Status / role / topology chips

Every list shows status somewhere. Use a soft-tinted pill (not MUI's default `<Chip>`):

```tsx
<Box component="span" sx={{
  display: 'inline-flex', alignItems: 'center', px: 1, height: 22,
  borderRadius: '6px', bgcolor: c.bg, color: c.fg,
  fontSize: '0.75rem', fontWeight: 600, lineHeight: 1,
  textTransform: 'capitalize',
}}>
  {status}
</Box>
```

Colors (matched to TeamPage's RolePill):

| State | bg | fg |
|---|---|---|
| success (`active`, `succeeded`, `paid`) | `rgba(34,197,94,0.12)` | `#15803D` |
| error (`suspended`, `failed`, `dead_lettered`, `overdue`) | `rgba(239,68,68,0.12)` | `#B91C1C` |
| warning (`running`, `pending`, `paused`) | `rgba(234,179,8,0.12)` | `#A16207` |
| neutral (anything else) | `#F3F4F6` | `#4B5563` |

For roles, add a leading 6px dot in the foreground hue. See `RolePill` in `TeamPage.tsx`.

## Dialogs

```tsx
<Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>
    <DialogContentText sx={{ mb: 2 }}>Explainer.</DialogContentText>
    <FormField label="…" value={…} onChange={…} />
  </DialogContent>
  <DialogActions>
    <ActionButton variant="secondary" onClick={close}>Cancel</ActionButton>
    <ActionButton onClick={submit}>Confirm</ActionButton>
  </DialogActions>
</Dialog>
```

- `maxWidth="sm" fullWidth` is the default.
- Two buttons in `<DialogActions>`: secondary "Cancel" on the left, primary action on the right.
- Use `<FormField>` for inputs inside the dialog body.

## Page padding & width

```tsx
<Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
```

Every top-level page is centered at 1280px max width with `p: 3`. Pages with full-bleed sidebars (like Settings) wrap content in `<Paper sx={{ p: 3 }}>` instead.

## Empty states

Centered, single-line, muted. No emoji, no illustration unless the empty state is the *primary* path (e.g., onboarding).

```tsx
emptyState={<Secondary>No tenants match that search.</Secondary>}
```

## Loading states

- Lists → use `<DataTable loading={true} />`. It renders skeleton rows.
- Forms → use `<ActionButton loading>` on the submit button.
- Full-page → use `<LoadingSpinner fullScreen message="…" />` from `src/components/common`.

Never show a raw `<CircularProgress />` outside these primitives.

## Animations

Lists fade rows in/out via `framer-motion` inside `<DataTable>` automatically. Cards use `<motion.div layout>` (see AppInterviewList card grid). Don't add hand-rolled transitions unless you're animating a unique interaction.

## Theme tokens

```tsx
import { TOKENS } from '../theme';
```

Common ones:
- `TOKENS.brand`, `TOKENS.brandBg`, `TOKENS.brandHover` — green primary
- `TOKENS.textPrimary`, `TOKENS.textSecondary` — gray text
- `TOKENS.border`, `TOKENS.borderLight` — hairline / muted borders

Always reach for a token before hard-coding a hex.

## File layout

```
src/
  components/
    common/        primitives — DataTable, ActionButton, FormField, Shimmer, ...
    layout/        Sidebar, Typography, TruoyyLogo, theme tokens
    AppLayout/     Routed pages (Dashboard / Interviews / …)
    Admin/         SuperAdmin pages (Tenants / TenantDetail / …)
    Settings/      Company-admin settings tabs
    Team/          Company-admin members page
    ...
  services/        ApiService callers — one file per backend module
  contexts/        Cross-page React state (Auth, Company, Snackbar)
  types/           Shared TypeScript interfaces (auth, interview, ...)
```

New pages live under whichever feature directory matches their route. New service methods live in the matching `*.service.ts` (one per backend module).

## When to break a rule

You can — but write a one-line comment explaining why, and prefer fixing the primitive over adding a one-off. If three pages need the same exception, the primitive is wrong, not your page.

## Checklist before opening a PR

- [ ] Used semantic Typography wrappers (`<PageTitle>`, `<Body>`, …) — no raw `<Typography variant=…>`
- [ ] Used `<ActionButton>` — no raw `<Button variant="contained">`
- [ ] Used `<FormField>` for every form input — no raw `<TextField>` form fields
- [ ] Used `<DataTable>` for every list — no raw `<Table>` / `<TableBody>` / `<TableRow>`
- [ ] Tabs styled with `textTransform: 'none'` and `fontWeight: 600`
- [ ] Status pills follow the color matrix above
- [ ] Page wrapped in `<Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>`
- [ ] Empty state uses `<Secondary>` single line, no emoji
- [ ] Loading uses the primitives, not raw `<CircularProgress />`
- [ ] Theme tokens, not hex literals
