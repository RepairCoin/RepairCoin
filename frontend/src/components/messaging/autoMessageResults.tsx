// frontend/src/components/messaging/autoMessageResults.tsx
//
// The outcome line shown under an automation's name — "measurable, not just configurable".
//
// SHARED BY BOTH SURFACES ON PURPOSE. The metrics endpoint computes numbers for every rule a shop has,
// but for a while only the Automation list rendered them, so AI Campaigns rules had outcomes that were
// calculated and then never shown. Two copies of this formatter would also drift: the moment one surface
// changed "Read" or the attribution wording, the same number would read differently depending on which
// screen you were on.
//
// Three deliberate choices, all about not overstating what we know:
//  - "Read", not "Opened". These are in-app messages with a real read receipt; there is no open pixel to
//    estimate from, and "Opened" would borrow email's vaguer meaning.
//  - Booked and revenue carry the attribution window in the label, with the rule on hover. "Revenue
//    Generated" would assert the automation CAUSED the money, which a time window cannot show.
//  - A shop-facing rule (notify_staff) has no recipient, so it reports "Ran N times" rather than
//    pretending to a 0% read rate on messages it never sent.

import React from "react";
import { WorkflowMetrics } from "@/services/api/messaging";

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;

/**
 * Renders null when the rule has never run. That is a real state, not an error: a brand-new automation
 * has nothing to report, and inventing "Sent 0 · Read 0%" would make it look broken rather than new.
 */
export const AutoMessageResults: React.FC<{
  metrics: WorkflowMetrics | undefined;
  attributionDays: number;
  className?: string;
}> = ({ metrics: m, attributionDays, className = "" }) => {
  if (!m || m.sent === 0) return null;

  // No send was addressed to a customer, so there is no read rate or revenue to speak of.
  if (m.delivered === 0) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        Ran {m.sent} time{m.sent === 1 ? "" : "s"}
      </div>
    );
  }

  // Divided by `delivered`, not `sent`: a workflow that mixes customer messages with a staff-alert step
  // would otherwise be permanently penalised for the step that had nobody to read it.
  const readPct = Math.round((m.read / m.delivered) * 100);

  return (
    <div
      className={`text-xs text-gray-400 ${className}`}
      title={
        `Booked and revenue count orders placed within ${attributionDays} days of a message from this ` +
        `automation. Correlation, not proof of cause.`
      }
    >
      Sent {m.delivered} · Read {readPct}% · Booked {m.booked} · {money(m.revenue)}
      <span className="text-gray-600"> within {attributionDays}d</span>
    </div>
  );
};
