import React from 'react';
import { createPortal } from 'react-dom';

interface Props {
  floatingRef: (el: HTMLElement | null) => void;
  floatingStyles: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

export const FloatingDropdown: React.FC<Props> = ({ floatingRef, floatingStyles, className, children }) =>
  createPortal(
    <div
      ref={floatingRef}
      style={{ ...floatingStyles, zIndex: 1000 }}
      className={className}
      data-floating-portal='true'
    >
      {children}
    </div>,
    document.body
  );
