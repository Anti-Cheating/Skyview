import { Box } from '@mui/material';
import { InfoOutlined as InfoIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { CardTitle, Secondary } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';

const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;

/** Declined / withdrawn dead-end card with a single recovery action.
 *  Shares the ConsentScreen visual language. */
export default function ConsentOutcome({
  title, message, actionLabel, onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: '#F9FAFB', px: { xs: 2, md: 3 },
    }}>
      <Box sx={{
        width: 480, maxWidth: '100%', bgcolor: LIGHT_BG,
        borderRadius: '12px', border: `1px solid ${LIGHT_BORDER}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', p: { xs: 3, md: 4 }, textAlign: 'center',
      }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: '50%', mx: 'auto', mb: 2,
          bgcolor: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <InfoIcon sx={{ color: '#D97706', fontSize: 26 }} />
        </Box>
        <CardTitle sx={{ fontWeight: 700, color: TOKENS.textPrimary, mb: 1 }}>{title}</CardTitle>
        <Secondary sx={{ color: TOKENS.textSecondary, mb: 3, lineHeight: 1.6 }}>{message}</Secondary>
        <ActionButton onClick={onAction} sx={{ width: '100%' }}>{actionLabel}</ActionButton>
      </Box>
    </Box>
  );
}
