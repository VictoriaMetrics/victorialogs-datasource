import React from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { RowSerializeResult } from '../serialization/types';
import { PipelineStepItem, PipelineStepPatch } from '../types';

export interface RowContentProps<TRow> {
  row: TRow;
  onChange: (updatedRow: TRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext?: string;
}

export interface RowContainerProps<TRow> {
  row: TRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: TRow) => void;
  onDelete: () => void;
  queryContext?: string;
}

export interface StepContentProps {
  step: PipelineStepItem;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
  onDeleteStep: (id: string) => void;
  steps: PipelineStepItem[];
  stepIndex: number;
}

export interface BaseTypeDefinition<TRow, TRowContentProps = RowContentProps<TRow>> {
  label: string;
  description: string;
  ContentComponent: React.FC<TRowContentProps>;
  serialize: (row: TRow, stepId: string) => RowSerializeResult;
  createInitialRow: () => Partial<TRow>;
}
