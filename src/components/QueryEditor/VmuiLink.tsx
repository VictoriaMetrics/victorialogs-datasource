// Copyright (c) 2022 Grafana Labs
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import React, { FC, memo, useEffect, useMemo, useState } from 'react';

import { getDefaultTimeRange, PanelData, textUtil } from '@grafana/data';
import { IconButton } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../datasource';
import { Query } from '../../types';
import { getDurationFromMilliseconds } from '../../utils/timeUtils';

const getTimeUrlParams = (panelData?: PanelData) => {
  const timeRange = panelData?.timeRange || getDefaultTimeRange();
  const rangeRaw = timeRange.raw;
  let relativeTimeId = 'none';

  if (typeof rangeRaw?.from === 'string') {
    const duration = rangeRaw.from.replace('now-', '');
    relativeTimeId = relativeTimeOptionsVMUI.find(ops => ops.duration === duration)?.id || 'none';
  }

  const start = timeRange.from.valueOf() / 1000;
  const end = timeRange.to.valueOf() / 1000;
  const rangeDiff = Math.ceil(end - start);
  const endTime = timeRange.to.utc().format('YYYY-MM-DD HH:mm');

  return {
    'g0.range_input': getDurationFromMilliseconds(rangeDiff * 1000),
    'g0.end_input': endTime,
    'g0.relative_time': relativeTimeId,
  };
};

const getQueryWithTemplate = (datasource: VictoriaLogsDatasource, query: Query, panelData?: PanelData,) => {
  const scopedVars = panelData?.request?.scopedVars || {};
  let expr = query.expr;
  expr = datasource.getExtraFilters(panelData?.request?.filters, expr) ?? expr;
  expr = datasource.interpolateString(expr, scopedVars);

  const streamExpr = datasource.getExtraStreamFilters(query.streamFilters, scopedVars);
  return `${streamExpr} | ${expr}`;
};

interface Props {
  datasource: VictoriaLogsDatasource;
  query: Query;
  panelData?: PanelData;
}

export const relativeTimeOptionsVMUI = [
  { title: 'Last 5 minutes', duration: '5m' },
  { title: 'Last 15 minutes', duration: '15m' },
  { title: 'Last 30 minutes', duration: '30m' },
  { title: 'Last 1 hour', duration: '1h' },
  { title: 'Last 3 hours', duration: '3h' },
  { title: 'Last 6 hours', duration: '6h' },
  { title: 'Last 12 hours', duration: '12h' },
  { title: 'Last 24 hours', duration: '24h' },
  { title: 'Last 2 days', duration: '2d' },
  { title: 'Last 7 days', duration: '7d' },
  { title: 'Last 30 days', duration: '30d' },
  { title: 'Last 90 days', duration: '90d' },
  { title: 'Last 180 days', duration: '180d' },
  { title: 'Last 1 year', duration: '1y' },
  { title: 'Yesterday', duration: '1d' },
  { title: 'Today', duration: '1d' },
].map(o => ({
  id: o.title.replace(/\s/g, '_').toLocaleLowerCase(),
  ...o
}));

type Tenant = {
  projectID: string;
  accountID: string;
}

const DEFAULT_TENANT: Tenant = {
  projectID: '0',
  accountID: '0',
};

const VmuiLink: FC<Props> = ({
  panelData,
  query,
  datasource,
}) => {
  const [baseVmuiUrl, setBaseVmuiUrl] = useState('');
  const [tenant, setTenant] = useState<Tenant>(DEFAULT_TENANT);

  useEffect(() => {
    if (!datasource) {
      return;
    }

    const fetchVmuiUrl = async () => {
      try {
        const resp = await datasource.getResource<Tenant & { vmuiURL: string }>('vmui');
        setBaseVmuiUrl(resp.vmuiURL.includes('#') ? resp.vmuiURL.split('/#')[0] : resp.vmuiURL);
        setTenant({ projectID: resp.projectID, accountID: resp.accountID });
      } catch (error) {
        console.error('Error fetching VMUI URL:', error);
      }
    };

    fetchVmuiUrl();
  }, [datasource]);

  const href = useMemo(() => {
    const timeParams = getTimeUrlParams(panelData);
    const queryExpr = getQueryWithTemplate(datasource, query, panelData);

    return `${baseVmuiUrl}/#/?` + new URLSearchParams({
      ...timeParams,
      ...tenant,
      query: queryExpr,
      tab: '0',
    }).toString();
  }, [baseVmuiUrl, datasource, panelData, query, tenant]);

  return (
    <a
      href={textUtil.sanitizeUrl(href)}
      target='_blank'
      rel='noopener noreferrer'
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <IconButton
        key='vmui'
        name='external-link-alt'
        tooltip='Run in vmui'
      />
    </a>
  );
};

export default memo(VmuiLink);
