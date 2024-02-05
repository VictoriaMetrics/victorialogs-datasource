// Copyright (c) 2022 Grafana Labs
// Modifications Copyright (c) 2022 VictoriaMetrics
// 2022-10-04: remove onChange method
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

import { HistoryItem } from '@grafana/data';

import type PromQlLanguageProvider from '../../language_provider';
import { PromQuery } from '../../types';

// we need to store this in a separate file,
// because we have an async-wrapper around,
// the react-component, and it needs the same
// props as the sync-component.
export type Props = {
  initialValue: string;
  languageProvider: PromQlLanguageProvider;
  history: Array<HistoryItem<PromQuery>>;
  placeholder: string;
  readOnly?: boolean;
  onRunQuery: (value: string) => void;
  onBlur: (value: string) => void;
};
