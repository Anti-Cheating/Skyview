/**
 * Cross-spec shared state. The Owner spec writes the new TestCo's email +
 * company id + API tokens here; later specs read it. Re-running the suite
 * overwrites this file.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATE_PATH = resolve(__dirname, '..', '.state', 'run.json');

export interface UserCreds {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RunState {
  runId: string;
  owner: UserCreds & { companyName: string; companyId?: string; userId?: string };
  admin?: UserCreds & { userId?: string };
  member?: UserCreds & { userId?: string };
  interviewer?: UserCreds & { userId?: string };
  tokens?: { live?: string; test?: string };
  interviewId?: string;
  webhookEndpointId?: string;
}

export function readState(): RunState {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`No run state at ${STATE_PATH} — run 01-owner-flow.spec.ts first`);
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
}

export function writeState(s: RunState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2), 'utf8');
}

export function patchState(patch: Partial<RunState>): RunState {
  const cur = existsSync(STATE_PATH) ? readState() : ({} as RunState);
  const next = { ...cur, ...patch };
  writeState(next);
  return next;
}

export function stateExists(): boolean {
  return existsSync(STATE_PATH);
}
