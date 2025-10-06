import React from "react";

import { QueryBuilderOperationParamEditorProps } from "@grafana/plugin-ui";
import { Input } from "@grafana/ui";

export default function SingleCharInput(props: QueryBuilderOperationParamEditorProps) {
    const { value, onChange, index } = props;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(index, e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            (e.target as HTMLInputElement).value = "";
            e.preventDefault();
            return;
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            (e.target as HTMLInputElement).value = e.key;
            e.preventDefault();
            return;
        }
    };

    return (
        <Input
            type="text"
            value={String(value || "")}
            onBlur={handleChange}
            onKeyDown={handleKeyDown}
            width={10}
            maxLength={1}
        />
    );
}
