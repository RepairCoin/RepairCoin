"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { ModalSize } from "../types";

interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal content */
  children: ReactNode;
  /** Optional footer content (buttons, etc.) */
  footer?: ReactNode;
  /** Size variant of the modal */
  size?: ModalSize;
  /** Optional icon to display next to title */
  icon?: ReactNode;
  /** Optional subtitle */
  subtitle?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

/**
 * Reusable modal component with standardized styling
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  icon,
  subtitle,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`bg-[#101010] rounded-2xl border border-gray-800 ${sizeClasses[size]} w-full shadow-2xl max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div className="flex items-start gap-4">
            {icon && (
              <div className="flex-shrink-0 p-3 bg-[#FFCC00]/10 rounded-xl">
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-white">{title}</h3>
              {subtitle && (
                <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1e1f22] rounded-lg transition-colors -mr-2 -mt-2"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-6 pt-0 flex gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
