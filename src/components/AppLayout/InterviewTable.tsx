/**
 * InterviewTable — staff/desktop view of the interview list. Mirrors
 * the Vercel/Linear/antd table aesthetic via the shared <DataTable>
 * primitive so this stays visually consistent with /team.
 *
 * Why a table here: HR users at scale want to scan, sort, and filter
 * 30+ rows. Cards make that view a wall of repeated labels. The card
 * grid is still rendered on small screens (handled by AppInterviewList),
 * because tables don't survive a phone viewport.
 *
 * Row actions live in a single trailing cell — Edit / Delete only, no
 * 3-dot menu yet (we have <3 actions). The title cell doubles as the
 * primary affordance: clicking it goes straight to /:id/monitor for
 * staff, matching the card's "Open Monitoring" button intent.
 */

import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DataTable, type DataTableColumn, type DataTablePagination } from '../common/DataTable';
import { StatusTag } from '../common/StatusTag';
import type { InterviewSession } from '../../types/interview.types';
import { isStaffRole, isCompanyManagerRole } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';

interface InterviewTableProps {
  rows: InterviewSession[];
  loading?: boolean;
  emptyText?: string;
  caption?: React.ReactNode;
  captionExtra?: React.ReactNode;
  userRole: string;
  onEdit?: (interview: InterviewSession) => void;
  onDelete?: (interview: InterviewSession) => void;
  pagination?: DataTablePagination;
}

function formatScheduled(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function InterviewTable({
  rows,
  loading,
  emptyText,
  caption,
  captionExtra,
  userRole,
  onEdit,
  onDelete,
  pagination,
}: InterviewTableProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const viewerId = user?.id;

  const isInterviewer = isStaffRole(userRole);
  const canDeleteRows = isCompanyManagerRole(userRole);

  const columns: DataTableColumn<InterviewSession>[] = [
    {
      key: 'title',
      header: 'Interview',
      render: (row) => (
        <Box
          component="button"
          onClick={() => navigate(`/interviews/${row.id}/monitor`)}
          sx={{
            background: 'none',
            border: 0,
            p: 0,
            textAlign: 'left',
            cursor: 'pointer',
            color: '#1F2937',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            fontWeight: 600,
            '&:hover': { color: '#4CD964' },
            // Constrain to one line — long titles ellipsize to keep
            // row height stable across the table.
            display: 'block',
            maxWidth: 320,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={row.title}
        >
          {row.title || 'Untitled interview'}
        </Box>
      ),
    },
    {
      key: 'candidate',
      header: 'Candidate',
      render: (row) => {
        const p = row.interview_session_participants?.find(
          (x) => x.candidate_id && x.candidate
        );
        if (!p?.candidate) {
          return <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>—</Typography>;
        }
        const name = `${p.candidate.first_name} ${p.candidate.last_name}`.trim();
        return (
          <Box>
            <Typography sx={{ fontSize: '0.875rem', color: '#1F2937', fontWeight: 500 }}>
              {name || p.candidate.email}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>
              {p.candidate.email}
            </Typography>
          </Box>
        );
      },
      hideOn: 'mobile',
    },
    {
      key: 'interviewer',
      header: 'Interviewer',
      render: (row) => {
        const p = row.interview_session_participants?.find(
          (x) => x.interviewer_id && x.interviewer
        );
        if (!p?.interviewer) {
          return <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>—</Typography>;
        }
        const name = `${p.interviewer.first_name} ${p.interviewer.last_name}`.trim();
        const isYou = !!viewerId && p.interviewer_id === viewerId;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '0.875rem', color: '#1F2937', fontWeight: 500 }}>
              {name || p.interviewer.email}
            </Typography>
            {isYou && (
              <Box
                component="span"
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  color: '#047857',
                  bgcolor: 'rgba(76, 217, 100, 0.14)',
                  border: '1px solid rgba(76, 217, 100, 0.35)',
                  px: 0.6,
                  height: 16,
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  letterSpacing: '0.04em',
                }}
              >
                YOU
              </Box>
            )}
          </Box>
        );
      },
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      render: (row) => {
        const { date, time } = formatScheduled(row.scheduled_start_at);
        return (
          <Box>
            <Typography sx={{ fontSize: '0.875rem', color: '#1F2937', fontWeight: 500 }}>
              {date}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>{time}</Typography>
          </Box>
        );
      },
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => (
        <Typography sx={{ fontSize: '0.875rem', color: '#374151' }}>
          {row.duration_minutes ? `${row.duration_minutes} min` : '—'}
        </Typography>
      ),
      hideOn: 'mobile',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusTag status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 96,
      showOnHover: true,
      render: (row) => {
        if (!isInterviewer) return null;
        const showEdit = !!onEdit && row.status !== 'COMPLETED';
        const showDelete = canDeleteRows && !!onDelete;
        if (!showEdit && !showDelete) return null;
        return (
          <Box sx={{ display: 'inline-flex', gap: 0.25 }}>
            {showEdit && (
              <Tooltip title="Edit interview" arrow placement="top">
                <IconButton
                  size="small"
                  sx={{
                    padding: '4px',
                    color: '#6B7280',
                    '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.08)', color: '#3B82F6' },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(row);
                  }}
                >
                  <EditIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            {showDelete && (
              <Tooltip title="Delete interview" arrow placement="top">
                <IconButton
                  size="small"
                  sx={{
                    padding: '4px',
                    color: '#6B7280',
                    '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)', color: '#EF4444' },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(row);
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <DataTable<InterviewSession>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      emptyText={emptyText}
      caption={caption}
      captionExtra={captionExtra}
      pagination={pagination}
    />
  );
}
