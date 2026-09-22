import { describe, expect, it } from 'vitest';
import { diffLines } from '../src/features/artifacts/diff-lines.js';

describe('diffLines', () => {
  it('DEVOS-237: marks every line unchanged when both inputs are identical', () => {
    const result = diffLines('a\nb\nc', 'a\nb\nc');

    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ]);
  });

  it('DEVOS-237: marks every line added when the left side is empty', () => {
    const result = diffLines('', 'a\nb');

    expect(result).toEqual([
      { type: 'removed', text: '' },
      { type: 'added', text: 'a' },
      { type: 'added', text: 'b' },
    ]);
  });

  it('DEVOS-237: marks every line removed when the right side is empty', () => {
    const result = diffLines('a\nb', '');

    expect(result).toEqual([
      { type: 'removed', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: '' },
    ]);
  });

  it('DEVOS-237: mixes added/removed/unchanged for a real single-line change', () => {
    const result = diffLines('a\nb\nc', 'a\nx\nc');

    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'x' },
      { type: 'unchanged', text: 'c' },
    ]);
  });
});
