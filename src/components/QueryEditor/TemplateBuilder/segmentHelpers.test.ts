import { text, placeholder } from './segmentHelpers';

describe('segmentHelpers', () => {
  describe('text', () => {
    it('creates a TextSegment', () => {
      expect(text(':')).toEqual({ type: 'text', value: ':' });
    });
  });

  describe('placeholder', () => {
    it('creates a PlaceholderSegment with defaults', () => {
      const seg = placeholder('f1', {
        role: 'fieldName',
        displayHint: 'field_name',
        optionSource: 'fieldNames',
      });
      expect(seg).toEqual({
        type: 'placeholder',
        id: 'f1',
        role: 'fieldName',
        value: null,
        displayHint: 'field_name',
        optionSource: 'fieldNames',
        multi: undefined,
        multiValues: undefined,
        dependsOn: undefined,
        staticOptions: undefined,
      });
    });

    it('creates multi placeholder', () => {
      const seg = placeholder('vals', {
        role: 'fieldValue',
        displayHint: 'values',
        optionSource: 'fieldValues',
        multi: true,
        dependsOn: 'f1',
      });
      expect(seg.multi).toBe(true);
      expect(seg.dependsOn).toBe('f1');
    });
  });
});
