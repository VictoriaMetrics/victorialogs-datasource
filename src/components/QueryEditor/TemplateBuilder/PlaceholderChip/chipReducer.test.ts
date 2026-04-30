import { chipReducer, ChipState, initialChipState } from './chipReducer';

describe('chipReducer', () => {
  it('initialChipState has empty inputValue', () => {
    expect(initialChipState).toEqual({ inputValue: '' });
  });

  it('ACTIVATE sets inputValue to the provided initial value', () => {
    const state: ChipState = { inputValue: 'previous' };
    const next = chipReducer(state, { type: 'ACTIVATE', initialValue: 'foo' });
    expect(next).toEqual({ inputValue: 'foo' });
  });

  it('ACTIVATE with empty initialValue resets inputValue to empty string', () => {
    const state: ChipState = { inputValue: 'previous' };
    const next = chipReducer(state, { type: 'ACTIVATE', initialValue: '' });
    expect(next).toEqual({ inputValue: '' });
  });

  it('TYPE sets inputValue to the provided text', () => {
    const state: ChipState = { inputValue: 'old' };
    const next = chipReducer(state, { type: 'TYPE', text: 'abc' });
    expect(next).toEqual({ inputValue: 'abc' });
  });

  it('TYPE with empty text sets inputValue to empty string', () => {
    const state: ChipState = { inputValue: 'old' };
    const next = chipReducer(state, { type: 'TYPE', text: '' });
    expect(next).toEqual({ inputValue: '' });
  });

  it('RESET_INPUT clears inputValue regardless of previous state', () => {
    const state: ChipState = { inputValue: 'anything' };
    const next = chipReducer(state, { type: 'RESET_INPUT' });
    expect(next).toEqual({ inputValue: '' });
  });

  it('RESET_INPUT on already empty state is a no-op', () => {
    const state: ChipState = { inputValue: '' };
    const next = chipReducer(state, { type: 'RESET_INPUT' });
    expect(next).toEqual({ inputValue: '' });
  });
});
