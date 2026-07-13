import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { AdHocFilter } from '../../../../types';

import { LevelFilterRow } from './LevelFilterRow';

const levelChip = (level: string): AdHocFilter => ({ key: 'level', operator: '=', value: level, fromLevelFilter: true });

describe('LevelFilterRow', () => {
  it('renders a button per level in the canonical order', () => {
    render(<LevelFilterRow filters={[]} onFiltersChange={jest.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'critical',
      'error',
      'warning',
      'info',
      'debug',
      'trace',
      'unknown',
    ]);
  });

  it('selecting a level appends its marked chip', async () => {
    const onFiltersChange = jest.fn();
    const existing: AdHocFilter[] = [{ key: 'app', operator: '=', value: 'web' }];
    render(<LevelFilterRow filters={existing} onFiltersChange={onFiltersChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'error' }));

    expect(onFiltersChange).toHaveBeenCalledWith([...existing, levelChip('error')]);
  });

  it('clicking a selected level removes its chip', async () => {
    const onFiltersChange = jest.fn();
    render(<LevelFilterRow filters={[levelChip('error'), levelChip('warning')]} onFiltersChange={onFiltersChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'error' }));

    expect(onFiltersChange).toHaveBeenCalledWith([levelChip('warning')]);
  });

  it('marks only the selected levels as active', () => {
    render(<LevelFilterRow filters={[levelChip('error')]} onFiltersChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'error' })).toHaveStyle({ opacity: 1 });
    expect(screen.getByRole('button', { name: 'info' })).toHaveStyle({ opacity: 0.5 });
  });
});
