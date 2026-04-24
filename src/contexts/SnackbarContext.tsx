import { createContext, useContext, useState, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';
import { TOKENS } from '../theme';

interface SnackbarContextType {
  showSnackbar: (message: string, severity?: AlertColor) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');

  const showSnackbar = (msg: string, sev: AlertColor = 'info') => {
    setMessage(msg); setSeverity(sev); setOpen(true);
  };
  const showError = (msg: string) => showSnackbar(msg, 'error');
  const showSuccess = (msg: string) => showSnackbar(msg, 'success');
  const showWarning = (msg: string) => showSnackbar(msg, 'warning');
  const showInfo = (msg: string) => showSnackbar(msg, 'info');

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, showError, showSuccess, showWarning, showInfo }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {/* Sourced from TOKENS so every success/error surface in the app
            shares the same palette. Text is always white regardless of
            severity — keeps the snackbar visually uniform across success,
            error, warning, info. */}
        <Alert
          onClose={handleClose}
          severity={severity}
          variant="filled"
          sx={{
            width: '100%',
            bgcolor:
              severity === 'error' ? TOKENS.error
              : severity === 'success' ? TOKENS.brand
              : severity === 'warning' ? TOKENS.warning
              : '#3B82F6',
            color: '#FFFFFF',
            '& .MuiAlert-icon': { color: '#FFFFFF' },
            '& .MuiAlert-message': {
              color: '#FFFFFF',
              fontWeight: 600,
            },
            '& .MuiAlert-action .MuiIconButton-root': {
              color: '#FFFFFF',
            },
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextType {
  const context = useContext(SnackbarContext);
  if (context === undefined) throw new Error('useSnackbar must be used within a SnackbarProvider');
  return context;
}
