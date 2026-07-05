import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsentScreen from './ConsentScreen';

const baseProps = {
  body: 'stored consent text (evidence)',
  version: '1.0',
  companyName: 'Demo Corp',
  companyLogoUrl: null,
  onAgree: vi.fn(),
  onDecline: vi.fn(),
};

describe('ConsentScreen', () => {
  test('renders the four recorded-item tiles', () => {
    render(<ConsentScreen {...baseProps} />);
    expect(screen.getByText('Screen & open apps')).toBeInTheDocument();
    expect(screen.getByText('Microphone')).toBeInTheDocument();
    expect(screen.getByText('Meeting audio')).toBeInTheDocument();
    expect(screen.getByText('Keystroke metrics')).toBeInTheDocument();
  });

  test('names the hosting company', () => {
    render(<ConsentScreen {...baseProps} />);
    expect(screen.getByText(/Demo Corp uses/)).toBeInTheDocument();
  });

  test('does not display the internal version number', () => {
    render(<ConsentScreen {...baseProps} />);
    expect(screen.queryByText(/version 1\.0/i)).not.toBeInTheDocument();
  });

  test('Agree fires onAgree', async () => {
    const onAgree = vi.fn();
    render(<ConsentScreen {...baseProps} onAgree={onAgree} />);
    await userEvent.click(screen.getByRole('button', { name: /agree & continue/i }));
    expect(onAgree).toHaveBeenCalledOnce();
  });

  test('Decline fires onDecline', async () => {
    const onDecline = vi.fn();
    render(<ConsentScreen {...baseProps} onDecline={onDecline} />);
    await userEvent.click(screen.getByRole('button', { name: /decline/i }));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  test('buttons are disabled while busy', () => {
    render(<ConsentScreen {...baseProps} busy />);
    expect(screen.getByRole('button', { name: /decline/i })).toBeDisabled();
  });
});
