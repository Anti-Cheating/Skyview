import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Isolate the switcher: stub the two heavy child views with markers.
vi.mock('../../../src/components/AppLayout/ProcessListPage', () => ({ default: () => <div>PROCESS_VIEW</div> }));
vi.mock('../../../src/components/AppLayout/AppInterviewList', () => ({ default: () => <div>ROUND_VIEW</div> }));
vi.mock('../../../src/components/AppLayout/CandidatesListPage', () => ({ default: () => <div>CANDIDATE_VIEW</div> }));

const mockNavigate = vi.fn();
let sp = new URLSearchParams();
const setSp = vi.fn((next: URLSearchParams) => { sp = next; });
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [sp, setSp],
}));

let authUser: any;
vi.mock('../../../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: authUser }) }));

import InterviewsIndex from '../../../src/components/AppLayout/InterviewsIndex';

beforeEach(() => {
  vi.clearAllMocks();
  sp = new URLSearchParams();
  authUser = { id: 'u1', role: 'Owner' };
});

describe('InterviewsIndex — group-by switcher', () => {
  test('managers see the Group by dropdown and default to Interviews', () => {
    render(<InterviewsIndex />);
    expect(screen.getByText('Group by')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Interviews');
    expect(screen.getByText('PROCESS_VIEW')).toBeInTheDocument();
    expect(screen.queryByText('ROUND_VIEW')).not.toBeInTheDocument();
  });

  test('choosing "Rounds" writes view=round to the URL', async () => {
    render(<InterviewsIndex />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Rounds' }));
    expect(setSp).toHaveBeenCalled();
    const written = setSp.mock.calls.at(-1)![0] as URLSearchParams;
    expect(written.get('view')).toBe('round');
  });

  test('view=round in the URL renders the flat round list', () => {
    sp = new URLSearchParams('view=round');
    render(<InterviewsIndex />);
    expect(screen.getByText('ROUND_VIEW')).toBeInTheDocument();
    expect(screen.queryByText('PROCESS_VIEW')).not.toBeInTheDocument();
  });

  test('view=candidate in the URL renders the candidates list', () => {
    sp = new URLSearchParams('view=candidate');
    render(<InterviewsIndex />);
    expect(screen.getByText('CANDIDATE_VIEW')).toBeInTheDocument();
  });

  test('choosing "Candidates" writes view=candidate to the URL', async () => {
    render(<InterviewsIndex />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Candidates' }));
    const written = setSp.mock.calls.at(-1)![0] as URLSearchParams;
    expect(written.get('view')).toBe('candidate');
  });

  test('non-managers get the round list only, with no switcher', () => {
    authUser = { id: 'u2', role: 'Member' };
    render(<InterviewsIndex />);
    expect(screen.getByText('ROUND_VIEW')).toBeInTheDocument();
    expect(screen.queryByText('Group by')).not.toBeInTheDocument();
  });
});
