import React from "react";

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string | boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  children?: React.ReactNode; // For select options
  as?: "input" | "select";
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = false,
  placeholder,
  disabled = false,
  error,
  children,
  as = "input",
}) => {
  const inputClassName = `w-full px-4 py-3 rounded-xl bg-gray-100 border ${
    error ? "border-red-500" : "border-gray-300"
  } focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition duration-200`;

  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-300 mb-2"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {as === "select" ? (
        <select
          id={name}
          name={name}
          value={value as string}
          onChange={onChange}
          disabled={disabled}
          className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required={required}
        >
          {children}
        </select>
      ) : type === "checkbox" ? (
        <div className="flex items-center">
          <input
            type="checkbox"
            id={name}
            name={name}
            checked={value as boolean}
            onChange={onChange}
            disabled={disabled}
            className="mr-2 h-4 w-4 text-[#FFCC00] focus:ring-[#FFCC00]"
            required={required}
          />
          <span className="text-sm text-gray-400">{placeholder}</span>
        </div>
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={value as string}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required={required}
        />
      )}

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};
