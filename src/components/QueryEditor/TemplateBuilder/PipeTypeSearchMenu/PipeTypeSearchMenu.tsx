import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { Button } from '@grafana/ui';

import { useFloatingDropdown } from '../hooks/useFloatingDropdown';
import { getMenuGroups } from '../templates/registry';

import { PipeTypeSearchPopup } from './PipeTypeSearchPopup';

interface Props {
  isOpen: boolean;
  onAdd: (templateType: string) => void;
  onOpenMenu: () => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
}

export const PipeTypeSearchMenu: React.FC<Props> = ({ isOpen, onAdd, onOpenMenu, onClose, anchorEl }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { refs: floatingRefs, floatingStyles } = useFloatingDropdown({
    open: isOpen,
    offsetPx: 4,
    maxHeight: 320,
    minHeight: 100,
  });
  const setReference = floatingRefs.setReference;
  const setFloating = floatingRefs.setFloating;

  // When an external anchor element is provided (e.g. from InsertableSeparator),
  // use it as the floating-ui reference instead of the internal button.
  // useLayoutEffect runs before paint, preventing the menu from visually jumping.
  useLayoutEffect(() => {
    if (anchorEl) {
      setReference(anchorEl);
    } else if (buttonRef.current) {
      setReference(buttonRef.current);
    }
  }, [anchorEl, setReference]);

  const allGroups = useMemo(() => getMenuGroups(), []);

  const handleButtonClick = useCallback(() => {
    // If menu is open and anchored to this button (no external anchor) → close (toggle).
    // Otherwise (closed, or open at an insert position) → open at this button.
    if (isOpen && !anchorEl) {
      onClose();
    } else {
      onOpenMenu();
    }
  }, [isOpen, anchorEl, onClose, onOpenMenu]);

  const handleButtonFocus = useCallback(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <Button
        ref={(el) => {
          buttonRef.current = el;
          if (!anchorEl) {
            (setReference as (el: HTMLButtonElement | null) => void)(el);
          }
        }}
        size={'sm'}
        variant='secondary'
        icon='plus'
        aria-label='Add pipe'
        aria-expanded={isOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleButtonClick}
      />

      {isOpen && (
        <PipeTypeSearchPopup
          groups={allGroups}
          floatingRef={setFloating}
          floatingStyles={floatingStyles}
          excludeRef={buttonRef}
          onAdd={onAdd}
          onClose={onClose}
          onButtonFocus={handleButtonFocus}
        />
      )}
    </>
  );
};
