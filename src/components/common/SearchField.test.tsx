import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchField } from './SearchField';

describe('SearchField', () => {
  test('renders the placeholder and forwards the raw string on change', async () => {
    const onChange = vi.fn();
    render(<SearchField value="" onChange={onChange} placeholder="Search things…" />);
    const input = screen.getByPlaceholderText('Search things…');
    await userEvent.type(input, 'a');
    expect(onChange).toHaveBeenLastCalledWith('a'); // string, not an event
  });

  test('fires onKeyDown (e.g. Enter-to-apply)', async () => {
    const onKeyDown = vi.fn();
    render(<SearchField value="" onChange={() => {}} onKeyDown={onKeyDown} />);
    await userEvent.type(screen.getByRole('textbox'), '{Enter}');
    expect(onKeyDown).toHaveBeenCalled();
  });

  test('defaults the placeholder when none is given', () => {
    render(<SearchField value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });
});
