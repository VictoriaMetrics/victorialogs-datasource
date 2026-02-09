import { useMemo } from "react";
import * as React from "react";

import { Icon, Tooltip } from "@grafana/ui";

export const QueryEditorHelp = () => {
  const helpTooltipContent = useMemo(() => {
    const helpText = `Variable Interpolation Rules:

1. Field Value Variables:
   • field:$var -> field:in("v1", ..., "vN")
   • field:=$var -> field:in("v1", ..., "vN")
   • Values are quoted and escaped
   • Empty values or "All" expand to in(*)

2. Function Contexts:
   • in($var) and contains_any($var) expand to quoted lists
   • Values maintain proper quoting within function calls

3. Nequality Operators in stream filters:
   • field:!$var -> !field in("v1", ..., "vN")
   • field:!=$var -> !field in("v1", ..., "vN")

4. Stream Filters:
   • {tag=$var} -> {tag in(...)}
   • {field!=$var} -> {tag not_in(...)}

5. Restrictions:
   • Interpolation is NOT allowed in regexp (e.g., field:~$var)
   • Invalid usage will show an error message`;
    return <pre>{helpText}</pre>;
  }, []);

  return (
    <Tooltip placement="top" content={helpTooltipContent} theme="info">
      <Icon name="info-circle" size="sm" width={16} height={16} />
    </Tooltip>
  );
};
