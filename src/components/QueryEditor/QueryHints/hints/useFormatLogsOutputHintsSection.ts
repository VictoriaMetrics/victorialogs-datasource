import { useMemo } from "react";

import { QueryHintSection } from "./types";

export const useFormatLogsOutputHintsSection = (): QueryHintSection => {
  return useMemo((): QueryHintSection => {
    return {
      title: "Format Logs Output",
      hints: [
        {
          title: "Select only specific fields",
          queryExpr: "<q> | fields <field1>, <field2>, <field3>",
          example: "* | fields _time, _stream, _msg",
          description: "Display only timestamp, stream, and message fields",
          id: "fields-pipe"
        },
        {
          title: "Format with a custom template",
          queryExpr: '<q> | format "pattern" as result_field',
          example: '* | format "request from <ip>:<port>" as _msg',
          description: "Create custom formatted output from log fields",
          id: "format-pipe"
        },
        {
          title: "Rename fields",
          queryExpr: "<q> | rename src1 as dst1, ..., srcN as dstN",
          example: "* | rename host as server",
          description: "Rename a field to a different name",
          id: "rename-pipe"
        },
        {
          title: "Delete unwanted fields",
          queryExpr: "<q> | delete field1, ..., fieldN",
          example: "* | delete host, app",
          description: "Remove fields from the output",
          id: "delete-pipe"
        },
        {
          title: "Extract data from log message",
          queryExpr: '<q> | extract "pattern" from field_name',
          example: '* | extract "username=<username>, user_id=<user_id>," from _msg',
          description: "Parse and extract structured data from log messages",
          id: "extract-pipe"
        },
      ],
    };
  }, []);
};
