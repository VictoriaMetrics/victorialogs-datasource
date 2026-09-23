import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { MainFieldTabs, PATTERNS_TAB } from './MainFieldTabs';

const renderTabs = () => {
  const onSelect = jest.fn();
  const onCloseField = jest.fn();
  render(
    <MainFieldTabs
      tabs={['level', 'host']}
      active='host'
      unclosableTabs={['level']}
      onSelect={onSelect}
      onAddField={jest.fn()}
      onCloseField={onCloseField}
      fieldNames={[]}
      fieldsLoading={false}
    />
  );
  return { onSelect, onCloseField };
};

describe('MainFieldTabs', () => {
  it('renders a close button only for the user-added tabs, outside of the tab element', () => {
    renderTabs();

    const closeButton = screen.getByRole('button', { name: 'Close host tab' });
    expect(closeButton.tagName).toBe('BUTTON');
    // an interactive element must not nest inside the tab's own button
    expect(closeButton.closest('[role="tab"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close level tab' })).not.toBeInTheDocument();
  });

  it('the close button closes the tab without selecting it', async () => {
    const { onSelect, onCloseField } = renderTabs();

    await userEvent.click(screen.getByRole('button', { name: 'Close host tab' }));

    expect(onCloseField).toHaveBeenCalledWith('host');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking a tab selects it', async () => {
    const { onSelect } = renderTabs();

    await userEvent.click(screen.getByRole('tab', { name: 'Patterns' }));

    expect(onSelect).toHaveBeenCalledWith(PATTERNS_TAB);
  });
});
