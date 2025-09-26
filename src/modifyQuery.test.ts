import { addLabelToQuery, removeLabelFromQuery } from './modifyQuery';

describe('modifyQuery', () => {
  describe('addLabelToQuery', () => {
    it('should add a label to the query with the specified operator', () => {
      const query = 'foo: bar';
      const key = 'baz';
      const value = 'qux';
      const operator = '=';
      const result = addLabelToQuery(query, { key, value, operator });
      expect(result).toBe('foo:bar baz:=qux');
    });

    it('should add a label to the query and retain pipes', () => {
      const query = 'foo:bar | block_stats | top 5 by (_msg)';
      const key = 'baz';
      const value = 'qux';
      const operator = '=';
      const result = addLabelToQuery(query, { key, value, operator });
      expect(result).toBe('foo:bar | block_stats | top 5 by (_msg) | baz:=qux');
    });

    it('should add ":" "!:" for stream key', () => {
      const query = 'foo:bar | block_stats | top 5 by (_msg)';
      const key = '_stream';
      const value = '{event: "test"}';
      expect(addLabelToQuery(query, { key, value, operator: '=' })).toBe('foo:bar | block_stats | top 5 by (_msg) | {event: "test"}');
      expect(addLabelToQuery(query, { key, value, operator: '!=' })).toBe('foo:bar | block_stats | top 5 by (_msg) | NOT {event: "test"}');
    });

    it('should add ":" "!:" for _stream_id key', () => {
      const query = 'foo:bar | block_stats | top 5 by (_msg)';
      const key = '_stream_id';
      const value = 'stream123';
      expect(addLabelToQuery(query, { key, value, operator: '=' })).toBe('foo:bar | block_stats | top 5 by (_msg) | _stream_id:stream123');
      expect(addLabelToQuery(query, { key, value, operator: '!=' })).toBe('foo:bar | block_stats | top 5 by (_msg) | NOT _stream_id:stream123');
    });

    it('should add "=|" group', () => {
      const query = 'foo: bar';
      const result = addLabelToQuery(query, { key: 'baz', value: '', values: ['qux', 'quux'], operator: '=|' });
      expect(result).toBe('foo:bar baz:in(qux,quux)');
    });

    it('should add "!=|" group', () => {
      const query = 'foo: bar';
      const result = addLabelToQuery(query, { key: 'baz', value: '', values: ['qux', 'quux'], operator: '!=|' });
      expect(result).toBe('foo:bar  NOT baz:in(qux,quux)');
    });
  });

  describe('removeLabelFromQuery', () => {
    it('should remove a label from the query', () => {
      const query = 'foo:bar AND baz:="qux"';
      const key = 'baz';
      const value = 'qux';
      const result = removeLabelFromQuery(query, key, value);
      expect(result).toBe('foo:bar');
    });

    it('should remove a label from the query and retain pipes', () => {
      const query = 'foo:bar AND baz:="qux" | block_stats | top 5 by (_msg)';
      const key = 'baz';
      const value = 'qux';
      const result = removeLabelFromQuery(query, key, value);
      expect(result).toBe('foo:bar | block_stats | top 5 by (_msg)');
    });

    it('should handle nested filters correctly', () => {
      const query = 'foo:bar AND (baz:="qux" OR quux:"corge")';
      const key = 'baz';
      const value = 'qux';
      const result = removeLabelFromQuery(query, key, value);
      expect(result).toBe('foo:bar AND (quux:corge)');
    });
  });
});
