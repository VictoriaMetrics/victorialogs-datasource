import React, { memo } from 'react';

import { CoreApp } from '@grafana/data';

import { VictoriaLogsQueryEditorProps } from '../../types';

import QueryEditor from './QueryEditor';
import QueryEditorForAlerting from './QueryEditorForAlerting';

const QueryEditorByApp = (props: VictoriaLogsQueryEditorProps) => {
  const { app } = props;

  switch (app) {
    case CoreApp.CloudAlerting:
      return <QueryEditorForAlerting {...props} />;
    default:
      return <QueryEditor {...props} />;
  }
};

export default memo(QueryEditorByApp);
