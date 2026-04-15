import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react';

interface UseFloatingDropdownOptions {
  open: boolean;
  /** Gap between anchor and floating element in pixels (default: 0) */
  offsetPx?: number;
  /** Upper cap for dropdown height in pixels (default: uncapped) */
  maxHeight?: number;
  /** Minimum dropdown height in pixels (default: 60) */
  minHeight?: number;
}

export function useFloatingDropdown({ open, offsetPx = 0, maxHeight, minHeight = 60 }: UseFloatingDropdownOptions) {
  return useFloating({
    open,
    placement: 'bottom-start',
    middleware: [
      ...(offsetPx ? [offset(offsetPx)] : []),
      flip(),
      shift(),
      size({
        apply({ availableHeight, elements }) {
          const h = availableHeight - 8;
          const capped = maxHeight !== undefined ? Math.min(h, maxHeight) : h;
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(capped, minHeight)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });
}
