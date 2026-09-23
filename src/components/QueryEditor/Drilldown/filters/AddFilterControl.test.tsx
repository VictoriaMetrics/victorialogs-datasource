import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dateTime, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';

import { AddFilterControl } from './AddFilterControl';


jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ getVariables: () => [] }),
}));

/** FloatingDropdown renders the options list in a document.body portal. Scope the queries to it,
 * so they do not match other elements with the same text */
const getOptionsPortal = () => within(document.querySelector('[data-floating-portal]') as HTMLElement);

const timeRange: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

const existingFilters: AdHocFilter[] = [{ key: 'app', value: 'web', operator: '=' }];

beforeAll(() => {
  // jsdom has no scrollIntoView, which useDropdownNavigation calls when the mouse hovers an option
  Element.prototype.scrollIntoView = jest.fn();
});

const makeDatasource = () => {
  // a field-name lookup carries no `field` and a value lookup does, so one mock serves both
  const getFieldList = jest.fn(async ({ field }: { field?: string }) =>
    (field ? ['error', 'warn'] : ['level', 'app']).map((value) => ({ value, hits: 1 }))
  );
  return {
    languageProvider: { getFieldList },
    customQueryParameters: new URLSearchParams(),
    getQueryBuilderLimits: jest.fn(() => 100),
    // buildLookupQuery builds the narrowing query out of these two
    getActiveLevelRules: jest.fn(() => []),
    interpolateString: jest.fn((s: string) => s),
  } as unknown as VictoriaLogsDatasource;
};

const renderControl = (datasource: VictoriaLogsDatasource, onAdd = jest.fn()) => {
  render(
    <AddFilterControl
      datasource={datasource}
      existingFilters={existingFilters}
      timeRange={timeRange}
      onAdd={onAdd}
    />
  );
  return onAdd;
};

describe('AddFilterControl', () => {
  it('opens the inline field chip with its options from the "+ Filter" button', async () => {
    renderControl(makeDatasource());

    expect(screen.queryByPlaceholderText('field_name')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByPlaceholderText('field_name')).toBeInTheDocument();

    expect(await getOptionsPortal().findByText('level')).toBeInTheDocument();
    expect(getOptionsPortal().getByText('app')).toBeInTheDocument();
  });

  it('picking a field activates the operator chip; picking the operator activates the value chip with narrowed values', async () => {
    const datasource = makeDatasource();
    renderControl(datasource);

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(await getOptionsPortal().findByText('level'));

    // the operator step comes after the field and before the value
    expect(screen.queryByPlaceholderText('field_name')).not.toBeInTheDocument();
    expect(await getOptionsPortal().findByText('!=')).toBeInTheDocument();
    await userEvent.click(getOptionsPortal().getByText('='));

    expect(screen.getByPlaceholderText('value')).toBeInTheDocument();
    expect(await getOptionsPortal().findByText('error')).toBeInTheDocument();
    // the narrowing query keeps the other filters, such as app=web, but never one on the picked key
    expect(datasource.languageProvider?.getFieldList).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'level', timeRange, query: 'app:="web"' }),
      expect.anything()
    );
  });

  it('picking a value calls onAdd with the picked "=" operator and collapses back to the button', async () => {
    const onAdd = renderControl(makeDatasource());

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(await getOptionsPortal().findByText('level'));
    await userEvent.click(await getOptionsPortal().findByText('='));
    await userEvent.click(await getOptionsPortal().findByText('error'));

    expect(onAdd).toHaveBeenCalledWith({ key: 'level', value: 'error', operator: '=' });
    expect(screen.queryByPlaceholderText('value')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('picking "!=" on the operator step yields that operator in the added filter', async () => {
    const onAdd = renderControl(makeDatasource());

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(await getOptionsPortal().findByText('level'));
    await userEvent.click(await getOptionsPortal().findByText('!='));
    await userEvent.click(await getOptionsPortal().findByText('warn'));

    expect(onAdd).toHaveBeenCalledWith({ key: 'level', value: 'warn', operator: '!=' });
  });

  it('picking "=~" and typing a custom pattern adds a regexp filter', async () => {
    const onAdd = renderControl(makeDatasource());

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(await getOptionsPortal().findByText('level'));
    await userEvent.click(await getOptionsPortal().findByText('=~'));
    await userEvent.type(screen.getByPlaceholderText('value'), 'err.*{Enter}');

    expect(onAdd).toHaveBeenCalledWith({ key: 'level', value: 'err.*', operator: '=~' });
  });

  it('Escape before a field is chosen collapses the draft without onAdd and without reaching outer listeners', async () => {
    const onAdd = renderControl(makeDatasource());

    // stands in for an outer bubble-phase listener, such as the Drawer closing itself on Escape.
    // It must not see the key once the chip's own handler has stopped the propagation
    const outerKeyDown = jest.fn();
    document.addEventListener('keydown', outerKeyDown);

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const input = screen.getByPlaceholderText('field_name');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByPlaceholderText('field_name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
    expect(outerKeyDown).not.toHaveBeenCalled();

    document.removeEventListener('keydown', outerKeyDown);
  });

  it.each(['Enter', 'Tab'])('%s on an empty field input collapses the draft back to the button', async (key) => {
    const onAdd = renderControl(makeDatasource());

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.keyDown(screen.getByPlaceholderText('field_name'), { key });

    // no empty inactive chip is left behind
    expect(screen.queryByPlaceholderText('field_name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel new filter' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('Escape after a field is chosen keeps the draft chip', async () => {
    const onAdd = renderControl(makeDatasource());

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(await getOptionsPortal().findByText('level'));
    await getOptionsPortal().findByText('!=');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    expect(screen.getByRole('button', { name: 'Cancel new filter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
