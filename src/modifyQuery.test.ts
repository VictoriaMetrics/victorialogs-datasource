import { CoreApp } from '@grafana/data';

import {
  addLabelToQuery,
  getSortDirection,
  insertPipesBeforeSortClassPipe,
  removeAggregationPipes,
  removeLabelFromQuery,
} from './modifyQuery';
import store from './store/store';
import { Query, QueryType } from './types';

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
      expect(addLabelToQuery(query, {
        key,
        value,
        operator: '='
      })).toBe('foo: bar AND _stream:{event: "test"} | pipe1 | pipe2');
      expect(addLabelToQuery(query, {
        key,
        value,
        operator: '!='
      })).toBe('foo: bar AND (! _stream: {event: "test"}) | pipe1 | pipe2');
    });

    it('should add ":" "!:" for _stream_id key', () => {
      const query = 'foo: bar | pipe1 | pipe2';
      const key = '_stream_id';
      const value = 'stream123';
      expect(addLabelToQuery(query, {
        key,
        value,
        operator: '='
      })).toBe('foo: bar AND _stream_id:stream123 | pipe1 | pipe2');
      expect(addLabelToQuery(query, {
        key,
        value,
        operator: '!='
      })).toBe('foo: bar AND (! _stream_id: stream123) | pipe1 | pipe2');
    });

    it('should add "=|" group', () => {
      const query = 'foo: bar';
      const result = addLabelToQuery(query, { key: 'baz', value: '', values: ['qux', 'quux'], operator: '=|' });
      expect(result).toBe('foo: bar AND baz:in("qux","quux")');
    });

    it('should add "!=|" group', () => {
      const query = 'foo: bar';
      const result = addLabelToQuery(query, { key: 'baz', value: '', values: ['qux', 'quux'], operator: '!=|' });
      expect(result).toBe('foo: bar AND !baz:in("qux","quux")');
    });

    it('escapes quotes and backslashes in exact filter values', () => {
      expect(addLabelToQuery('', { key: 'foo', operator: '=', value: 'a"b\\c' })).toBe('foo:="a\\"b\\\\c"');
    });

    it('escapes regex filter values so VictoriaLogs unquoting restores the pattern', () => {
      expect(addLabelToQuery('', { key: 'foo', operator: '=~', value: 'a"b.*' })).toBe('foo:~"a\\"b.*"');
      expect(addLabelToQuery('', { key: 'foo', operator: '=~', value: '\\d+' })).toBe('foo:~"\\\\d+"');
    });

    it('escapes values of multi-value groups', () => {
      expect(addLabelToQuery('', { key: 'foo', operator: '=|', value: 'a"b', values: ['a"b', 'x'] })).toBe(
        'foo:in("a\\"b","x")'
      );
    });

    it('should quote label name containing colons(:) with double quotes', () => {
      const query = 'foo: bar';
      const result = addLabelToQuery(query, { key: 'span:attr_id', value: 'abc', operator: '!=|' });
      expect(result).toBe('foo: bar AND !\"span:attr_id\":in()');
    });
    it('should not quote label name containing colons(:) with double quotes if key is already quoted', () => {
      const query = 'foo: bar';
      const result = addLabelToQuery(query, { key: '"span:attr_id"', value: 'abc', operator: '!=|' });
      expect(result).toBe('foo: bar AND !\"span:attr_id\":in()');
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

  describe('getSortDirection', () => {
    const instant = (overrides: Partial<Query> = {}): Query =>
      ({ expr: 'foo: bar', queryType: QueryType.Instant, ...overrides }) as Query;

    describe('Dashboard and PanelEditor contexts', () => {
      it('takes the direction of the query', () => {
        expect(getSortDirection(instant({ direction: 'asc' }), CoreApp.Dashboard)).toBe('asc');
        expect(getSortDirection(instant({ direction: 'desc' }), CoreApp.Dashboard)).toBe('desc');
        expect(getSortDirection(instant({ direction: 'asc' }), CoreApp.PanelEditor)).toBe('asc');
      });

      it('defaults to desc when the query has no direction', () => {
        expect(getSortDirection(instant(), CoreApp.Dashboard)).toBe('desc');
      });
    });

    describe('Explore context', () => {
      it('follows the logs sort order of Explore', () => {
        jest.spyOn(store, 'get').mockReturnValue('Ascending');
        expect(getSortDirection(instant({ direction: 'desc' }), CoreApp.Explore)).toBe('asc');
        jest.spyOn(store, 'get').mockReturnValue('Descending');
        expect(getSortDirection(instant(), CoreApp.Explore)).toBe('desc');
      });
    });

    // VictoriaLogs ignores sort_direction itself when the query sorts, limits or aggregates its rows
    it('gives the direction whatever the pipes of the query', () => {
      expect(getSortDirection(instant({ expr: 'foo: bar | sort by (_time) desc', direction: 'asc' }), CoreApp.Dashboard)).toBe('asc');
      expect(getSortDirection(instant({ expr: 'foo: bar | stats count() by level', direction: 'asc' }), CoreApp.Dashboard)).toBe('asc');
    });

    describe('Query type restrictions', () => {
      it.each([QueryType.Stats, QueryType.StatsRange, QueryType.Hits])('gives none for the %s query type', (queryType) => {
        expect(getSortDirection(instant({ queryType, direction: 'asc' }), CoreApp.Dashboard)).toBeUndefined();
      });
    });

    describe('Live streaming mode', () => {
      it('gives none for a live stream', () => {
        jest.spyOn(store, 'get').mockReturnValue('Ascending');
        expect(getSortDirection(instant({ direction: 'asc' }), CoreApp.Dashboard, true)).toBeUndefined();
        expect(getSortDirection(instant(), CoreApp.Explore, true)).toBeUndefined();
      });
    });

    describe('Unknown app context', () => {
      it('gives none outside Explore and dashboards', () => {
        expect(getSortDirection(instant({ direction: 'asc' }), 'unknown-app')).toBeUndefined();
        expect(getSortDirection(instant({ direction: 'asc' }), CoreApp.Unknown)).toBeUndefined();
      });
    });
  });

  describe('insertPipesBeforeSortClassPipe', () => {
    const PIPES = ' | format "" as lvl';

    it('appends at the end when the expression has no pipes', () => {
      expect(insertPipesBeforeSortClassPipe('app:x', PIPES)).toBe('app:x | format "" as lvl');
    });

    it('appends at the end when there are no sort-class pipes', () => {
      expect(insertPipesBeforeSortClassPipe('app:x | unpack_json | fields _msg', PIPES)).toBe(
        'app:x | unpack_json | fields _msg | format "" as lvl'
      );
    });

    it('inserts before a trailing sort pipe', () => {
      expect(insertPipesBeforeSortClassPipe('app:x | sort by (_time) desc', PIPES)).toBe(
        'app:x | format "" as lvl | sort by (_time) desc'
      );
    });

    it('inserts before the first sort-class pipe, keeping the tail intact', () => {
      expect(insertPipesBeforeSortClassPipe('app:x | sort by (_time) desc | limit 10 | pack_json', PIPES)).toBe(
        'app:x | format "" as lvl | sort by (_time) desc | limit 10 | pack_json'
      );
    });

    it('inserts after field-transforming pipes the level rules may reference', () => {
      expect(insertPipesBeforeSortClassPipe('app:x | unpack_json | sort by (_time) desc', PIPES)).toBe(
        'app:x | unpack_json | format "" as lvl | sort by (_time) desc'
      );
    });

    it.each(['limit 10', 'head 10', 'offset 5', 'skip 5', 'first 10 by (_time)', 'last 10 by (_time)', 'order by (_time) desc'])(
      'treats `%s` as a sort-class pipe',
      (pipe) => {
        expect(insertPipesBeforeSortClassPipe(`app:x | ${pipe}`, PIPES)).toBe(`app:x | format "" as lvl | ${pipe}`);
      }
    );

    it('matches sort-class pipe keywords case-insensitively', () => {
      expect(insertPipesBeforeSortClassPipe('app:x | SORT BY (_time) DESC', PIPES)).toBe(
        'app:x | format "" as lvl | SORT BY (_time) DESC'
      );
    });

    it('does not treat pipes whose name merely starts with a keyword as sort-class', () => {
      expect(insertPipesBeforeSortClassPipe('app:x | sort_values', PIPES)).toBe(
        'app:x | sort_values | format "" as lvl'
      );
    });

    it('ignores sort keywords inside quoted values', () => {
      expect(insertPipesBeforeSortClassPipe('_msg:"error | sort by (x)"', PIPES)).toBe(
        '_msg:"error | sort by (x)" | format "" as lvl'
      );
      expect(insertPipesBeforeSortClassPipe('app:x | filter _msg:"a | order by"', PIPES)).toBe(
        'app:x | filter _msg:"a | order by" | format "" as lvl'
      );
    });

    it('inserts before a sort pipe following a quoted value containing a pipe', () => {
      expect(insertPipesBeforeSortClassPipe('_msg:"a|b" | sort by (_time) desc', PIPES)).toBe(
        '_msg:"a|b" | format "" as lvl | sort by (_time) desc'
      );
    });
  });

  describe('removeAggregationPipes', () => {
    it('returns the expression unchanged when it has no pipes', () => {
      expect(removeAggregationPipes('app:x level:=error')).toBe('app:x level:=error');
    });

    it('returns the expression unchanged when it has no aggregation pipe', () => {
      expect(removeAggregationPipes('app:x | unpack_json | sort by (_time) desc')).toBe(
        'app:x | unpack_json | sort by (_time) desc'
      );
    });

    it('cuts at the stats pipe, keeping the pipes before it', () => {
      expect(removeAggregationPipes('{app="a"} level:=error | unpack_json | stats by (loggerName) count() logs')).toBe(
        '{app="a"} level:=error | unpack_json'
      );
    });

    it('drops the pipes following the stats pipe too', () => {
      expect(removeAggregationPipes('app:x | stats by (host) count() hits | sort by (hits) desc | limit 5')).toBe('app:x');
    });

    it.each([
      'top 5 by (host)',
      'uniq by (host)',
      'facets',
      'field_names',
      'field_values host',
      'block_stats',
      'blocks_count',
      'query_stats',
      'generate_sequence 10',
    ])(
      'treats `%s` as an aggregation pipe',
      (pipe) => {
        expect(removeAggregationPipes(`app:x | unpack_json | ${pipe}`)).toBe('app:x | unpack_json');
      }
    );

    it.each([
      'by (host) count() hits',
      'by(host) count()',
      'count() logs',
      'count_uniq(host)',
      'sum(duration) total',
      'any(host)',
      'stddev(duration)',
      'field_max(duration, host)',
    ])(
      'treats the stats shorthand `%s` as an aggregation pipe',
      (pipe) => {
        expect(removeAggregationPipes(`app:x | ${pipe}`)).toBe('app:x');
      }
    );

    it('does not treat pipes whose name merely starts with a keyword as aggregation', () => {
      expect(removeAggregationPipes('app:x | total_stats count() total | uniq_values')).toBe(
        'app:x | total_stats count() total | uniq_values'
      );
    });

    it('ignores aggregation keywords inside quoted values', () => {
      expect(removeAggregationPipes('_msg:"a | stats count()" | unpack_json')).toBe('_msg:"a | stats count()" | unpack_json');
    });
  });
});
