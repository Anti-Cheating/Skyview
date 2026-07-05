/**
 * InterviewsIndex — the /interviews landing page.
 *
 * Managers (Owner/Admin) get a view switcher:
 *   - By interview → ProcessListPage (candidate + role, groups its rounds)
 *   - By round     → AppInterviewList (flat, time-ordered list of every round)
 * Both are the existing views, rendered `embedded` (their own headers
 * suppressed) so this page owns the single header + New button + tabs.
 *
 * Interviewers / candidates keep the flat round list only (no tabs) — they
 * don't manage multi-round processes.
 *
 * The active tab lives in the URL (?view=round) so it survives refresh and
 * is shareable.
 */
import { Box, Select, MenuItem } from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Add as AddIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { useAuth } from '../../contexts/AuthContext';
import { isCompanyManagerRole } from '../../config/constants';
import ProcessListPage from './ProcessListPage';
import AppInterviewList from './AppInterviewList';

type View = 'interview' | 'round';

const OPTIONS: { value: View; label: string }[] = [
  { value: 'interview', label: 'Interviews' },
  { value: 'round', label: 'Rounds' },
];

export default function InterviewsIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Interviewers / candidates: the flat round list only, unchanged.
  if (!isCompanyManagerRole(user?.role)) return <AppInterviewList />;

  const view: View = params.get('view') === 'round' ? 'round' : 'interview';
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'interview') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Interviews</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            {view === 'interview'
              ? 'Grouped by candidate and role.'
              : 'All rounds, newest first.'}
          </Secondary>
        </Box>
        {/* Right cluster: Group by dropdown, then the New interview button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Caption sx={{ color: TOKENS.textSecondary }}>Group by</Caption>
            <Select
              size="small"
              value={view}
              onChange={(e) => setView(e.target.value as View)}
              sx={{
                minWidth: 140,
                bgcolor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: TOKENS.textPrimary,
                borderRadius: '8px',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#D1D5DB' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: TOKENS.brand, borderWidth: 1 },
              }}
            >
              {OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <ActionButton onClick={() => navigate('/interviews/new')} startIcon={<AddIcon />}>
            New interview
          </ActionButton>
        </Box>
      </Box>

      {view === 'interview' ? <ProcessListPage embedded /> : <AppInterviewList embedded />}
    </Box>
  );
}
