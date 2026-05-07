export interface ChipState {
  /** Raw text in the chip input (what the user has typed in the active chip). */
  inputValue: string;
}

export type ChipAction =
  | { type: 'ACTIVATE'; initialValue: string }
  | { type: 'TYPE'; text: string }
  | { type: 'RESET_INPUT' };

export const initialChipState: ChipState = { inputValue: '' };

/**
 * Pure reducer for PlaceholderChip's local input state.
 * Side effects (loadOptions, parent callbacks, focus, highlighted index) live in useChipIntents;
 * this reducer only mutates inputValue.
 */
export function chipReducer(state: ChipState, action: ChipAction): ChipState {
  switch (action.type) {
    case 'ACTIVATE':
      return { inputValue: action.initialValue };
    case 'TYPE':
      return { inputValue: action.text };
    case 'RESET_INPUT':
      return state.inputValue === '' ? state : { inputValue: '' };
    default:
      return state;
  }
}
