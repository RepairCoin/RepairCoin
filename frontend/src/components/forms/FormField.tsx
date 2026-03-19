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
  } focus:outline-none focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition duration-200`;

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
          className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10 cursor-pointer"
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
          className={`w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          required={required}
        />
      )}

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};
