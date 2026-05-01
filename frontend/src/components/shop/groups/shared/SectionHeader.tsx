"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
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
 * Reusable section header component with icon and optional action.
 * On mobile, the action collapses behind a 3-dot menu.
 */
export default function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  className = "",
}: SectionHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className={`flex items-center justify-between gap-2 mb-4 sm:mb-6 ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFCC00] flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="text-[#FFCC00] font-semibold text-sm sm:text-base truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-400 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {action && (
        <>
          {/* Desktop: render action inline */}
          <div className="hidden sm:block">{action}</div>

          {/* Mobile: 3-dot menu */}
          <div className="relative sm:hidden flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="More options"
              aria-expanded={menuOpen}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-[#1e1f22] transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div
                onClick={() => setMenuOpen(false)}
                className="absolute right-0 top-full mt-2 z-20 min-w-[180px] max-w-[calc(100vw-2rem)] bg-[#1e1f22] border border-gray-700 rounded-xl shadow-lg p-2"
              >
                {action}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
