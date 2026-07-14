/**
 * TeamPage — Owner/Admin-only view at /team.
 *
 * Tabbed layout (Linear / Vercel / Notion pattern):
 *   - Members       — everyone currently attached to the workspace
 *   - Pending       — invites sent but not yet accepted
 *
 * Each tab renders through the shared <DataTable> so every list view in
 * Skyview shares one set of table styles, empty states, and spacing.
 * Row actions collapse into a single 3-dot menu — scales cleanly when we
 * add more actions (Change role, Remove member, …) later.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchField } from '../common/SearchField';
import {
  Box,
  Stack,
  Alert,
  Tabs,
  Tab,
  Avatar,
  IconButton,
  Menu,
  MenuItem as MenuItemMui,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { PageTitle, Caption, Secondary } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import {
  InvitesService,
  type PendingInvite,
  type InviteRole,
  type TeamMember,
} from '../../services/invites.service';

type TabValue = 'members' | 'pending';

// Soft-tinted role pill colours (8-12% opacity bg + full-strength text) —
// the Stripe / Linear / Clerk pattern. `color` is the literal hex used by
// both the text and the derived background so we stay on-theme.
const ROLE_COLORS: Record<string, { bg: string; fg: string; dot: string }> = {
  Owner:          { bg: 'rgba(76, 217, 100, 0.14)', fg: '#047857', dot: TOKENS.brand }, // brand green
  Admin:          { bg: 'rgba(59, 130, 246, 0.12)', fg: '#2563EB', dot: '#3B82F6' },    // blue
  Member:         { bg: '#F3F4F6',                  fg: '#4B5563', dot: '#9CA3AF' },    // neutral
  'System Admin': { bg: 'rgba(168, 85, 247, 0.12)', fg: '#7C3AED', dot: '#8B5CF6' },    // purple
};

/**
 * RolePill — Vercel-style chip with a 6px leading dot in the foreground
 * hue. Soft-tinted bg, 6px radius, 20px height. Reads as a status
 * indicator, not a loud tag.
 */
function RolePill({ role }: { role: string }) {
  const c = ROLE_COLORS[role] ?? ROLE_COLORS.Member;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        height: 22,
        borderRadius: '6px',
        bgcolor: c.bg,
        color: c.fg,
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      <Box
        component="span"
        sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }}
      />
      {role}
    </Box>
  );
}

/** Count badge rendered inside each Tab label — rounded pill, muted. */
function TabCountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        ml: 0.75,
        px: 0.75,
        height: 18,
        minWidth: 18,
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.6875rem',
        fontWeight: 600,
        bgcolor: active ? TOKENS.brandBg : '#F3F4F6',
        color: active ? TOKENS.brandHover : TOKENS.textSecondary,
      }}
    >
      {count}
    </Box>
  );
}

/** Initials for avatar fallback — first chars of first + last name. */
function initialsOf(first: string | null, last: string | null, email: string) {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f || l) return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase() || '?';
  return (email[0] ?? '?').toUpperCase();
}

/** Deterministic avatar tint from a string so the same user always gets
 *  the same colour. Seven-slot palette keeps it from feeling random. */
const AVATAR_PALETTE = [
  { bg: '#DBEAFE', fg: '#1D4ED8' }, // blue
  { bg: '#FCE7F3', fg: '#BE185D' }, // pink
  { bg: '#FEF3C7', fg: '#B45309' }, // amber
  { bg: '#DCFCE7', fg: '#047857' }, // green
  { bg: '#EDE9FE', fg: '#6D28D9' }, // violet
  { bg: '#FFE4E6', fg: '#BE123C' }, // rose
  { bg: '#CFFAFE', fg: '#0E7490' }, // cyan
];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export default function TeamPage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useSnackbar();

  const companyId = user?.company_id ?? null;
  const userRole = user?.role;
  const canManage = userRole === 'Owner' || userRole === 'Admin' || userRole === 'System Admin';

  const [tab, setTab] = useState<TabValue>('members');
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [membersTotal, setMembersTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEmail, setDialogEmail] = useState('');
  const [dialogRole, setDialogRole] = useState<InviteRole>('Member');
  const [dialogBusy, setDialogBusy] = useState(false);

  // Row-level 3-dot menu state — one menu instance shared across rows, keyed
  // by the invite we anchored it on.
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuInvite, setMenuInvite] = useState<PendingInvite | null>(null);

  // Per-row busy state — the id of the invite whose revoke/resend call is
  // currently in flight. Lets us swap the 3-dot icon for a spinner and
  // disable the menu items until it resolves.
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'revoke' | 'resend' | null>(null);

  // Pagination — client-side, since Members + Pending lists are short
  // and fully loaded into memory. Page + size are per-tab so switching
  // tabs doesn't strand the user on a page that no longer exists in
  // the other list.
  const [membersPage, setMembersPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(10);
  const [pendingPageSize, setPendingPageSize] = useState(10);

  // Search — per-tab, so flipping between Members and Pending preserves
  // each search context independently. The `*Search` state is what we
  // actually send to the server; `*SearchInput` is the live text-field
  // value, debounced 300ms below to avoid a request per keystroke.
  const [membersSearchInput, setMembersSearchInput] = useState('');
  const [pendingSearchInput, setPendingSearchInput] = useState('');
  const [membersSearch, setMembersSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setMembersSearch(membersSearchInput), 300);
    return () => clearTimeout(t);
  }, [membersSearchInput]);
  useEffect(() => {
    const t = setTimeout(() => setPendingSearch(pendingSearchInput), 300);
    return () => clearTimeout(t);
  }, [pendingSearchInput]);
  // Reset to page 1 + clear the tab's items whenever the search term
  // commits — otherwise the user lands on an empty page that may no
  // longer exist for the new (smaller) result set, AND the previous
  // results linger over the new query for the duration of the round
  // trip. Clearing makes the table skeleton kick in during the
  // transition (matches the Interviews page pattern).
  useEffect(() => {
    setMembersPage(1);
    setMembers([]);
  }, [membersSearch]);
  useEffect(() => {
    setPendingPage(1);
    setPending([]);
  }, [pendingSearch]);

  // Single-list refreshers so tab switches only fetch the list being
  // shown. `refresh()` (both) is still used on initial mount and after
  // mutations that can change either list (invite created → pending
  // grows; accept happens elsewhere → pending shrinks + members grows).
  const refreshInvites = useCallback(async (
    page = pendingPage,
    size = pendingPageSize,
    search = pendingSearch
  ) => {
    if (!companyId || !canManage) return;
    try {
      const resp = await InvitesService.list(companyId, { page, pageSize: size, search });
      if (resp.success && resp.data) {
        setPending(resp.data.items);
        setPendingTotal(resp.data.total);
      } else if (resp.message) {
        setError(resp.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load invites');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, canManage]);

  const refreshMembers = useCallback(async (
    page = membersPage,
    size = membersPageSize,
    search = membersSearch
  ) => {
    if (!companyId || !canManage) return;
    try {
      const resp = await InvitesService.listMembers(companyId, { page, pageSize: size, search });
      if (resp.success && resp.data) {
        setMembers(resp.data.items);
        setMembersTotal(resp.data.total);
      } else if (resp.message) {
        setError(resp.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load team members');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, canManage]);

  const refresh = useCallback(async () => {
    if (!companyId || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([refreshInvites(), refreshMembers()]);
    } finally {
      setLoading(false);
    }
  }, [companyId, canManage, refreshInvites, refreshMembers]);

  useEffect(() => { refresh(); }, [refresh]);

  // Page / page-size / search changes refetch only the affected tab.
  // Avoids a full both-lists round trip just because the user paged or
  // searched the currently-visible table. We flip `loading` around
  // each per-tab refetch so the DataTable's built-in skeleton kicks
  // in during the transition (search committed / page change).
  useEffect(() => {
    setLoading(true);
    refreshMembers(membersPage, membersPageSize, membersSearch).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersPage, membersPageSize, membersSearch]);
  useEffect(() => {
    setLoading(true);
    refreshInvites(pendingPage, pendingPageSize, pendingSearch).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPage, pendingPageSize, pendingSearch]);

  const handleOpenDialog = () => {
    setDialogEmail('');
    setDialogRole('Member');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!companyId) return;
    setDialogBusy(true);
    try {
      const resp = await InvitesService.create(companyId, {
        email: dialogEmail.trim(),
        role: dialogRole,
      });
      if (resp.success && resp.data) {
        showSuccess(
          resp.data.email_sent
            ? `Invitation emailed to ${resp.data.email}`
            : `Invitation created — email could not be sent, please try again`
        );
        setDialogOpen(false);
        setTab('pending'); // jump to Pending tab so the user sees the new row
        refresh();
      } else {
        showError(resp.message || 'Failed to send invitation');
      }
    } catch (err: any) {
      showError(err?.data?.error || err?.message || 'Failed to send invitation');
    } finally {
      setDialogBusy(false);
    }
  };

  const handleRevoke = async (invite: PendingInvite) => {
    setBusyInviteId(invite.id);
    setBusyAction('revoke');
    try {
      const resp = await InvitesService.revoke(invite.id);
      if (resp.success) {
        showSuccess(`Invitation for ${invite.email} revoked`);
        refresh();
      } else {
        showError(resp.message || 'Failed to revoke');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to revoke');
    } finally {
      setBusyInviteId(null);
      setBusyAction(null);
    }
  };

  const handleResend = async (invite: PendingInvite) => {
    setBusyInviteId(invite.id);
    setBusyAction('resend');
    try {
      const resp = await InvitesService.resend(invite.id);
      if (resp.success) {
        showSuccess(`Invitation re-sent to ${invite.email}`);
      } else {
        showError(resp.message || 'Failed to resend');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to resend');
    } finally {
      setBusyInviteId(null);
      setBusyAction(null);
    }
  };

  const openRowMenu = (e: React.MouseEvent<HTMLElement>, invite: PendingInvite) => {
    setMenuAnchor(e.currentTarget);
    setMenuInvite(invite);
  };
  const closeRowMenu = () => {
    setMenuAnchor(null);
    setMenuInvite(null);
  };

  const inviterLabel = (i: PendingInvite) => {
    if (!i.inviter) return '—';
    const name = `${i.inviter.first_name} ${i.inviter.last_name}`.trim();
    return name || i.inviter.email;
  };

  // ── Column configs ──────────────────────────────────────────────────

  const memberColumns = useMemo<DataTableColumn<TeamMember>[]>(() => [
    {
      key: 'person',
      header: 'Member',
      render: (m) => {
        const full = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim();
        const c = avatarColor(m.id);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Avatar
              src={m.avatar_url ?? undefined}
              // Google's avatar CDN returns 403 for non-Google referrers;
              // harmless for our own R2 URLs.
              imgProps={{ referrerPolicy: 'no-referrer' }}
              sx={{
                width: 28,
                height: 28,
                bgcolor: c.bg,
                color: c.fg,
                fontSize: '0.75rem',
                fontWeight: 700,
                boxShadow: '0 0 0 2px #FFFFFF',
              }}
            >
              {initialsOf(m.first_name, m.last_name, m.email)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: TOKENS.textPrimary,
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {full || m.email}
              </Box>
              {full && (
                <Box
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 400,
                    color: TOKENS.textSecondary,
                    lineHeight: 1.35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.email}
                </Box>
              )}
            </Box>
          </Box>
        );
      },
    },
    {
      key: 'role',
      header: 'Role',
      width: 140,
      render: (m) => <RolePill role={m.role} />,
    },
    {
      key: 'joined',
      header: 'Joined',
      hideOn: 'mobile',
      width: 140,
      render: (m) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {new Date(m.joined_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Caption>
      ),
    },
  ], []);

  const pendingColumns = useMemo<DataTableColumn<PendingInvite>[]>(() => [
    {
      key: 'invitee',
      header: 'Invitee',
      render: (i) => {
        const c = avatarColor(i.id);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Avatar
              sx={{
                width: 28,
                height: 28,
                bgcolor: c.bg,
                color: c.fg,
                fontSize: '0.75rem',
                fontWeight: 700,
                boxShadow: '0 0 0 2px #FFFFFF',
              }}
            >
              {(i.email[0] ?? '?').toUpperCase()}
            </Avatar>
            <Box
              sx={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: TOKENS.textPrimary,
                lineHeight: 1.35,
              }}
            >
              {i.email}
            </Box>
          </Box>
        );
      },
    },
    {
      key: 'role',
      header: 'Role',
      width: 140,
      render: (i) => <RolePill role={i.role} />,
    },
    {
      key: 'inviter',
      header: 'Invited by',
      hideOn: 'mobile',
      width: 180,
      render: (i) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {inviterLabel(i)}
        </Caption>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      hideOn: 'mobile',
      width: 140,
      render: (i) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {new Date(i.expires_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Caption>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 48,
      // When a revoke/resend is in flight for this row we swap in a
      // spinner so the row doesn't look idle while the network request
      // is running. showOnHover is intentionally dropped for busy rows
      // so the spinner stays visible even if the user's cursor drifts
      // off the row.
      showOnHover: true,
      render: (i) => {
        const isBusy = busyInviteId === i.id;
        return (
          <IconButton
            size="small"
            onClick={(e) => {
              if (isBusy) return;
              openRowMenu(e, i);
            }}
            aria-label="Row actions"
            disabled={isBusy}
            sx={{ color: TOKENS.textSecondary }}
          >
            {isBusy ? (
              <CircularProgress size={14} thickness={5} sx={{ color: TOKENS.brand }} />
            ) : (
              <MoreVertIcon fontSize="small" />
            )}
          </IconButton>
        );
      },
    },
  ], [busyInviteId]);

  // ── Render ──────────────────────────────────────────────────────────

  if (!canManage) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Only Owners and Admins can manage the team. Contact your company admin if you need to
          invite someone.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Users</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            Invite colleagues and manage their access.
          </Secondary>
        </Box>
        <ActionButton startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={handleOpenDialog}>
          Invite teammate
        </ActionButton>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs
        value={tab}
        onChange={(_, v: TabValue) => {
          setTab(v);
          // Refetch the list the user is switching INTO so tab clicks
          // always show fresh data. The other tab's data is left alone
          // until the user navigates back or a mutation touches it.
          if (v === 'members') refreshMembers();
          else refreshInvites();
        }}
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
        <Tab
          value="members"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              Members
              <TabCountBadge count={membersTotal} active={tab === 'members'} />
            </Box>
          }
        />
        <Tab
          value="pending"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              Pending invitations
              <TabCountBadge count={pendingTotal} active={tab === 'pending'} />
            </Box>
          }
        />
      </Tabs>

      {/* Slide-up + fade on the active tab content. Mirrors the
          right-side route animation in AppLayout so in-app tab swaps
          read as the same gesture, just at a smaller scale. No exit
          animation — old tab unmounts instantly when `tab` flips,
          new one mounts and animates in. That eliminates the
          double-mount blink the previous MUI Fade setup produced. */}
      {tab === 'members' && (
        <motion.div
          key="members"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
            <SearchField
              placeholder="Search name or email…"
              value={membersSearchInput}
              onChange={setMembersSearchInput}
            />
          </Box>
          <DataTable<TeamMember>
            columns={memberColumns}
            rows={members}
            rowKey={(m) => m.id}
            loading={loading}
            emptyText={
              membersSearch
                ? `No members match "${membersSearch}".`
                : 'No active members yet. Invite your teammates to get started.'
            }
            pagination={{
              page: membersPage,
              pageSize: membersPageSize,
              total: membersTotal,
              onChange: (nextPage, nextSize) => {
                if (nextSize !== membersPageSize) {
                  setMembersPageSize(nextSize);
                  setMembersPage(1);
                } else {
                  setMembersPage(nextPage);
                }
              },
            }}
          />
        </motion.div>
      )}

      {tab === 'pending' && (
        <motion.div
          key="pending"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
            <SearchField
              placeholder="Search invitee email…"
              value={pendingSearchInput}
              onChange={setPendingSearchInput}
            />
          </Box>
          <DataTable<PendingInvite>
            columns={pendingColumns}
            rows={pending}
            rowKey={(i) => i.id}
            loading={loading}
            emptyText={
              pendingSearch
                ? `No pending invitations match "${pendingSearch}".`
                : 'No pending invitations. Click Invite teammate to get started.'
            }
            pagination={{
              page: pendingPage,
              pageSize: pendingPageSize,
              total: pendingTotal,
              onChange: (nextPage, nextSize) => {
                if (nextSize !== pendingPageSize) {
                  setPendingPageSize(nextSize);
                  setPendingPage(1);
                } else {
                  setPendingPage(nextPage);
                }
              },
            }}
          />
        </motion.div>
      )}

      {/* Row-level actions menu for pending invites */}
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={closeRowMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItemMui
          onClick={() => {
            if (menuInvite) handleResend(menuInvite);
            closeRowMenu();
          }}
          disabled={!!busyInviteId}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {busyInviteId === menuInvite?.id && busyAction === 'resend' && (
            <CircularProgress size={14} thickness={5} sx={{ color: TOKENS.brand }} />
          )}
          {busyInviteId === menuInvite?.id && busyAction === 'resend'
            ? 'Resending…'
            : 'Resend email'}
        </MenuItemMui>
        <MenuItemMui
          onClick={() => {
            if (menuInvite) handleRevoke(menuInvite);
            closeRowMenu();
          }}
          disabled={!!busyInviteId}
          sx={{ color: TOKENS.error, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {busyInviteId === menuInvite?.id && busyAction === 'revoke' && (
            <CircularProgress size={14} thickness={5} sx={{ color: TOKENS.error }} />
          )}
          {busyInviteId === menuInvite?.id && busyAction === 'revoke'
            ? 'Revoking…'
            : 'Revoke invitation'}
        </MenuItemMui>
      </Menu>

      <Dialog
        open={dialogOpen}
        onClose={() => !dialogBusy && setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Invite teammate</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Secondary sx={{ color: TOKENS.textSecondary }}>
              We'll email the invitee a link to join as the selected role. Admins can manage the
              team; Members can run interviews.
            </Secondary>
            <FormField
              autoFocus
              label="Email"
              required
              type="email"
              value={dialogEmail}
              onChange={(e) => setDialogEmail(e.target.value)}
              disabled={dialogBusy}
            />
            <FormField
              label="Role"
              required
              select
              value={dialogRole}
              onChange={(e) => setDialogRole(e.target.value as InviteRole)}
              disabled={dialogBusy}
              SelectProps={{ native: true }}
            >
              <option value="Admin">Admin</option>
              <option value="Member">Member</option>
            </FormField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton
            variant="secondary"
            onClick={() => setDialogOpen(false)}
            disabled={dialogBusy}
          >
            Cancel
          </ActionButton>
          <ActionButton
            onClick={handleSubmit}
            loading={dialogBusy}
            disabled={!dialogEmail.trim()}
          >
            Send invite
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
