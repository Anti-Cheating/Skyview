import { describe, expect, it } from 'vitest';
import { parseBlocks } from '../../src/components/Assessments/QuestionText';

describe('parseBlocks', () => {
  it('turns a markdown table into a table block between text', () => {
    const text = 'Given the table:\n\nModel | Avg Latency (ms) | Cost\n--- | --- | ---\nA | 120 | $0.02\nB | 80 | $0.03\n\nWhich is cheapest?';
    expect(parseBlocks(text)).toEqual([
      { kind: 'text', text: 'Given the table:' },
      { kind: 'table', head: ['Model', 'Avg Latency (ms)', 'Cost'], rows: [['A', '120', '$0.02'], ['B', '80', '$0.03']] },
      { kind: 'text', text: 'Which is cheapest?' },
    ]);
  });

  it('handles leading/trailing pipes and leaves plain text alone', () => {
    expect(parseBlocks('| x | y |\n|---|---|\n| 1 | 2 |')).toEqual([{ kind: 'table', head: ['x', 'y'], rows: [['1', '2']] }]);
    expect(parseBlocks('a | b without a separator')).toEqual([{ kind: 'text', text: 'a | b without a separator' }]);
  });
});
