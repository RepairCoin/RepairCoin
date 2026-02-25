"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  /** Icon component to display */
  icon: LucideIcon;
  /** Section title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Optional action element (button, etc.) */
  action?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable section header component with icon and optional action
 */
export default function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#FFCC00]" />
        <div>
          <h3 className="text-[#FFCC00] font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
