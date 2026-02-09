import { css } from "@emotion/css";
import React, { useMemo, useState } from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { Button, Modal, useStyles2 } from "@grafana/ui";

import { HintSection } from "./HintSection";
import {
  useFormatLogsOutputHintsSection,
  usePlotPiechartHistogramHintsSection,
  usePlotTimeSeriesHintsSection,
  usePrintRecentLogsHintsSection,
} from "./hints";

interface QueryHintsExampleProps {
  query: string;
  onQueryChange: (query: string, isAddQuery?: boolean) => void;
}

/**
 * A React functional component that provides a set of helpful query examples and hints for LogsQL queries.
 * The component renders a "Quick start" button that opens a modal displaying several query example sections.
 * Users can interact with the modal to view, copy, append, or replace their current query with predefined examples.
 *
 * @param {QueryHintsExampleProps} props - The props for the QueryHintsExample component.
 * @returns {JSX.Element} A button and modal component for presenting LogsQL query examples.
 */
export const QueryHintsExample = ({ query, onQueryChange }: QueryHintsExampleProps) => {
  const styles = useStyles2(getStyles);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const printRecentLogsSection = usePrintRecentLogsHintsSection();
  const formatLogsOutputSection = useFormatLogsOutputHintsSection();
  const plotTimeSeriesSection = usePlotTimeSeriesHintsSection();
  const plotPiechartHistogramSection = usePlotPiechartHistogramHintsSection();
  const sections = useMemo(() =>
    [printRecentLogsSection,  formatLogsOutputSection, plotTimeSeriesSection, plotPiechartHistogramSection],
  [formatLogsOutputSection, plotPiechartHistogramSection, plotTimeSeriesSection, printRecentLogsSection]);

  const handleQueryChange = (newQuery: string, isAddQuery?: boolean) => {
    onQueryChange(newQuery, isAddQuery);
    setIsModalOpen(false);
  };

  return (
    <>
      <Button icon="question-circle" variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
        Quick start
      </Button>

      <Modal
        className={styles.modal}
        title="LogsQL Query Examples"
        isOpen={isModalOpen}
        onDismiss={() => setIsModalOpen(false)}
        closeOnEscape
        closeOnBackdropClick
      >
        <div className={styles.description}>
          Choose a query example to get started. You can copy, append to current query, or replace the current query.
        </div>
        {sections.map((section) => (
          <HintSection
            key={section.title}
            section={section}
            query={query}
            onQueryChange={handleQueryChange}
          />))}
      </Modal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css`
      width: 85vw;
      max-width: 1400px;
    `,
    description: css`
      margin-bottom: 16px;
      color: ${theme.colors.text.secondary};
    `,
  };
};
