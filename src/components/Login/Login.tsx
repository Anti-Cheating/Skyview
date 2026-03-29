import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Typography, TextField, Button, Alert,
  InputAdornment, IconButton, Link,
} from '@mui/material';
import {
  Lock as LockIcon, Email as EmailIcon,
  Visibility, VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import type { ApiError } from '../../types/api.types';
import { isValidEmail, getEmailError } from '../../utils/validation';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(getEmailError(value) || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.trim()) { setError('Please enter your email address'); setLoading(false); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address'); setEmailError('Please enter a valid email address'); setLoading(false); return; }
    if (!password.trim()) { setError('Please enter your password'); setLoading(false); return; }

    try {
      await login({ email, password });
    } catch (err: any) {
      const apiError = err as ApiError;
      if (apiError.status === 401) setError('Invalid email or password');
      else if (apiError.status === 0) setError('Unable to connect to server. Please check if the server is running.');
      else setError(apiError.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const darkFieldSx = {
    '& .MuiOutlinedInput-root': {
      color: '#E5E7EB',
      bgcolor: 'rgba(255,255,255,0.05)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
      '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
      '&:hover fieldset': { borderColor: 'rgba(76, 217, 100, 0.4)' },
      '&.Mui-focused': { bgcolor: 'rgba(255,255,255,0.08)' },
      '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.35)', borderWidth: '1px' },
      '& input': {
        color: '#E5E7EB !important',
        WebkitTextFillColor: '#E5E7EB !important',
        '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus': {
          WebkitBoxShadow: '0 0 0 100px #122318 inset',
          WebkitTextFillColor: '#E5E7EB !important',
          caretColor: '#E5E7EB',
        },
      },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255,255,255,0.7)' },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Container maxWidth="xs">
        <Box sx={{ p: 3, borderRadius: '12px', bgcolor: '#122318', border: '1px solid rgba(76, 217, 100, 0.12)' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" component="h1" fontWeight="bold" sx={{ color: '#FFFFFF' }}>
              Sign In
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Email" type="email" variant="outlined"
              margin="normal" size="small" value={email}
              onChange={handleEmailChange} disabled={loading}
              error={!!emailError} helperText={emailError}
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
              sx={{
                ...darkFieldSx,
                '& .MuiOutlinedInput-root.Mui-error': {
                  '& fieldset': { borderColor: 'rgba(239, 68, 68, 0.5) !important', borderWidth: '1px !important' },
                },
                '& .MuiInputLabel-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
                '& .MuiFormHelperText-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
              }}
              autoFocus
            />

            <TextField
              fullWidth label="Password" type={showPassword ? 'text' : 'password'}
              variant="outlined" margin="normal" size="small"
              value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" disabled={loading} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={darkFieldSx}
            />

            <Button
              type="submit" fullWidth variant="contained"
              sx={{
                mt: 2, mb: 2,
                bgcolor: '#4CD964', color: '#0B1A10', fontWeight: 600, borderRadius: '8px',
                '&:hover': { bgcolor: '#3CB853' },
                '&.Mui-disabled': { backgroundColor: 'rgba(76, 217, 100, 0.15) !important', color: 'rgba(255,255,255,0.3) !important' },
              }}
              disabled={loading || !email.trim() || !password.trim() || !!emailError}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Don't have an account?{' '}
              <Link component={RouterLink} to="/signup" sx={{ color: '#4CD964', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
                Sign up
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
