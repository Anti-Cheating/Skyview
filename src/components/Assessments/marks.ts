import type { AssessmentQuestion } from '../../types/assessment.types';

type Q = Pick<AssessmentQuestion, 'format' | 'answer_key' | 'rubric' | 'points'>;

/** Has a right answer worth answer marks (written and build tasks are marked on their rubric only). Mirrors Cortex isKeyed. */
export const isKeyed = (q: Pick<Q, 'format' | 'answer_key'>) =>
  (q.format === 'mcq' && typeof q.answer_key === 'number')
  || ((q.format === 'multi' || q.format === 'fill_blank' || q.format === 'short_answer') && Array.isArray(q.answer_key));

export const rubricTotal = (q: Pick<Q, 'rubric'>) => (q.rubric ?? []).reduce((s, l) => s + l.points, 0);

/** Most a question can earn: answer marks (keyed only) + explanation marks. */
export const questionMax = (q: Q) => (isKeyed(q) ? q.points ?? 1 : 0) + rubricTotal(q);

export const paperMax = (qs: Q[]) => qs.filter((q) => q.format !== 'build').reduce((s, q) => s + questionMax(q), 0);

/** 1, 2.5, 0.25: no trailing zeros. */
export const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** "3 marks" / "1 mark". */
export const marksLabel = (n: number) => `${fmt(n)} mark${n === 1 ? '' : 's'}`;

/** Marks lost for a wrong answer: choice questions only (mirrors Cortex grading). */
export const minusOf = (q: Pick<AssessmentQuestion, 'format' | 'negative_marks'>) =>
  q.format === 'mcq' || q.format === 'multi' ? q.negative_marks ?? 0 : 0;

/** "3 marks" or "3 marks · −0.25 if wrong". */
export const marksWithMinus = (q: Q & Pick<AssessmentQuestion, 'negative_marks'>) => {
  const minus = minusOf(q);
  return `${marksLabel(questionMax(q))}${minus > 0 ? ` · −${fmt(minus)} if wrong` : ''}`;
};
