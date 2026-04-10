import type { User } from '../types/auth.types';

export function getUserDisplayName(user: User | null): string {
  if (!user) return 'User';

  const nameParts: string[] = [];
  if (user.first_name) nameParts.push(user.first_name);
  if (user.middle_name) nameParts.push(user.middle_name);
  if (user.last_name) nameParts.push(user.last_name);

  if (nameParts.length > 0) return nameParts.join(' ');

  if (!user.email) return 'User';
  const emailPart = user.email.split('@')[0];
  const namePart = emailPart.split('+')[0];
  return namePart
    .split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') || emailPart;
}

export function getUserFirstName(user: User | null): string {
  if (!user) return 'User';
  return user.first_name || user.email?.split('@')[0] || 'User';
}
