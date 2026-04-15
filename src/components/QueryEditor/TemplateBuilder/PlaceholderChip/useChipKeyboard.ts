import React, { useCallback } from 'react';

export interface ChipKeyboardHandlers {
  handleType: (text: string) => void;
  handlePick: (value: string) => void;
  handleRemoveLast: () => void;
  handleFinalize: () => void;
  handleCancel: () => void;
}

export interface DispatchKeyEventArgs {
  state: {
    inputValue: string;
    /** Currently-picked value: highlighted option if any, otherwise the raw input. */
    pickedValue: string;
  };
  ctx: {
    isMulti: boolean;
    hasMultiValues: boolean;
  };
  handlers: ChipKeyboardHandlers;
  /** Arrow navigation delegator. Returns true when it consumed the event. */
  onNavigate: (event: React.KeyboardEvent) => boolean;
}

/**
 * Pure keyboard → intent dispatcher. No React state; no side effects beyond calling handlers.
 * Tested directly without renderHook.
 */
export function dispatchKeyEvent(args: DispatchKeyEventArgs, event: React.KeyboardEvent): void {
  const { state, ctx, handlers, onNavigate } = args;
  const { inputValue, pickedValue } = state;
  const { isMulti, hasMultiValues } = ctx;

  // Backspace: only consumed when we're in multi with empty input and something to drop.
  // Otherwise fall through to the native input-editing behavior.
  if (event.key === 'Backspace') {
    if (isMulti && inputValue === '' && hasMultiValues) {
      event.preventDefault();
      handlers.handleRemoveLast();
    }
    return;
  }

  // Arrow navigation is owned by useDropdownNavigation — delegate.
  if (onNavigate(event)) {
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    if (isMulti && !pickedValue) {
      handlers.handleFinalize();
    } else {
      handlers.handlePick(pickedValue);
    }
    return;
  }

  if (event.key === 'Escape') {
    event.stopPropagation();
    handlers.handleCancel();
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    event.stopPropagation();
    if (isMulti) {
      if (pickedValue) {
        handlers.handlePick(pickedValue);
      }
      handlers.handleFinalize();
    } else {
      // Single: always commit pickedValue (may be '' — preserves current contract).
      handlers.handlePick(pickedValue);
    }
    return;
  }
}

/**
 * Hook wrapper around dispatchKeyEvent — returns a stable handleKeyDown callback.
 */
export function useChipKeyboard(args: DispatchKeyEventArgs): (event: React.KeyboardEvent) => void {
  return useCallback(
    (event: React.KeyboardEvent) => dispatchKeyEvent(args, event),
    // All fields of `args` are considered — keep the dep list explicit.
    [args]
  );
}
