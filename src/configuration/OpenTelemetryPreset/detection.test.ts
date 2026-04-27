import { FilterFieldType } from '../../types';

import { runDetection } from './detection';
import { OpenTelemetryPresetDetection } from './types';

interface FakeDs {
  languageProvider: { getFieldList: jest.Mock };
}

const mkDs = (names: string[], values: string[] = []): FakeDs => {
  const nameHits = names.map(v => ({ value: v, hits: 0 }));
  const valueHits = values.map(v => ({ value: v, hits: 0 }));
  return {
    languageProvider: {
      getFieldList: jest.fn().mockImplementation(({ type }: { type: FilterFieldType }) =>
        Promise.resolve(type === FilterFieldType.FieldName ? nameHits : valueHits)
      ),
    },
  };
};

describe('runDetection', () => {
  it('detects trace_id field and severity_text from real data', async () => {
    const ds = mkDs(['_msg', 'trace_id', 'severity_text']);
    const [out] = await runDetection(ds as any);
    expect(out.traceIdField).toBe('trace_id');
    expect(out.severity).toEqual({
      field: 'severity_text',
      valueCase: 'string',
      source: 'auto',
    });
  });

  it('detects camelCase + SeverityText when snake is absent', async () => {
    const ds = mkDs(
      ['_msg', 'traceId', 'spanId', 'SeverityText'],
      ['ERROR', 'INFO'],
    );
    const [out] = await runDetection(ds as any);
    expect(out.traceIdField).toBe('traceId');
    expect(out.severity?.field).toBe('SeverityText');
  });

  it('returns severity undefined when no candidate field is present', async () => {
    const ds = mkDs(['_msg', 'trace_id']);
    const [out] = await runDetection(ds as any);
    expect(out.severity).toBeUndefined();
    expect(ds.languageProvider.getFieldList).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: FilterFieldType.FieldValue }),
    );
  });

  it('falls back to default preset when field_names is empty', async () => {
    const ds = mkDs([]);
    const [out] = await runDetection(ds as any);
    expect(out).toEqual<OpenTelemetryPresetDetection>({
      traceIdField: 'trace_id',
      severity: {
        field: 'severity_number',
        source: 'auto',
        valueCase: 'number',
      },
    });
  });

  it('accepts an explicit severity field (manual source)', async () => {
    const ds = mkDs(['log.level', 'trace_id']);
    const [out] = await runDetection(ds as any, { severityField: 'log.level' });
    expect(out.severity).toEqual({
      field: 'log.level',
      valueCase: 'string',
      source: 'manual',
    });
  });

  it('propagates errors from getFieldList', async () => {
    const ds = mkDs([]);
    ds.languageProvider.getFieldList.mockRejectedValue(new Error('net'));
    await expect(runDetection(ds as any)).rejects.toThrow('net');
  });

  it('exposes the list of field_names via the second return value', async () => {
    const ds = mkDs(['trace_id', 'span_id', 'severity_text', '_msg']);
    const [, names] = await runDetection(ds as any);
    expect(names).toEqual(['trace_id', 'span_id', 'severity_text', '_msg']);
  });
});
