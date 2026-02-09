import { DataFrame, Labels } from "@grafana/data";

export function dataFrameHasError(frame: DataFrame): boolean {
  const labelSets: Labels[] = frame.fields.find((f) => f.name === "labels")?.values ?? [];
  return labelSets.some((labels) => labels.__error__ !== undefined);
}
