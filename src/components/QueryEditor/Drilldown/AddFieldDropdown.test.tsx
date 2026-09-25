import { fireEvent, render, screen } from '@testing-library/react';
import React, { createRef } from 'react';

import { AddFieldDropdown } from './AddFieldDropdown';

beforeAll(() => {
  // jsdom has no scrollIntoView, which useDropdownNavigation calls on every highlight change
  Element.prototype.scrollIntoView = jest.fn();
});

const renderDropdown = () => {
  const onSelect = jest.fn();
  render(
    <AddFieldDropdown
      fieldNames={['app', 'host', 'level']}
      onSelect={onSelect}
      loading={false}
      containerRef={createRef<HTMLDivElement>()}
    />
  );
  return { onSelect, input: screen.getByPlaceholderText('Search fields') };
};

describe('AddFieldDropdown', () => {
  it('Enter selects the highlighted field', () => {
    const { onSelect, input } = renderDropdown();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('host');
  });

  it('a search change resets the highlight, so Enter after narrowing selects nothing and does not throw', () => {
    const { onSelect, input } = renderDropdown();

    // highlight the last option, then narrow the list to a single one
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: 'app' } });

    expect(() => fireEvent.keyDown(input, { key: 'Enter' })).not.toThrow();
    expect(onSelect).not.toHaveBeenCalled();

    // the navigation starts over from the narrowed list
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('app');
  });
});
