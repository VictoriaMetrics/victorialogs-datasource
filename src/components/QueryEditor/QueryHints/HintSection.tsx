import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Collapse, useStyles2 } from '@grafana/ui';

import { HintItem } from './HintItem';
import { QueryHintSection } from './hints/types';

interface HintSectionComponentProps {
  section: QueryHintSection;
  query: string;
  onQueryChange: (query: string, isAddQuery?: boolean) => void;
}

export const HintSection = ({ section, query, onQueryChange }: HintSectionComponentProps) => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={styles.container}>
      <Collapse label={section.title} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
        <div className={styles.grid}>
          {section.hints.map((hint) => (
            <HintItem key={hint.title} hint={hint} query={query} onQueryChange={onQueryChange} />
          ))}
        </div>
      </Collapse>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    grid: css`
      padding-top: ${theme.spacing(1)};
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: ${theme.spacing(1)};
      max-width: 100%;

      @media (max-width: 1400px) {
        grid-template-columns: 1fr;
      }
    `,
  };
};
