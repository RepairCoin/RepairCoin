"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SectionHeaderVariant = "page" | "section";

interface SectionHeaderProps {
  /** Visual style. `"page"` for top-of-page headers, `"section"` for sub-section headers. */
  variant?: SectionHeaderVariant;
  /** Optional Lucide icon shown before the title. */
  icon?: LucideIcon;
  /**
   * Heading content. Pass a `string` to render inside a styled `<h1>`/`<h3>` (per variant).
   * Pass a `ReactNode` (e.g. a tab bar) to render the node as-is — caller owns styling.
   */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Action element (button, FilterTabs, etc.). Inline on `sm+`, collapsed behind a kebab menu on mobile. */
  action?: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<
  SectionHeaderVariant,
  {
    container: string;
    icon: string;
    title: string;
    subtitle: string;
    actionDesktop: string;
  }
> = {
  page: {
    container: "flex items-center justify-between gap-3 mb-6",
    icon: "w-5 h-5 sm:w-6 sm:h-6 text-[#FFCC00] flex-shrink-0",
    title: "text-xl sm:text-2xl font-bold text-white mb-1",
    subtitle: "text-sm sm:text-base text-gray-400",
    actionDesktop: "hidden sm:flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3",
  },
  section: {
    container: "flex items-center justify-between gap-2 mb-4 sm:mb-6",
    icon: "w-4 h-4 sm:w-5 sm:h-5 text-[#FFCC00] flex-shrink-0",
    title: "text-[#FFCC00] font-semibold text-sm sm:text-base truncate",
    subtitle: "text-xs sm:text-sm text-gray-400 truncate",
    actionDesktop: "hidden sm:block",
  },
};

export function SectionHeader({
  variant = "section",
  icon: Icon,
  title,
  subtitle,
  action,
  className = "",
}: SectionHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const styles = VARIANT_STYLES[variant];
  const TitleTag = variant === "page" ? "h1" : "h3";

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
    <div className={`${styles.container} ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className={styles.icon} />}
        <div className="min-w-0">
          {typeof title === "string" ? (
            <TitleTag className={styles.title}>{title}</TitleTag>
          ) : (
            title
          )}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>

      {action && (
        <>
          <div className={styles.actionDesktop}>{action}</div>

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

export default SectionHeader;
