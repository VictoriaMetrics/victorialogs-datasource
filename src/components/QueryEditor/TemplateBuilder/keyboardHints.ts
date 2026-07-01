export interface Hint {
  keys: string[];
  label: string;
}

/** Hints for the "Add pipe step" search menu */
export function getPipeMenuHints(): Hint[] {
  return [
    { keys: ['Enter'], label: 'Add' },
    { keys: ['Shift', 'Enter'], label: 'Run' },
  ];
}

interface PlaceholderHintState {
  /** Multi-value chip — surfaces the `Backspace` (remove last value) hint */
  isMulti?: boolean;
  /** A list option is highlighted — Tab picks it instead of just advancing */
  hasHighlightedOption?: boolean;
}

/** Hints for the placeholder value dropdown, tailored to the chip's current state */
export function getPlaceholderHints({ isMulti, hasHighlightedOption }: PlaceholderHintState = {}): Hint[] {
  const hints: Hint[] = [{ keys: ['Enter'], label: 'Select' }];

  // In a multi-value chip with a highlighted option, Tab picks that value first
  // rather than advancing to the next segment — the "Next" hint would mislead, so omit it
  if (!(isMulti && hasHighlightedOption)) {
    hints.push({ keys: ['Tab'], label: 'Next' });
  }

  if (isMulti) {
    hints.push({ keys: ['Backspace'], label: 'Remove' });
  }

  return hints;
}
