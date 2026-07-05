import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/login' }),
}));

import { AuthCard } from './AuthCard';

describe('AuthCard', () => {
  test('renders its children (the form) inside the card', () => {
    render(
      <AuthCard>
        <div>Sign-in form goes here</div>
      </AuthCard>,
    );
    expect(screen.getByText('Sign-in form goes here')).toBeInTheDocument();
  });

  test('renders the brand hero copy and rotating accent words', () => {
    render(<AuthCard><span>x</span></AuthCard>);
    expect(screen.getByText('Interviews you can')).toBeInTheDocument();
    // Every rotating accent word is stacked in the DOM.
    expect(screen.getByText('trust.')).toBeInTheDocument();
    expect(screen.getByText('verify.')).toBeInTheDocument();
    expect(screen.getByText(/Full visibility in every interview/)).toBeInTheDocument();
  });

  test('shows the current-year copyright line', () => {
    render(<AuthCard><span>x</span></AuthCard>);
    expect(
      screen.getByText(new RegExp(`${new Date().getFullYear()} Trueyy. All rights reserved`)),
    ).toBeInTheDocument();
  });

  test('renders the brand logo', () => {
    render(<AuthCard><span>x</span></AuthCard>);
    expect(screen.getAllByAltText('Trueyy').length).toBeGreaterThan(0);
  });
});
