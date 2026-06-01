import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { LogLevel } from '@grafana/data';

import { AdHocFilter, Query } from '../../../types';

import { LevelQueryFilter } from './LeveQueryFilter';

const baseQuery: Query = { refId: 'A', expr: '' };
const errorChip: AdHocFilter = { key: 'level', operator: '=', value: LogLevel.error, fromLevelFilter: true };

describe('LevelQueryFilter', () => {
  it('adds a marked level chip when a level button is clicked', () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    render(<LevelQueryFilter logLevelRules={[]} query={baseQuery} onChange={onChange} onRunQuery={onRunQuery} />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(LogLevel.error, 'i') }));

    expect(onChange).toHaveBeenCalledWith({ ...baseQuery, adHocFilters: [errorChip] });
  });

  it('removes the chip on a second click (toggle off)', () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const query: Query = { ...baseQuery, adHocFilters: [errorChip] };
    render(<LevelQueryFilter logLevelRules={[]} query={query} onChange={onChange} onRunQuery={onRunQuery} />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(LogLevel.error, 'i') }));

    expect(onChange).toHaveBeenCalledWith({ ...query, adHocFilters: undefined });
  });

  it('does not mutate query.expr', () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const query: Query = { ...baseQuery, expr: 'foo:bar' };
    render(<LevelQueryFilter logLevelRules={[]} query={query} onChange={onChange} onRunQuery={onRunQuery} />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(LogLevel.info, 'i') }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ expr: 'foo:bar' }));
  });

  it('runs the query after toggling a level', () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    render(<LevelQueryFilter logLevelRules={[]} query={baseQuery} onChange={onChange} onRunQuery={onRunQuery} />);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(LogLevel.error, 'i') }));

    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });
});
