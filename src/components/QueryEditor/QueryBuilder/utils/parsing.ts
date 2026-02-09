import { VisualQuery } from '../../../../types';

export const BUILDER_OPERATORS = ['OR', 'AND'];

export const isEmptyQuery = (query: VisualQuery) => {
  return query.filters.values?.length === 0 && query.pipes.length === 0;
};
