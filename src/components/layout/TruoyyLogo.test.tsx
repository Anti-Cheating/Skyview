import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TruoyyLogo } from './TruoyyLogo';

describe('TruoyyLogo', () => {
  test('renders the brand image with alt text', () => {
    render(<TruoyyLogo />);
    expect(screen.getByAltText('Trueyy')).toBeInTheDocument();
  });

  test('light and dark variants resolve to different assets', () => {
    const { rerender } = render(<TruoyyLogo variant="light" />);
    const lightSrc = screen.getByAltText('Trueyy').getAttribute('src');
    rerender(<TruoyyLogo variant="dark" />);
    const darkSrc = screen.getByAltText('Trueyy').getAttribute('src');
    expect(lightSrc).not.toBe(darkSrc);
  });

  test('accepts the collapsed prop without crashing', () => {
    render(<TruoyyLogo collapsed size="large" />);
    expect(screen.getByAltText('Trueyy')).toBeInTheDocument();
  });
});
