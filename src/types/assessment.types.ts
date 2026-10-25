export type AssessmentMode = 'live' | 'take_home';
export type AssessmentStatus = 'draft' | 'final' | 'cancelled';
/** build = take-home project in a repo or deliverable (brief + generated starter repo/spec, hidden attacks). */
export type QuestionFormat = 'mcq' | 'fill_blank' | 'short_answer' | 'written' | 'build';
export type DeliverableType = 'code' | 'spreadsheet' | 'document' | 'presentation' | 'data_analysis' | 'design' | 'video';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
/** Questions: blind re-solve result. Build tasks: 'generating' → 'ok' | 'failed'. */
/** unchecked = not re-solved yet; the check runs at finalize. */
export type CheckStatus = 'ok' | 'flagged' | 'accepted' | 'unchecked' | 'generating' | 'failed';

export interface RepoFile {
  path: string;
  content: string;
}
/** A build task's hidden part: the attacks, one file per rubric category. */
export interface BuildKey {
  tests: RepoFile[];
  /** Set when the sandbox checked that the starter boots (attacks don't run on it). */
  starter_check?: { ran_at: string; booted: boolean; rounds: number; error?: string };
}

export interface RubricLine {
  criterion: string;
  points: number;
}

export interface AssessmentQuestion {
  id: string;
  order: number;
  format: QuestionFormat;
  deliverable_type?: DeliverableType | null;
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  /** MCQ only. (A build task stores its starter repo here; read it with starterOf().) */
  options: string[] | null;
  /** MCQ: option index. Fill in the blank / short answer: accepted forms. Written: null. Build: BuildKey. */
  answer_key: number | string[] | BuildKey | null;
  /** Set → the candidate explains their answer (written: marked against it). */
  rubric: RubricLine[] | null;
  /** Blind re-solve by a second model. */
  check_status: CheckStatus;
  /** What the re-solve answered: option index (MCQ) or text. Build: { generated_at } or { error }. */
  check_answer: number | string | { generated_at?: string; error?: string } | null;
}

/** A build task's starter repo (stored in `options`). */
export const starterOf = (q: AssessmentQuestion): RepoFile[] =>
  q.format === 'build' ? ((q.options as unknown as { files?: RepoFile[] } | null)?.files ?? []) : [];

export interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

export interface Assessment {
  id: string;
  title: string;
  role: string | null;
  mode: AssessmentMode;
  duration_min: number;
  status: AssessmentStatus;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  chat: ChatEntry[];
  questions: AssessmentQuestion[];
}

export interface AssessmentListItem {
  id: string;
  title: string;
  role: string | null;
  mode: AssessmentMode;
  duration_min: number;
  status: AssessmentStatus;
  created_at: string;
  updated_at: string;
  question_count: number;
  /** Questions whose answer key failed the check; Finalize is blocked while > 0. */
  flagged_count: number;
}

export interface CreateAssessmentInput {
  title: string;
  role?: string | null;
  mode: AssessmentMode;
  duration_min: number;
}

export type QuestionPatch = Partial<
  Pick<
    AssessmentQuestion,
    'format' | 'topic' | 'difficulty' | 'prompt' | 'options' | 'answer_key' | 'rubric'
  >
>;

export type InviteStatus = 'invited' | 'started' | 'submitted' | 'revoked';

export interface AssessmentInvite {
  id: string;
  status: InviteStatus;
  /** Live: can start from. Take-home: when the link was created. */
  opens_at: string;
  /** Live: must finish by. Take-home: must start by. */
  closes_at: string;
  invite_sent_at: string | null;
  created_at: string;
  started_at: string | null;
  submitted_at: string | null;
  candidate: { id: string; email: string; first_name: string | null; last_name: string | null };
}

export interface InviteCandidate {
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface InviteResult {
  invited: number;
  emails_sent: number;
  /** Already invited to this assessment. */
  skipped: string[];
  failed: Array<{ email: string; error: string }>;
  invites: AssessmentInvite[];
}

/** What the candidate page gets from GET /a/:token (no answer keys, ever). */
export interface CandidateAttempt {
  now: string;
  status: 'invited' | 'started' | 'submitted' | 'revoked' | 'cancelled';
  candidate_name: string;
  assessment: {
    title: string;
    company: string;
    mode: AssessmentMode;
    duration_min: number;
    question_count: number;
    explain_count: number;
  };
  opens_at: string;
  closes_at: string;
  /** False while the local testing switch is on: ignore "not open yet" / "closed". */
  window_enforced: boolean;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  /** Live only: the session the Trueyy Helper binds to. Null for take-home or once finished. */
  helper: { session_id: string; participant_id: string } | null;
  /** Only once started, in this candidate's shuffled order. */
  questions: Array<{
    id: string;
    format: QuestionFormat;
    deliverable_type?: DeliverableType | null;
    prompt: string;
    /** Shuffled; `id` is what gets saved. */
    options: Array<{ id: number; text: string }> | null;
    /** Ask for an explanation alongside the answer. */
    explain: boolean;
    /** Build task: signed API path to the starter .zip and the folder / repo name it unpacks to. */
    starter?: { path: string; folder: string } | null;
  }> | null;
  answers: Array<{ question_id: string; answer: number | string | null; explanation: string | null; time_ms: number; deliverable_files?: any[] | null }> | null;
}

/** One row on a logged-in candidate's "Assessments" page. */
export interface MyAssessment {
  id: string;
  status: CandidateAttempt['status'];
  title: string;
  company: string;
  mode: AssessmentMode;
  duration_min: number;
  opens_at: string;
  closes_at: string;
  started_at: string | null;
  submitted_at: string | null;
  window_enforced: boolean;
}

export type GradingStatus = 'pending' | 'done' | 'failed' | null;

/**
 * Trust in an attempt, from the Trueyy Helper (Live) and answer timing.
 * The scoreboard ranks by final_score = score × factor.
 */
export interface Integrity {
  /** none = take-home with nothing flagged (no Helper). */
  level: 'clean' | 'review' | 'high' | 'critical' | 'none';
  factor: number;
  reasons: Array<{ text: string; level: 'critical' | 'high' | 'review' }>;
  /** The automatic level: the Trueyy Helper report's verdict when written, else the signals'. */
  auto_level: 'clean' | 'review' | 'high' | 'critical' | 'none';
  /** What the alert rules alone say. */
  signals_level: 'clean' | 'review' | 'high' | 'critical' | 'none';
  source: 'report' | 'signals';
  /** Live: the Trueyy Helper report's state. Null for take-home. */
  report_status: 'pending' | 'done' | 'failed' | null;
  /** The report's summary (scoreboard rows only). */
  summary?: string | null;
  overridden: boolean;
  /** Last hand change (from the audit log): who, when, and to what (null = back to automatic). */
  changed: { by: string; at: string; level: 'clean' | 'review' | 'high' | 'critical' | null } | null;
}

/** One row of the Results tab. Scores are 0–100. */
export interface AssessmentResultRow {
  id: string;
  status: 'started' | 'submitted';
  grading_status: GradingStatus;
  score: number | null;
  accuracy: number | null;
  reasoning: number | null;
  integrity: Integrity;
  /** score × integrity factor; what the scoreboard ranks by. */
  final_score: number | null;
  started_at: string | null;
  submitted_at: string | null;
  time_ms: number;
  answered: number;
  candidate: { id: string; email: string; first_name: string | null; last_name: string | null };
}

export interface RubricMark {
  criterion: string;
  points: number;
  earned: number;
  reason: string;
  plain_explanation?: string;
  business_impact?: string;
  /** Build task review: the exact lines behind the mark. */
  evidence?: Array<{ file: string; line: number; note: string }>;
  /** Build task run in the sandbox: proven hidden tests passed, and the ones that failed. */
  tests?: { passed: number; total: number };
  failed?: Array<{ name: string; error?: string }>;
  /** Broken attacks left out of the score: they demanded something the brief leaves open. */
  set_aside?: Array<{ attack: string; expected: string; why: string }>;
  /** Attacks whose own code failed (crash, bad import): not counted. */
  attack_bugs?: Array<{ attack: string; error: string }>;
  /** Left out of the score (e.g. a code-review category the AI couldn't review this run). */
  not_scored?: boolean;
  /** Bugs the attack agent found on its own, each proven by an attack that failed twice. */
  findings?: Array<{
    title: string; severity: 'critical' | 'high' | 'medium' | 'low'; violates: string; why: string;
    evidence: Array<{ file: string; line: number; note: string }>; attack: string; code: string; in_category: boolean;
  }>;
}

/** Build task AI review of the repo at the submitted commit. */
export type BuildReview = {
  sha?: string; summary?: string; error?: string; reviewed_at: string;
  recommendation?: 'Strong Yes' | 'Yes' | 'Needs Discussion' | 'No';
  strengths?: string[];
  concerns?: string[];
  interview_questions?: string[];
  /** Set when the repo was run in the sandbox. */
  run?: { booted: boolean; passed: number; total: number; error?: string; logs?: string };
};

/** One candidate's full result: every question in paper order. */
export interface HelperAlert {
  at: string;
  kind: 'app' | 'keyboard' | 'activity';
  risk: string | null;
  label: string;
}

export interface TimelineItem {
  /** Milliseconds after Start. */
  t_ms: number;
  /** focus = that app came to the front; closed = it closed. */
  kind: 'start' | 'submit' | 'app' | 'keyboard' | 'activity' | 'focus' | 'closed' | 'voice' | 'audio' | 'answer';
  text: string;
  risk?: string | null;
  /** Answer: correct / wrong / not keyed. */
  ok?: boolean | null;
}

export interface AssessmentResultDetail extends Omit<AssessmentResultRow, 'time_ms' | 'answered'> {
  role: string | null;
  /** Live: the Trueyy Helper report, once written after grading. */
  report: { summary: string; evidence: Array<{ at: string; text: string }>; verdict: Integrity['level']; generated_at: string } | null;
  /** Start, alerts, voice, each answer and submit, in order. */
  timeline: TimelineItem[];
  questions: Array<{
    id: string;
    order: number;
    format: QuestionFormat;
    deliverable_type?: DeliverableType | null;
    topic: string;
    difficulty: Difficulty;
    prompt: string;
    options: string[] | null;
    answer_key: number | string[] | null;
    rubric: RubricLine[] | null;
    answer: number | string | null;
    explanation: string | null;
    time_ms: number;
    answered_at: string | null;
    is_correct: boolean | null;
    /** "exact" | "ai_match" | "ai_no_match" */
    match_note: string | null;
    rubric_marks: RubricMark[] | null;
    deliverable_files?: Array<{ name: string; url: string; type?: string; size?: number }> | null;
    review?: BuildReview | null;
  }>;
}

/** Live progress of one chat turn (streamed from Cortex). */
export type ChatEvent =
  | { type: 'stage'; stage: 'reading' | 'writing' | 'checking' | 'saving'; total?: number }
  | { type: 'plan'; text: string }
  | { type: 'draft'; n: number; question: Partial<Pick<AssessmentQuestion, 'format' | 'topic' | 'difficulty' | 'prompt'>> & { options?: string[] | null } }
  | { type: 'check'; done: number; total: number };
