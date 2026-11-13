import { describeError, VictoriaLogsSupport, VictoriaLogsSupportCache } from './victoriaLogsSupport';

const supported: VictoriaLogsSupport = { version: 'v1.54.0', versionKnown: true, minVersion: 'v1.54.0', supported: true };
const unknown: VictoriaLogsSupport = {
  version: '',
  versionKnown: false,
  minVersion: 'v1.54.0',
  supported: false,
  reason: 'VictoriaLogs version is unknown: request error',
};

const datasource = (getResource: jest.Mock) => ({ getResource });

describe('VictoriaLogsSupportCache', () => {
  it('asks the backend resource once per datasource instance', async () => {
    const cache = new VictoriaLogsSupportCache();
    const getResource = jest.fn().mockResolvedValue(supported);
    const a = datasource(getResource);

    await expect(cache.get(a)).resolves.toEqual(supported);
    await expect(cache.get(a)).resolves.toEqual(supported);
    // the instance Grafana creates after the data source is saved with other settings is asked anew
    await cache.get(datasource(getResource));

    expect(getResource).toHaveBeenCalledTimes(2);
    expect(getResource).toHaveBeenCalledWith('victorialogs/support');
  });

  it('reports a failed call as an unknown, unsupported version and asks again next time', async () => {
    const cache = new VictoriaLogsSupportCache();
    const getResource = jest.fn().mockRejectedValueOnce(new Error('plugin unavailable')).mockResolvedValueOnce(supported);
    const a = datasource(getResource);

    await expect(cache.get(a)).resolves.toEqual({
      version: '',
      versionKnown: false,
      minVersion: '',
      supported: false,
      reason: 'plugin unavailable',
    });
    await expect(cache.get(a)).resolves.toEqual(supported);
    expect(getResource).toHaveBeenCalledTimes(2);
  });

  it('asks again after an answer with an unknown version, since VictoriaLogs may be back', async () => {
    const cache = new VictoriaLogsSupportCache();
    const getResource = jest.fn().mockResolvedValueOnce(unknown).mockResolvedValueOnce(supported);
    const a = datasource(getResource);

    await expect(cache.get(a)).resolves.toEqual(unknown);
    await expect(cache.get(a)).resolves.toEqual(supported);
    await expect(cache.get(a)).resolves.toEqual(supported);
    expect(getResource).toHaveBeenCalledTimes(2);
  });
});

describe('describeError', () => {
  it('reads an Error, a Grafana FetchError and anything else', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
    expect(describeError({ status: 500, statusText: 'Internal Server Error', data: { message: 'Error loading datasource' } })).toBe(
      'Error loading datasource'
    );
    expect(describeError({ status: 502, statusText: 'Bad Gateway', data: {} })).toBe('Bad Gateway');
    expect(describeError({ status: 0, data: {} })).toBe('unknown error');
    expect(describeError('nope')).toBe('nope');
  });
});
