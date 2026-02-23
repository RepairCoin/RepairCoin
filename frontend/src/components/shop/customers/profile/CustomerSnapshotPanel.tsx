"use client";

import React from "react";
import { Calendar, Clock, Wrench, Activity } from "lucide-react";

interface CustomerSnapshotPanelProps {
  joinDate?: string;
  lastTransaction?: string;
  lastServiceName?: string;
  totalTransactions: number;
  memberDays: number;
}

const getRelativeTime = (dateString?: string): string => {
  if (!dateString) return "N/A";
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const CustomerSnapshotPanel: React.FC<CustomerSnapshotPanelProps> = ({
  joinDate,
  lastTransaction,
  lastServiceName,
  totalTransactions,
  memberDays,
}) => {
  // Compute visit cadence
  const cadence =
    totalTransactions > 1 && memberDays > 0
      ? `~${Math.round(memberDays / totalTransactions)} days`
      : "N/A";

  const items = [
    {
      icon: <Calendar className="w-4 h-4 text-[#FFCC00]" />,
      label: "Member Since",
      value: formatDate(joinDate),
    },
    {
      icon: <Clock className="w-4 h-4 text-[#FFCC00]" />,
      label: "Last Activity",
      value: getRelativeTime(lastTransaction),
    },
    {
      icon: <Wrench className="w-4 h-4 text-[#FFCC00]" />,
      label: "Last Service",
      value: lastServiceName || "N/A",
    },
    {
      icon: <Activity className="w-4 h-4 text-[#FFCC00]" />,
      label: "Visit Cadence",
      value: cadence,
    },
  ];

  return (
    <div className="bg-[#101010] rounded-[20px] p-5 border border-[#303236]">
      <h3 className="text-sm font-semibold text-[#FFCC00] mb-4">Customer Snapshot</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <div className="mt-0.5">{item.icon}</div>
            <div>
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-sm font-medium text-white">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
