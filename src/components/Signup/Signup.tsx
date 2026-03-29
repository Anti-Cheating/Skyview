import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Typography, TextField, Button, Alert,
  InputAdornment, IconButton, Link,
} from '@mui/material';
import {
  Lock as LockIcon, Email as EmailIcon,
  Visibility, VisibilityOff, Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import type { ApiError } from '../../types/api.types';
import { isValidEmail, getEmailError, isStrongPassword, getPasswordError } from '../../utils/validation';

export default function Signup() {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isStrongPassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      await signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        email: formData.email,
        password: formData.password,
      });
    } catch (err: any) {
      const apiError = err as ApiError;
      if (apiError.status === 0) {
        setApiError('Unable to connect to server. Please check if the server is running.');
      } else if (apiError.status === 400 || apiError.status === 409) {
        setApiError(apiError.message || 'Email already exists or invalid input');
      } else {
        setApiError(apiError.message || 'Signup failed. Please try again.');
      }
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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2, py: 4 }}>
      <Container maxWidth="xs">
        <Box sx={{ p: 3, borderRadius: '12px', bgcolor: '#122318', border: '1px solid rgba(76, 217, 100, 0.12)' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" component="h1" fontWeight="bold" sx={{ color: '#FFFFFF' }}>
              Create Account
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
              Sign up to get started
            </Typography>
          </Box>

          {apiError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>{apiError}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="First Name" variant="outlined"
              margin="normal" size="small" name="firstName"
              value={formData.firstName} onChange={handleChange} disabled={loading}
              error={!!errors.firstName} helperText={errors.firstName}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
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
              fullWidth label="Last Name" variant="outlined"
              margin="normal" size="small" name="lastName"
              value={formData.lastName} onChange={handleChange} disabled={loading}
              error={!!errors.lastName} helperText={errors.lastName}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
              sx={{
                ...darkFieldSx,
                '& .MuiOutlinedInput-root.Mui-error': {
                  '& fieldset': { borderColor: 'rgba(239, 68, 68, 0.5) !important', borderWidth: '1px !important' },
                },
                '& .MuiInputLabel-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
                '& .MuiFormHelperText-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
              }}
            />

            <TextField
              fullWidth label="Company Name" variant="outlined"
              margin="normal" size="small" name="companyName"
              value={formData.companyName} onChange={handleChange} disabled={loading}
              error={!!errors.companyName} helperText={errors.companyName}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
              sx={{
                ...darkFieldSx,
                '& .MuiOutlinedInput-root.Mui-error': {
                  '& fieldset': { borderColor: 'rgba(239, 68, 68, 0.5) !important', borderWidth: '1px !important' },
                },
                '& .MuiInputLabel-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
                '& .MuiFormHelperText-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
              }}
            />

            <TextField
              fullWidth label="Email" type="email" variant="outlined"
              margin="normal" size="small" name="email"
              value={formData.email} onChange={handleChange} disabled={loading}
              error={!!errors.email} helperText={errors.email}
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment> }}
              sx={{
                ...darkFieldSx,
                '& .MuiOutlinedInput-root.Mui-error': {
                  '& fieldset': { borderColor: 'rgba(239, 68, 68, 0.5) !important', borderWidth: '1px !important' },
                },
                '& .MuiInputLabel-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
                '& .MuiFormHelperText-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
              }}
            />

            <TextField
              fullWidth label="Password" type={showPassword ? 'text' : 'password'}
              variant="outlined" margin="normal" size="small" name="password"
              value={formData.password} onChange={handleChange} disabled={loading}
              error={!!errors.password} helperText={errors.password}
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
              sx={{
                ...darkFieldSx,
                '& .MuiOutlinedInput-root.Mui-error': {
                  '& fieldset': { borderColor: 'rgba(239, 68, 68, 0.5) !important', borderWidth: '1px !important' },
                },
                '& .MuiInputLabel-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
                '& .MuiFormHelperText-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
              }}
            />

            <TextField
              fullWidth label="Confirm Password" type={showConfirmPassword ? 'text' : 'password'}
              variant="outlined" margin="normal" size="small" name="confirmPassword"
              value={formData.confirmPassword} onChange={handleChange} disabled={loading}
              error={!!errors.confirmPassword} helperText={errors.confirmPassword}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small" disabled={loading} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                ...darkFieldSx,
                '& .MuiOutlinedInput-root.Mui-error': {
                  '& fieldset': { borderColor: 'rgba(239, 68, 68, 0.5) !important', borderWidth: '1px !important' },
                },
                '& .MuiInputLabel-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
                '& .MuiFormHelperText-root.Mui-error': { color: 'rgba(239, 68, 68, 0.7)' },
              }}
            />

            <Button
              type="submit" fullWidth variant="contained"
              sx={{
                mt: 2, mb: 2,
                bgcolor: '#4CD964', color: '#0B1A10', fontWeight: 600, borderRadius: '8px',
                '&:hover': { bgcolor: '#3CB853' },
                '&.Mui-disabled': { backgroundColor: 'rgba(76, 217, 100, 0.15) !important', color: 'rgba(255,255,255,0.3) !important' },
              }}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Already have an account?{' '}
              <Link component={RouterLink} to="/login" sx={{ color: '#4CD964', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
                Sign in
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
