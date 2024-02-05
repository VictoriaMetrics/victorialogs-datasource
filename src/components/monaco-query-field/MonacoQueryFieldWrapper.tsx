// Copyright (c) 2022 Grafana Labs
// Modifications Copyright (c) 2022 VictoriaMetrics
// 2022-10-04: remove handleChange function
// A detailed history of changes can be seen here - https://github.com/VictoriaMetrics/grafana-datasource
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

import React, { useRef } from 'react';

import { MonacoQueryFieldLazy } from './MonacoQueryFieldLazy';
import { Props as MonacoProps } from './MonacoQueryFieldProps';

type Props = Omit<MonacoProps, 'onRunQuery' | 'onBlur'> & {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  runQueryOnBlur: boolean;
};

export const MonacoQueryFieldWrapper = (props: Props) => {
  const lastRunValueRef = useRef<string | null>(null);
  const { runQueryOnBlur, onRunQuery, onChange, ...rest } = props;

  const handleRunQuery = (value: string) => {
    lastRunValueRef.current = value;
    onChange(value);
    onRunQuery();
  };

  const handleBlur = (value: string) => {
    if (runQueryOnBlur) {
      // run handleRunQuery only if the current value is different from the last-time-executed value
      if (value !== lastRunValueRef.current) {
        handleRunQuery(value);
      }
    } else {
      onChange(value);
    }
  };

  return <MonacoQueryFieldLazy onRunQuery={handleRunQuery} onBlur={handleBlur} {...rest} />;
};
