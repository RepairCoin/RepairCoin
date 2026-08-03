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

import React, { useState } from "react";
import { Info } from "lucide-react";
import { WorkflowMetrics } from "@/services/api/messaging";

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;

/**
 * The caveat, written once and used by both the hover title and the ⓘ panel.
 *
 * Two copies of this sentence would drift, and the moment they disagree the product is telling two
 * different stories about the same number.
 */
const attributionNote = (days: number) =>
  `Booked and revenue count orders placed within ${days} days of a message from this automation. ` +
  `Correlation, not proof of cause.`;

/**
 * Renders null when the rule has never run. That is a real state, not an error: a brand-new automation
 * has nothing to report, and inventing "Sent 0 · Read 0%" would make it look broken rather than new.
 */
export const AutoMessageResults: React.FC<{
  metrics: WorkflowMetrics | undefined;
  attributionDays: number;
  className?: string;
}> = ({ metrics: m, attributionDays, className = "" }) => {
  const [showNote, setShowNote] = useState(false);

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
    <div className={`text-xs text-gray-400 ${className}`}>
      <span title={attributionNote(attributionDays)}>
        Sent {m.delivered} · Read {readPct}% · Booked {m.booked} · {money(m.revenue)}
        <span className="text-gray-600"> within {attributionDays}d</span>
      </span>

      {/* The caveat needs to be FINDABLE, not just hoverable. A native title is invisible until you rest
          the cursor on it and does nothing at all on touch — and the revenue figure is the number that
          gets screenshotted and quoted. If it's read as "the workflow caused this", that is very hard to
          walk back, so the explanation gets an affordance you can actually see and tap. */}
      <span className="relative inline-flex align-middle ml-1">
        <button
          type="button"
          aria-label="How these numbers are counted"
          aria-expanded={showNote}
          // Rows and cards around this are clickable — opening the note must not also open the editor.
          onClick={(e) => {
            e.stopPropagation();
            setShowNote((v) => !v);
          }}
          onBlur={() => setShowNote(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {showNote && (
          // Absolutely positioned so it can't disturb either layout: this component sits inline in a flex
          // row on the campaigns list and under the name in the workflows table.
          <span
            role="tooltip"
            className="absolute left-0 top-5 z-30 w-64 rounded-lg border border-gray-700 bg-[#1A1A1A] p-2.5 text-xs leading-relaxed text-gray-300 shadow-lg"
          >
            {attributionNote(attributionDays)}
          </span>
        )}
      </span>
    </div>
  );
};
