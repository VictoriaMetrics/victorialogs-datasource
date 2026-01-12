import { CoreApp } from "@grafana/data";

import { addLabelToQuery, addSortPipeToQuery, removeLabelFromQuery } from './modifyQuery';
import store from "./store/store";
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

      it('should add sort even if query has sort by other field', () => {
        const query = {
          expr: 'foo: bar | sort by (level) asc',
          queryType: QueryType.Instant,
          direction: 'desc'
        } as Query;
        const result = addSortPipeToQuery(query, CoreApp.Dashboard);
        expect(result).toBe('foo: bar | sort by (level) asc | sort by (_time) desc');
      });
    });
  });
});
