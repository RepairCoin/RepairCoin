"use client";

import React, { useEffect, useState } from "react";

interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onValueChange: (value: number) => void;
  integer?: boolean;
  emptyValue?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onValueChange,
  integer = false,
  emptyValue = 0,
  ...props
}) => {
  const [text, setText] = useState<string>(value === emptyValue ? "" : String(value));

  useEffect(() => {
    const parsed = text === "" ? emptyValue : integer ? parseInt(text, 10) : parseFloat(text);
    if (parsed !== value && !(Number.isNaN(parsed) && value === emptyValue)) {
      setText(value === emptyValue ? "" : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (raw === "") {
      onValueChange(emptyValue);
      return;
    }

    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
    onValueChange(Number.isNaN(parsed) ? emptyValue : parsed);
  };

  return (
    <input
      {...props}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      onChange={handleChange}
    />
  );
};
