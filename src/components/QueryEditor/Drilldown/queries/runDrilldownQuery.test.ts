import { of, throwError } from 'rxjs';

import { DataQueryError, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';

import { runDrilldownQuery, toErrorText } from './runDrilldownQuery';

const frame = { refId: 'A', fields: [] };

const makeDatasource = (...responses: DataQueryResponse[]) =>
  ({ query: jest.fn().mockReturnValue(of(...responses)) }) as unknown as VictoriaLogsDatasource;

const request = {} as DataQueryRequest<Query>;

const run = (datasource: VictoriaLogsDatasource) => {
  const onFrames = jest.fn();
  const onError = jest.fn();
  runDrilldownQuery(datasource, request, { onFrames, onError });
  return { onFrames, onError };
};

describe('runDrilldownQuery', () => {
  it('collects the frames of every emission', () => {
    const { onFrames, onError } = run(makeDatasource({ data: [frame] }, { data: [frame] }));

    expect(onError).not.toHaveBeenCalled();
    expect(onFrames).toHaveBeenCalledTimes(1);
    expect(onFrames.mock.calls[0][0]).toHaveLength(2);
  });

  it('reports every entry of `errors`', () => {
    const errors: DataQueryError[] = [{ message: 'first' }, { message: 'second' }];
    const { onFrames, onError } = run(makeDatasource({ data: [], errors }));

    expect(onError).toHaveBeenCalledWith([{ message: 'first' }, { message: 'second' }]);
    expect(onFrames).not.toHaveBeenCalled();
  });

  it('falls back to the deprecated single `error`', () => {
    const { onError } = run(makeDatasource({ data: [], error: { message: 'boom' } }));

    expect(onError).toHaveBeenCalledWith([{ message: 'boom' }]);
  });

  it('prefers `errors` over `error` when a response carries both', () => {
    const { onError } = run(makeDatasource({ data: [], errors: [{ message: 'new' }], error: { message: 'old' } }));

    expect(onError).toHaveBeenCalledWith([{ message: 'new' }]);
  });

  it.each([
    [{ data: { message: 'from data' } }, 'from data'],
    [{ statusText: 'Bad Request' }, 'Bad Request'],
    [{ status: 500 }, 'Query failed'],
  ])('fills in a missing message from %p', (error, expected) => {
    const { onError } = run(makeDatasource({ data: [], errors: [error] }));

    expect(onError.mock.calls[0][0][0].message).toBe(expected);
  });

  it('keeps the other fields of an error', () => {
    const { onError } = run(makeDatasource({ data: [], errors: [{ message: 'boom', refId: 'A', status: 500 }] }));

    expect(onError).toHaveBeenCalledWith([{ message: 'boom', refId: 'A', status: 500 }]);
  });

  it('does not deliver frames that arrive in the same emission as an error', () => {
    const { onFrames, onError } = run(makeDatasource({ data: [frame], errors: [{ message: 'boom' }] }));

    expect(onError).toHaveBeenCalled();
    expect(onFrames).not.toHaveBeenCalled();
  });

  it('does not deliver frames collected before a later emission fails', () => {
    const { onFrames, onError } = run(makeDatasource({ data: [frame] }, { data: [], errors: [{ message: 'boom' }] }));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFrames).not.toHaveBeenCalled();
  });

  it('reports an error delivered through the observable channel', () => {
    const datasource = {
      query: jest.fn().mockReturnValue(throwError(() => new Error('network down'))),
    } as unknown as VictoriaLogsDatasource;
    const { onFrames, onError } = run(datasource);

    expect(onError).toHaveBeenCalledWith([{ message: 'network down' }]);
    expect(onFrames).not.toHaveBeenCalled();
  });
});

describe('toErrorText', () => {
  it('returns the single message unchanged', () => {
    expect(toErrorText([{ message: 'boom' }])).toBe('boom');
  });

  it('joins several messages', () => {
    expect(toErrorText([{ message: 'first' }, { message: 'second' }])).toBe('first; second');
  });
});
