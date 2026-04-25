/**
 * ProfilePage — /profile route.
 *
 * Layout: side-by-side cards on desktop, stacked on mobile.
 *   - Personal card  → always
 *   - Company card   → only when the user has a company AND is Owner
 *
 * Tabs were dropped in favour of this layout because they were always
 * going to be a 2-or-1 tab strip (Owner vs everyone else) — at that
 * cardinality the tab chrome is more friction than help.
 */

import { Box, Alert } from '@mui/material';
import { PageTitle } from '../layout/Typography';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import PersonalTab from './PersonalTab';
import CompanyTab from './CompanyTab';

export default function ProfilePage() {
  const { user } = useAuth();

  // Owner is the only role allowed to rename the company. Admins and
  // Members get the page with just the Personal card.
  const isOwner = user?.role === 'Owner';
  const showCompanyCard = isOwner && !!user?.company_id;

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Please sign in.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary }}>Profile</PageTitle>
      </Box>

      <Box
        sx={{
          display: 'grid',
          // Two columns on >=md when both cards are present, single
          // column otherwise. Either branch reads the same on mobile —
          // gridTemplateColumns: '1fr' below the breakpoint.
          gridTemplateColumns: {
            xs: '1fr',
            md: showCompanyCard ? '1fr 1fr' : '1fr',
          },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <PersonalTab />
        {showCompanyCard && <CompanyTab companyId={user.company_id!} />}
      </Box>
    </Box>
  );
}
