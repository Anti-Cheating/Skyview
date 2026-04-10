import { Box } from '@mui/material';
import darshLogo from '../../assets/svgviewer-output.svg';
import darshIcon from '../../assets/svgviewer-output.svg';

interface TruoyyLogoProps {
  collapsed?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function TruoyyLogo({ collapsed = false }: TruoyyLogoProps) {
  const logoHeight = collapsed ? 25 : 50;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <img
        src={collapsed ? darshIcon : darshLogo}
        alt="Trueyy"
        style={{
          height: logoHeight,
          width: 'auto',
          objectFit: 'contain',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    </Box>
  );
}
