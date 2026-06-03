import { NavLink, Outlet } from 'react-router-dom';
import { Box, Paper, Typography, List, ListItemButton, ListItemText } from '@mui/material';

const NAV = [
  { to: '/settings/tokens', label: 'API Tokens' },
  { to: '/settings/webhooks', label: 'Webhooks' },
  { to: '/settings/branding', label: 'Branding' },
  { to: '/settings/retention', label: 'Retention' },
];

export default function SettingsLayout() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 2, p: 2 }}>
      <Paper sx={{ p: 1 }}>
        <Typography variant="h6" sx={{ px: 1.5, pt: 1 }}>
          Settings
        </Typography>
        <List dense>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none', color: 'inherit' }}>
              {({ isActive }) => (
                <ListItemButton selected={isActive}>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              )}
            </NavLink>
          ))}
        </List>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Outlet />
      </Paper>
    </Box>
  );
}
