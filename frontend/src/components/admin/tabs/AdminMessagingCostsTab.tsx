"use client";

// Admin: off-channel AI-messaging cost + consent dashboard (Phase 3). Surfaces the
// customer_messaging_costs ledger (AI vs carrier cost per shop) + consent counts so admins can see
// the true cost of SMS/WhatsApp auto-replies and inform the "who pays" decision. Admin-only,
// read-only. Reads GET /api/messages/admin/messaging-costs.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, MessageSquare, DollarSign, Truck, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  getMessagingCostSummary, fmtCents, type MessagingCostSummary,
} from "@/services/api/messagingCosts";

const PERIODS: { label: string; days?: number }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time" },
];

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({
  icon, label, value, sub,
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-gray-500 text-sm">{icon}<span>{label}</span></div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {sub && <div className="text-sm text-gray-500">{sub}</div>}
    </CardContent>
  </Card>
);

export const AdminMessagingCostsTab: React.FC = () => {
  const [data, setData] = useState<MessagingCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number | undefined>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getMessagingCostSummary(days));
    } catch (e: any) {
      setError(e?.message || "Failed to load messaging costs");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const gt = data?.grandTotal;
  const consentGranted = (channel: string) =>
    data?.consent.filter((c) => c.channel === channel && c.status === "granted").reduce((n, c) => n + c.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">AI Messaging Costs</h2>
          <p className="text-sm text-gray-500">
            Off-channel AI auto-replies (SMS &amp; WhatsApp) — inference vs carrier cost per shop.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.label}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-sm ${days === p.days ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="text-red-600 text-sm py-8 text-center">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<MessageSquare className="w-4 h-4" />} label="AI replies sent" value={String(gt?.replyCount ?? 0)} />
            <StatCard icon={<DollarSign className="w-4 h-4" />} label="AI (inference)" value={fmtCents(gt?.aiCostCents ?? 0)} />
            <StatCard icon={<Truck className="w-4 h-4" />} label="Carrier (est.)" value={fmtCents(gt?.carrierCostCents ?? 0)} />
            <StatCard icon={<DollarSign className="w-4 h-4" />} label="Total cost" value={fmtCents(gt?.totalCents ?? 0)}
              sub={data?.periodDays ? `last ${data.periodDays} days` : "all time"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost by shop</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.shops.length ?? 0) === 0 ? (
                <div className="text-sm text-gray-500 py-6 text-center">
                  No off-channel AI replies recorded for this period yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shop</TableHead>
                        <TableHead className="text-right">Replies</TableHead>
                        <TableHead className="text-right">AI cost</TableHead>
                        <TableHead className="text-right">Carrier (est.)</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.shops.map((s) => (
                        <TableRow key={s.shopId}>
                          <TableCell className="font-medium">{s.shopName || s.shopId}</TableCell>
                          <TableCell className="text-right">{s.replyCount}</TableCell>
                          <TableCell className="text-right">{fmtCents(s.aiCostCents)}</TableCell>
                          <TableCell className="text-right">{fmtCents(s.carrierCostCents)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtCents(s.totalCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="mt-3 text-xs text-gray-400">
                Carrier cost is an estimate (flat per-message rate); AI cost is exact. Carrier is only charged when a
                reply actually left.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Opt-in consent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div>
                  <div className="text-sm text-gray-500">SMS opt-ins</div>
                  <div className="text-xl font-semibold text-gray-900">{consentGranted("sms")}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">WhatsApp opt-ins</div>
                  <div className="text-xl font-semibold text-gray-900">{consentGranted("whatsapp")}</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Recorded automatically when a customer messages first (implied opt-in). Enforcement is off until legal
                sign-off (ENFORCE_MESSAGING_CONSENT).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminMessagingCostsTab;
