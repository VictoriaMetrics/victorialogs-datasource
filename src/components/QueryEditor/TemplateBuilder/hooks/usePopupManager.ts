import { useCallback, useState } from 'react';

type PopupState =
  | { type: 'none' }
  | { type: 'placeholder'; activeId: string }
  | { type: 'pipeMenu'; insertAtIndex: number | null; anchorEl: HTMLElement | null }
  | { type: 'extensionMenu'; pipeId: string };

export function usePopupManager() {
  const [popup, setPopup] = useState<PopupState>({ type: 'none' });

  // Derived state — backward-compatible with existing component props
  const activeId: string | null = popup.type === 'placeholder' ? popup.activeId : null;
  const addMenuOpen: boolean = popup.type === 'pipeMenu';
  const insertAtIndex: number | null = popup.type === 'pipeMenu' ? popup.insertAtIndex : null;
  const insertAnchorEl: HTMLElement | null = popup.type === 'pipeMenu' ? popup.anchorEl : null;

  // Passed to useTabNavigation as setActiveId
  const setActiveId = useCallback((id: string | null) => {
    if (id !== null) {
      setPopup({ type: 'placeholder', activeId: id });
    } else {
      setPopup({ type: 'none' });
    }
  }, []);

  const openAddMenu = useCallback(() => {
    setPopup({ type: 'pipeMenu', insertAtIndex: null, anchorEl: null });
  }, []);

  const openInsertMenu = useCallback((index: number, anchorEl: HTMLElement) => {
    setPopup({ type: 'pipeMenu', insertAtIndex: index, anchorEl });
  }, []);

  const closeAddMenu = useCallback(() => {
    setPopup((prev) => (prev.type === 'pipeMenu' ? { type: 'none' } : prev));
  }, []);

  const closeAll = useCallback(() => {
    setPopup({ type: 'none' });
  }, []);

  const handleExtensionVisibleChange = useCallback((pipeId: string, visible: boolean) => {
    if (visible) {
      setPopup({ type: 'extensionMenu', pipeId });
    } else {
      setPopup((prev) =>
        prev.type === 'extensionMenu' && prev.pipeId === pipeId ? { type: 'none' } : prev
      );
    }
  }, []);

  const isExtensionMenuOpen = useCallback(
    (pipeId: string) => popup.type === 'extensionMenu' && popup.pipeId === pipeId,
    [popup]
  );

  return {
    activeId,
    addMenuOpen,
    insertAtIndex,
    insertAnchorEl,
    setActiveId,
    openAddMenu,
    openInsertMenu,
    closeAddMenu,
    closeAll,
    handleExtensionVisibleChange,
    isExtensionMenuOpen,
  };
}
