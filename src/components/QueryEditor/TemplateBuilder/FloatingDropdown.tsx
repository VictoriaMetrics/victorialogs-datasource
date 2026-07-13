import React from 'react';
import { createPortal } from 'react-dom';

import { useTheme2 } from '@grafana/ui';

interface Props {
  floatingRef: (el: HTMLElement | null) => void;
  floatingStyles: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

export const FloatingDropdown: React.FC<Props> = ({ floatingRef, floatingStyles, className, children }) => {
  const theme = useTheme2();

  // above theme.zIndex.modal (1060) — this portal must render on top of a Drawer's own content,
  // which sits at the modal layer
  return createPortal(
    <div
      ref={floatingRef}
      style={{ ...floatingStyles, zIndex: theme.zIndex.portal }}
      className={className}
      data-floating-portal='true'
    >
      {children}
    </div>,
    document.body
  );
};
