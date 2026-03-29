export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isStrongPassword = (password: string): boolean => {
  // At least 8 chars, one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

export const isRequired = (value: string | null | undefined): boolean => {
  return value !== null && value !== undefined && value.trim().length > 0;
};

export const getEmailError = (email: string): string | null => {
  if (!email.trim()) return 'Email is required';
  if (!isValidEmail(email)) return 'Please enter a valid email address';
  return null;
};

export const getPasswordError = (password: string, requireStrong: boolean = false): string | null => {
  if (!password.trim()) return 'Password is required';
  if (requireStrong && !isStrongPassword(password)) {
    return 'Password must be at least 8 characters with uppercase, lowercase, and number';
  }
  return null;
};
