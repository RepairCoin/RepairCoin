"use client";

// Per-channel performance split (Messenger vs webform vs Google …). Leads,
// bookings, revenue, conversion and avg order value are exact; spend isn't
// reported per channel by Meta/Google, so ROI/CPL here use spend allocated by
// each channel's lead share — an estimate, flagged in the footnote.

import React from "react";
import { fmtMoney, fmtRoi, type ChannelRoi } from "@/services/api/ads";
import { channelMeta } from "./channelMeta";

const pct = (v: number | null): string => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);

export const ChannelBreakdown: React.FC<{ channels: ChannelRoi[]; currency?: string | null }> = ({
  channels,
  currency,
}) => {
  const rows = (channels || []).filter((c) => c.leads > 0 || c.bookings > 0 || c.revenueCents > 0);
  if (rows.length === 0) return null;

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-[#1A1A1A] p-4">
      <p className="text-sm font-medium text-gray-200">By channel</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">
        Where your leads come from and which one turns into paid bookings.
      </p>

      {/* header row — hidden on mobile, values stack into cards instead */}
      <div className="hidden sm:grid grid-cols-[1.4fr_repeat(5,1fr)] gap-2 px-2 pb-1.5 text-xs text-gray-500 border-b border-white/5">
        <span>Channel</span>
        <span className="text-right">Leads</span>
        <span className="text-right">Bookings</span>
        <span className="text-right">Conv.</span>
        <span className="text-right">Revenue</span>
        <span className="text-right">ROI*</span>
      </div>

      <div className="divide-y divide-white/5">
        {rows.map((c) => {
          const m = channelMeta(c.channel);
          return (
            <div key={c.channel}>
              {/* desktop: one aligned row */}
              <div className="hidden sm:grid grid-cols-[1.4fr_repeat(5,1fr)] gap-2 px-2 py-2.5 items-center">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  <m.Icon className={`w-4 h-4 ${m.color}`} /> {m.label}
                </span>
                <span className="text-right text-sm text-gray-200">{c.leads}</span>
                <span className="text-right text-sm text-gray-200">{c.bookings}</span>
                <span className="text-right text-sm text-gray-200">{pct(c.conversionRate)}</span>
                <span className="text-right text-sm font-semibold text-white">
                  {fmtMoney(c.revenueCents, currency)}
                </span>
                <span
                  className={`text-right text-sm font-semibold ${
                    c.roi == null ? "text-gray-400" : c.roi >= 0 ? "text-[#FFCC00]" : "text-red-400"
                  }`}
                >
                  {fmtRoi(c.roi)}
                </span>
              </div>

              {/* mobile: labelled card */}
              <div className="sm:hidden px-1 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-white">
                    <m.Icon className={`w-4 h-4 ${m.color}`} /> {m.label}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {fmtMoney(c.revenueCents, currency)}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-2 text-xs">
                  <Cell label="Leads" value={String(c.leads)} />
                  <Cell label="Bookings" value={String(c.bookings)} />
                  <Cell label="Conv." value={pct(c.conversionRate)} />
                  <Cell label="ROI*" value={fmtRoi(c.roi)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500 mt-3 leading-snug">
        * Leads, bookings and revenue are exact. Ad platforms don&apos;t report spend per channel, so
        ROI splits the campaign&apos;s spend by each channel&apos;s share of leads — treat it as a guide, not
        an invoice.
      </p>
    </div>
  );
};

const Cell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-gray-500">{label}</p>
    <p className="text-gray-200 font-medium">{value}</p>
  </div>
);
