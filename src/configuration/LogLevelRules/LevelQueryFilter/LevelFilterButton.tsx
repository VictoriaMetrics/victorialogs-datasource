import { css } from "@emotion/css";
import React, { MouseEvent } from "react";

import { LogLevel } from "@grafana/data";
import { Button, Stack, useStyles2 } from "@grafana/ui";

import { LOG_LEVEL_COLOR } from "../const";

export interface LevelFilterButtonProps {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  label: string;
  level: LogLevel;
  isSelected?: boolean;
}

export const LevelFilterButton = ({ onClick, label, level, isSelected }: LevelFilterButtonProps) => {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction={"row"}>
      <Button
        onClick={onClick}
        variant={"secondary"}
        size={"sm"}
        type={"button"}
        style={{ opacity: isSelected ? 1 : 0.5, userSelect: 'none' }}
        tooltip={"Use 'shift' to select several levels"}
      >
        <div className={styles.colorCircle} style={{ backgroundColor: getLogLevelColor(level) }}/>
        {label}
      </Button>
    </Stack>
  );
};

const getLogLevelColor = (level: LogLevel): string => {
  return LOG_LEVEL_COLOR[level] || LOG_LEVEL_COLOR[LogLevel.unknown];
};

const getStyles = () => {
  return {
    colorCircle: css({
      width: 12,
      height: 12,
      borderRadius: '50%',
      marginRight: 5,
    }),
  };
};
