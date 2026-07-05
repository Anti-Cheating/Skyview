import { describe, test, expect } from 'vitest';
import { getUserDisplayName, getUserFirstName } from './user.utils';
import type { User } from '../types/auth.types';

const u = (over: Partial<User>): User => ({ id: '1', email: 'x@y.com', ...over } as User);

describe('getUserDisplayName', () => {
  test('null → "User"', () => {
    expect(getUserDisplayName(null)).toBe('User');
  });

  test('joins available name parts', () => {
    expect(getUserDisplayName(u({ first_name: 'Ada', last_name: 'Lovelace' }))).toBe('Ada Lovelace');
    expect(getUserDisplayName(u({ first_name: 'Ada', middle_name: 'B', last_name: 'Lovelace' }))).toBe('Ada B Lovelace');
    expect(getUserDisplayName(u({ first_name: 'Ada' }))).toBe('Ada');
  });

  test('falls back to a title-cased email local part', () => {
    expect(getUserDisplayName(u({ email: 'ada.lovelace@x.com' }))).toBe('Ada Lovelace');
    expect(getUserDisplayName(u({ email: 'jane_doe@x.com' }))).toBe('Jane Doe');
    expect(getUserDisplayName(u({ email: 'ada+tag@x.com' }))).toBe('Ada');
  });

  test('no name and no email → "User"', () => {
    expect(getUserDisplayName(u({ email: '' }))).toBe('User');
  });
});

describe('getUserFirstName', () => {
  test('null → "User"', () => {
    expect(getUserFirstName(null)).toBe('User');
  });
  test('prefers first_name, then email local part', () => {
    expect(getUserFirstName(u({ first_name: 'Ada' }))).toBe('Ada');
    expect(getUserFirstName(u({ first_name: undefined, email: 'grace@x.com' }))).toBe('grace');
  });
});
