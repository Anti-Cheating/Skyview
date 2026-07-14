import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormField } from '../../../src/components/common/FormField';

describe('FormField', () => {
  test('renders a labelled input', () => {
    render(<FormField label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  test('fires onChange as the user types', async () => {
    const onChange = vi.fn();
    render(<FormField label="Name" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Name'), 'hi');
    expect(onChange).toHaveBeenCalled();
  });

  test('locked fields render read-only', () => {
    render(<FormField label="Company" locked value="Acme" onChange={() => {}} />);
    const input = screen.getByLabelText('Company') as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
    expect(input.value).toBe('Acme');
  });

  test('required renders an asterisk marker', () => {
    render(<FormField label="Password" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  test('optional renders the (optional) marker', () => {
    render(<FormField label="Phone" optional />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  test('renders hint / helper text', () => {
    render(<FormField label="Email" hint="We never share this" />);
    expect(screen.getByText('We never share this')).toBeInTheDocument();
  });
});
