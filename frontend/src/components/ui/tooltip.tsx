"use client";

import React, { useState, ReactNode } from "react";
import { Info, Sparkles } from "lucide-react";

interface TooltipProps {
  title?: string;
  content: ReactNode;
  children?: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  width?: string;
  showIcon?: boolean;
  icon?: ReactNode;
  titleIcon?: ReactNode;
  className?: string;
  triggerClassName?: string;
}

export default function Tooltip({
  title,
  content,
  children,
  position = "bottom",
  width = "w-80",
  showIcon = true,
  icon = <Info className="w-4 h-4 text-gray-100/70 group-hover:text-gray-100 transition-colors" />,
  titleIcon = <Sparkles className="w-4 h-4" />,
  className = "",
  triggerClassName = "",
}: TooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "bottom-full mb-2";
      case "left":
        return "right-full mr-2 top-0";
      case "right":
        return "left-full ml-2 top-0";
      case "bottom":
      default:
        return "top-full mt-2";
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case "top":
        return "absolute -bottom-2 left-4 w-4 h-4 bg-[#252525] border-r border-b border-gray-700 transform rotate-45";
      case "left":
        return "absolute -right-2 top-4 w-4 h-4 bg-[#252525] border-t border-r border-gray-700 transform rotate-45";
      case "right":
        return "absolute -left-2 top-4 w-4 h-4 bg-[#252525] border-b border-l border-gray-700 transform rotate-45";
      case "bottom":
      default:
        return "absolute -top-2 left-4 w-4 h-4 bg-[#252525] border-l border-t border-gray-700 transform rotate-45";
    }
  };

  const getAlignmentClasses = () => {
    switch (position) {
      case "top":
      case "bottom":
        return "left-0";
      case "left":
        return "right-0";
      case "right":
        return "left-0";
      default:
        return "left-0";
    }
  };

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`p-2 bg-gray-900/40 hover:bg-gray-900/60 rounded-lg transition-all group ${triggerClassName}`}
      >
        {children || (showIcon && icon)}
      </button>

      {showTooltip && (
        <div
          className={`absolute ${getPositionClasses()} ${getAlignmentClasses()} ${width} z-50 ${className}`}
          style={{
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <div className="bg-[#252525] border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
            {title && (
              <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 px-4 py-3 border-b border-gray-700">
                <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                  {titleIcon}
                  {title}
                </h4>
              </div>
            )}
            <div className="p-4">
              {content}
            </div>
          </div>
          <div className={getArrowClasses()}></div>
        </div>
      )}
    </div>
  );
}