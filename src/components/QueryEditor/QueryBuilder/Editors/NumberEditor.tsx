import React from "react";

import { QueryBuilderOperationParamEditorProps } from "@grafana/plugin-ui";

export default function NumberEditor(props: QueryBuilderOperationParamEditorProps) {
    const { value, onChange, index } = props;
    const validateInput = (input: string): string => {
        // allow numbers, -, +, ., KB, MB, GB, TB, Ki, Mi, Gi, Ti, K,M, G, T, KiB, MiB, GiB, TiB, _
        const allowedPattern = /[^0-9\-+._KMGTkmgtiIBb]/g;
        return input.replace(allowedPattern, '');
    }
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        const sanitizedValue = validateInput(inputValue);
        if (sanitizedValue !== inputValue) {
            e.target.value = sanitizedValue;
        }
    };
    const updateValue = (e: React.FocusEvent<HTMLInputElement>) => {
        onChange(index, e.target.value.trim());
    }
    
    return (
        <input 
            type="text"
            defaultValue={value as string}
            onInput={handleInputChange}
            onBlur={updateValue}
            style={{ width: '15ch' }}
        />
    );
}
