import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import dayjs from 'dayjs';
import { CandidateAssessmentService } from '../../services/candidateAssessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { ActionButton } from '../common/ActionButton';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { StatusTag } from '../common/StatusTag';
import { Caption, PageTitle, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { MyAssessment } from '../../types/assessment.types';
import { MODE_LABEL, formatDuration } from './AssessmentsListPage';

const fmt = (iso: string) => dayjs(iso).format('D MMM YYYY, h:mm A');

/**
 * Status only: after finishing, a candidate sees "Completed" and nothing
 * about their answers or score. Start / Continue only while they can act.
 */
function stateOf(r: MyAssessment): { tag: ReactNode; action: 'start' | 'continue' | null } {
  const now = dayjs();
  if (r.status === 'cancelled') return { tag: <StatusTag status="CANCELLED" label="Cancelled" />, action: null };
  if (r.status === 'submitted') return { tag: <StatusTag status="COMPLETED" label="Completed" />, action: null };
  if (r.status === 'started') return { tag: <StatusTag status="IN_PROGRESS" label="In progress" />, action: 'continue' };
  if (r.window_enforced && now.isAfter(r.closes_at)) return { tag: <StatusTag status="SCHEDULED" label="Closed" />, action: null };
  const notYet = r.window_enforced && now.isBefore(r.opens_at);
  return { tag: <StatusTag status="SCHEDULED" label="Pending" />, action: notYet ? null : 'start' };
}

/** Logged-in candidate → every assessment they've been invited to. */
export default function MyAssessmentsPage() {
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [rows, setRows] = useState<MyAssessment[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    CandidateAssessmentService.mine()
      .then((r) => setRows(r.data ?? []))
      .catch((e) => { showError(e?.message || 'Could not load your assessments'); setRows([]); });
  }, [showError]);

  const open = (r: MyAssessment) => navigate(`/my-assessments/${r.id}`);

  const columns = useMemo<DataTableColumn<MyAssessment>[]>(() => [
    {
      key: 'title',
      header: 'Assessment',
      render: (r) => (
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: '0.875rem', fontWeight: 500, color: TOKENS.textPrimary }}>{r.title}</Box>
          <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{r.company}</Caption>
        </Box>
      ),
    },
    { key: 'mode', header: 'Mode', width: 112, render: (r) => <Box sx={{ color: TOKENS.textPrimary, whiteSpace: 'nowrap' }}>{MODE_LABEL[r.mode]}</Box> },
    { key: 'time', header: 'Time', width: 96, hideOn: 'mobile', render: (r) => <Box sx={{ color: TOKENS.textSecondary }}>{formatDuration(r.mode, r.duration_min)}</Box> },
    {
      key: 'when',
      header: 'Window',
      hideOn: 'mobile',
      render: (r) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {r.mode === 'live' ? `${fmt(r.opens_at)} to ${fmt(r.closes_at)}` : `Start by ${fmt(r.closes_at)}`}
        </Caption>
      ),
    },
    { key: 'status', header: 'Status', width: 170, render: (r) => stateOf(r).tag },
    {
      key: 'action',
      header: '',
      width: 120,
      align: 'right',
      render: (r) => {
        const { action } = stateOf(r);
        if (!action) return null;
        return (
          <Box onClick={(e) => e.stopPropagation()}>
            <ActionButton size="small" onClick={() => open(r)}>{action === 'start' ? 'Start' : 'Continue'}</ActionButton>
          </Box>
        );
      },
    },
  ], []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 2.5 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Assessments</PageTitle>
        <Secondary sx={{ color: TOKENS.textSecondary }}>Tests companies have invited you to take.</Secondary>
      </Box>
      <DataTable<MyAssessment>
        columns={columns}
        rows={(rows ?? []).slice((page - 1) * pageSize, page * pageSize)}
        rowKey={(r) => r.id}
        onRowClick={(r) => stateOf(r).action && open(r)}
        loading={rows === null}
        emptyText="No assessments yet. When a company invites you, it shows up here and in your email."
        pagination={{ page, pageSize, total: rows?.length ?? 0, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />
    </Box>
  );
}
