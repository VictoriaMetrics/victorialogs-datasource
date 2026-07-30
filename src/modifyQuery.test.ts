import { CoreApp } from '@grafana/data';

import { addLabelToQuery, addSortPipeToQuery, insertPipesBeforeSortClassPipe, removeLabelFromQuery } from './modifyQuery';
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

  describe('addSortPipeToExpr', () => {
    describe('Dashboard and PanelEditor contexts', () => {
      it('should add a sort pipe with asc direction when direction is "asc"', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | sort by (_time) asc');
      });

      it('should add a sort pipe with desc direction when direction is "desc"', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant,
          direction: 'desc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | sort by (_time) desc');
      });

      it('should default to desc when direction is undefined', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | sort by (_time) desc');
      });

      it('should work in PanelEditor context', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.PanelEditor);
        expect(result).toBe('foo: bar | sort by (_time) asc');
      });
    });

    describe('Explore context', () => {
      it('should add a sort pipe with asc direction when store has Ascending order', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant
        } as Query;
        // Mock store to return Ascending
        jest.spyOn(store, 'get').mockReturnValue('Ascending');
        const result = addSortPipeToQuery(query, CoreApp.Explore);
        expect(result).toBe('foo: bar | sort by (_time) asc');
      });

      it('should add a sort pipe with desc direction when store has Descending order', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant
        } as Query;
        // Mock store to return Descending
        jest.spyOn(store, 'get').mockReturnValue('Descending');
        const result = addSortPipeToQuery(query, CoreApp.Explore);
        expect(result).toBe('foo: bar | sort by (_time) desc');
      });
    });

    describe('Existing sort pipes detection', () => {
      it('should not duplicate the sort pipe if expr already contains "sort by (_time)"', () => {
        const query = {
          expr: 'foo: bar | sort by (_time) asc',
          queryType: QueryType.Instant
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | sort by (_time) asc');
      });

      it('should not duplicate the sort pipe if expr contains "order by (_time)"', () => {
        const query = {
          expr: 'foo: bar | order by (_time) desc',
          queryType: QueryType.Instant
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | order by (_time) desc');
      });

      it('should detect sort with spaces around pipe and keywords', () => {
        const query = {
          expr: 'foo: bar |  sort  by  (_time)  asc',
          queryType: QueryType.Instant
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar |  sort  by  (_time)  asc');
      });

      it('should detect sort case-insensitively', () => {
        const query = {
          expr: 'foo: bar | SORT BY (_time) asc',
          queryType: QueryType.Instant
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | SORT BY (_time) asc');
      });

      it('should detect order case-insensitively', () => {
        const query = {
          expr: 'foo: bar | ORDER BY (_time) desc',
          queryType: QueryType.Instant
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | ORDER BY (_time) desc');
      });
    });

    describe('Query type restrictions', () => {
      it('should not add a sort pipe if query type is Stats', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Stats,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar');
      });

      it('should not add a sort pipe if query type is StatsRange', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.StatsRange,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar');
      });

      it('should not add a sort pipe if query type is Hits', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Hits,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar');
      });
    });

    describe('Live streaming mode', () => {
      it('should not add a sort pipe when isLiveStreaming is true', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard, true);
        expect(result).toBe('foo: bar');
      });

      it('should not add a sort pipe in Explore with live streaming', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant
        } as Query;
        jest.spyOn(store, 'get').mockReturnValue('Ascending');
        const result = addSortPipeToQuery(query, CoreApp.Explore, true);
        expect(result).toBe('foo: bar');
      });
    });

    describe('Unknown app context', () => {
      it('should not add a sort pipe when app context is unknown', () => {
        const query = {
          expr: 'foo: bar',
          queryType: QueryType.Instant,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, 'unknown-app');
        expect(result).toBe('foo: bar');
      });
    });

    describe('Complex queries', () => {
      it('should add sort pipe to query with existing pipes', () => {
        const query = {
          expr: 'foo: bar | stats count() by level',
          queryType: QueryType.Instant,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | stats count() by level | sort by (_time) asc');
      });

      it('should not add sort if _time sorting already exists in complex query', () => {
        const query = {
          expr: 'foo: bar | stats count() | sort by (_time) desc',
          queryType: QueryType.Instant,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | stats count() | sort by (_time) desc');
      });

      it('should not add sort if _time sorting already as part of sort pipe', () => {
        const query = {
          expr: 'foo: bar | stats count() | sort by (_stream, _time) desc',
          queryType: QueryType.Instant,
          direction: 'asc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | stats count() | sort by (_stream, _time) desc');
      });

      it('should NOT add sort if query already has sort by other field', () => {
        const query = {
          expr: 'foo: bar | sort by (level) asc',
          queryType: QueryType.Instant,
          direction: 'desc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | sort by (level) asc');
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
});
