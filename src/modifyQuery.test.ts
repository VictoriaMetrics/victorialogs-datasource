import { addLabelToQuery, addSortPipeToQuery, logsSortOrders, removeLabelFromQuery } from './modifyQuery';
import { Query, QueryType } from "./types";

describe('modifyQuery', () => {
  describe('addLabelToQuery', () => {
    it('should add a label to the query with the specified operator', () => {
      const query = 'foo: bar';
      const key = 'baz';
      const value = 'qux';
      const operator = '=';
      const result = addLabelToQuery(query, { key, value, operator });
      expect(result).toBe('foo: bar AND baz:="qux"');
    });

    it('should add a label to the query and retain pipes', () => {
      const query = 'foo: bar | pipe1 | pipe2';
      const key = 'baz';
      const value = 'qux';
      const operator = '=';
      const result = addLabelToQuery(query, { key, value, operator });
      expect(result).toBe('foo: bar AND baz:="qux" | pipe1 | pipe2');
    });

    it('should add ":" "!:" for stream key', () => {
      const query = 'foo: bar | pipe1 | pipe2';
      const key = '_stream';
      const value = '{event: "test"}';
      expect(addLabelToQuery(query, { key, value, operator: '=' })).toBe('foo: bar AND _stream:{event: "test"} | pipe1 | pipe2');
      expect(addLabelToQuery(query, { key, value, operator: '!=' })).toBe('foo: bar AND (! _stream: {event: "test"}) | pipe1 | pipe2');
    });

    it('should add ":" "!:" for _stream_id key', () => {
      const query = 'foo: bar | pipe1 | pipe2';
      const key = '_stream_id';
      const value = 'stream123';
      expect(addLabelToQuery(query, { key, value, operator: '=' })).toBe('foo: bar AND _stream_id:stream123 | pipe1 | pipe2');
      expect(addLabelToQuery(query, { key, value, operator: '!=' })).toBe('foo: bar AND (! _stream_id: stream123) | pipe1 | pipe2');
    });

    it('should add "=|" group', () => {
      const query = 'foo: bar';
      const result = addLabelToQuery(query, { key: 'baz', value: '', values: ['qux', 'quux'], operator: '=|' });
      expect(result).toBe('foo: bar AND baz:in("qux","quux")');
    });

    it('should add "!=|" group', () => {
      const query = 'foo: bar';
      const result = addLabelToQuery(query, { key: 'baz', value: '', values: ['qux', 'quux'], operator: '!=|' });
      expect(result).toBe('foo: bar AND !(baz:in("qux","quux"))');
    });
  });

  describe('removeLabelFromQuery', () => {
    it('should remove a label from the query', () => {
      const query = 'foo: bar AND baz:="qux"';
      const key = 'baz';
      const value = 'qux';
      const result = removeLabelFromQuery(query, key, value);
      expect(result).toBe('foo: bar');
    });

    it('should remove a label from the query and retain pipes', () => {
      const query = 'foo: bar AND baz:="qux" | pipe1 | pipe2';
      const key = 'baz';
      const value = 'qux';
      const result = removeLabelFromQuery(query, key, value);
      expect(result).toBe('foo: bar | pipe1 | pipe2');
    });

    it('should handle nested filters correctly', () => {
      const query = 'foo: bar AND (baz:="qux" OR quux:"corge")';
      const key = 'baz';
      const value = 'qux';
      const result = removeLabelFromQuery(query, key, value);
      expect(result).toBe('foo: bar AND (quux:"corge")');
    });
  });

  describe('addSortPipeToExpr', () => {
    it('should add a sort pipe if sortDirection equals logsSortOrders.asc', () => {
      const query = {
        expr: 'foo: bar',
        queryType: QueryType.Instant
      } as Query;
      const sortDirection = logsSortOrders.asc;
      const result = addSortPipeToQuery(query, sortDirection);
      expect(result).toBe('foo: bar | sort by (_time) asc');
    });

    it('should add a sort pipe if sortDirection equals logsSortOrders.desc', () => {
      const query = {
        expr: 'foo: bar',
        queryType: QueryType.Instant
      } as Query;
      const sortDirection = logsSortOrders.desc;
      const result = addSortPipeToQuery(query, sortDirection);
      expect(result).toBe('foo: bar | sort by (_time) desc');
    });

    it('should not duplicate the sort pipe if expr already contains "sort by"', () => {
      const query = {
        expr: 'foo: bar | sort by (_time) asc',
        queryType: QueryType.Instant
      } as Query;
      const sortDirection = logsSortOrders.asc;
      const result = addSortPipeToQuery(query, sortDirection);
      expect(result).toBe('foo: bar | sort by (_time) asc');
    });

    it('should not add a sort pipe if query type does not equal QueryType.Instant', () => {
      const query = {
        expr: 'foo: bar',
        queryType: QueryType.Stats
      } as Query;
      const sortDirection = logsSortOrders.asc;
      const result = addSortPipeToQuery(query, sortDirection);
      expect(result).toBe('foo: bar');
    });
  });
});
