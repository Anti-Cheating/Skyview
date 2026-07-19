import { describe, test, expect } from 'vitest';
import {
  isValidEmail, isStrongPassword, isRequired, getEmailError, getPasswordError,
} from '../../src/utils/validation';

describe('validation', () => {
  test('isValidEmail', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('first.last@sub.domain.co')).toBe(true);
    expect(isValidEmail('no-at')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  test('isStrongPassword', () => {
    expect(isStrongPassword('Abcdef12')).toBe(true);
    expect(isStrongPassword('short1A')).toBe(false); // < 8
    expect(isStrongPassword('alllower1')).toBe(false); // no upper
    expect(isStrongPassword('ALLUPPER1')).toBe(false); // no lower
    expect(isStrongPassword('NoDigitsHere')).toBe(false); // no number
  });

  test('isRequired', () => {
    expect(isRequired('x')).toBe(true);
    expect(isRequired('  x ')).toBe(true);
    expect(isRequired('   ')).toBe(false);
    expect(isRequired('')).toBe(false);
    expect(isRequired(null)).toBe(false);
    expect(isRequired(undefined)).toBe(false);
  });

  test('getEmailError', () => {
    expect(getEmailError('')).toBe('Email is required');
    expect(getEmailError('   ')).toBe('Email is required');
    expect(getEmailError('bad')).toBe('Please enter a valid email address');
    expect(getEmailError('ok@x.com')).toBeNull();
  });

  test('getPasswordError', () => {
    expect(getPasswordError('')).toBe('Password is required');
    expect(getPasswordError('anything')).toBeNull(); // not requiring strong
    expect(getPasswordError('weak', true)).toContain('at least 8 characters');
    expect(getPasswordError('Strong12', true)).toBeNull();
  });
});
