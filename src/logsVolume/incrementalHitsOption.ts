import { Query } from '../types';

/** Incremental hits loading is on unless the query switched it off explicitly; the default is not stored in the query */
export const isIncrementalHitsLoadingEnabled = (query: Query): boolean => query.incrementalHitsLoading !== false;
