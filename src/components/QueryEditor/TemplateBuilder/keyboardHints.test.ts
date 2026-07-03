import { getPipeMenuHints, getPlaceholderHints } from './keyboardHints';

describe('getPipeMenuHints', () => {
  it('returns the pipe menu hints in order', () => {
    expect(getPipeMenuHints()).toEqual([
      { keys: ['Enter'], label: 'Add' },
      { keys: ['Shift', 'Enter'], label: 'Run' },
    ]);
  });
});

describe('getPlaceholderHints', () => {
  it('returns the base hints in order', () => {
    expect(getPlaceholderHints()).toEqual([
      { keys: ['Enter'], label: 'Select' },
      { keys: ['Tab'], label: 'Next' },
    ]);
  });

  it('appends the Backspace remove hint for a multi-value placeholder', () => {
    expect(getPlaceholderHints({ isMulti: true })).toEqual([
      { keys: ['Enter'], label: 'Select' },
      { keys: ['Tab'], label: 'Next' },
      { keys: ['Backspace'], label: 'Remove' },
    ]);
  });

  it('does not add the Backspace hint for a single-value placeholder', () => {
    expect(getPlaceholderHints({ isMulti: false })).toEqual([
      { keys: ['Enter'], label: 'Select' },
      { keys: ['Tab'], label: 'Next' },
    ]);
  });

  it('hides the Tab hint for a multi-value chip when an option is highlighted', () => {
    expect(getPlaceholderHints({ isMulti: true, hasHighlightedOption: true })).toEqual([
      { keys: ['Enter'], label: 'Select' },
      { keys: ['Backspace'], label: 'Remove' },
    ]);
  });

  it('keeps the Tab hint for a single-value chip even when an option is highlighted', () => {
    expect(getPlaceholderHints({ isMulti: false, hasHighlightedOption: true })).toEqual([
      { keys: ['Enter'], label: 'Select' },
      { keys: ['Tab'], label: 'Next' },
    ]);
  });
});
