import React from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { ButtonVariant, ClipboardButton, ComponentSize, IconButton } from '@grafana/ui';

interface Props {
  /** Text written to the clipboard. When falsy, the button is auto-disabled */
  text: string | null | undefined;
  /** When provided, renders Grafana's ClipboardButton with this label. Otherwise renders an icon-only button */
  label?: string;
  tooltip: string;
  'aria-label'?: string;
  size?: ComponentSize;
  /** Forces disabled state regardless of `text` */
  disabled?: boolean;
  /** Toast on success — only used in icon-only mode. Defaults to "Copied to clipboard" */
  successMessage?: string;
  /** Toast on error — only used in icon-only mode. Defaults to "Failed to copy to clipboard" */
  errorMessage?: string;
  /** Visual variant of the labeled ClipboardButton. Defaults to "secondary" */
  variant?: ButtonVariant;
  /** Fill style of the labeled ClipboardButton. Defaults to "solid" */
  fill?: 'solid' | 'outline' | 'text';
}

export const CopyButton: React.FC<Props> = ({
  text,
  label,
  tooltip,
  'aria-label': ariaLabel,
  size = 'sm',
  disabled,
  successMessage = 'Copied to clipboard',
  errorMessage = 'Failed to copy to clipboard',
  variant = 'secondary',
  fill = 'solid',
}) => {
  const isDisabled = disabled || !text;
  const resolvedAriaLabel = ariaLabel ?? tooltip;

  if (label !== undefined) {
    return (
      <ClipboardButton
        icon='copy'
        size={size}
        variant={variant}
        fill={fill}
        tooltip={tooltip}
        aria-label={resolvedAriaLabel}
        disabled={isDisabled}
        getText={() => text ?? ''}
      >
        {label}
      </ClipboardButton>
    );
  }

  const handleClick = async () => {
    if (!text) {
      return;
    }
    try {
      await copyTextToClipboard(text);
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [successMessage],
      });
    } catch (err) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [errorMessage, err],
      });
    }
  };

  return (
    <IconButton
      name='copy'
      size={size}
      tooltip={tooltip}
      aria-label={resolvedAriaLabel}
      disabled={isDisabled}
      onClick={handleClick}
    />
  );
};

// Mirrors Grafana's ClipboardButton internals: uses the async Clipboard API in
// secure contexts, falls back to a hidden textarea + execCommand('copy') so
// copy still works on HTTP origins and in browsers without the Clipboard API.
const copyTextToClipboard = async (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) {
      throw new Error('document.execCommand("copy") returned false');
    }
  } finally {
    textarea.remove();
  }
};
