import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Users,
  LayoutDashboard,
  BarChart3,
  Headset,
  Rocket,
  BadgeDollarSign,
  Check,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Agency Program — RepairCoin",
  description:
    "Manage all your client shops from one dashboard. Grow your agency with RepairCoin — 10 client accounts for $999/mo, add more for $50 each.",
};

const FEATURES = [
  { icon: LayoutDashboard, title: "One Dashboard, Every Client", desc: "Manage up to 10 client shops from a single agency account — switch between them in a click." },
  { icon: Users, title: "Add Clients As You Grow", desc: "Ten client accounts included. Add more anytime for just $50 per client — pay as you scale." },
  { icon: BarChart3, title: "Cross-Client Reporting", desc: "See performance, revenue, and rewards activity across your whole client roster in one view." },
  { icon: Headset, title: "Dedicated Account Manager", desc: "A dedicated manager for your agency, plus priority phone & chat support for you and your clients." },
  { icon: Rocket, title: "White-Glove Onboarding", desc: "We help you onboard each client shop fast so they're issuing rewards from day one." },
  { icon: BadgeDollarSign, title: "Agency Margins", desc: "Bundle RepairCoin into your service offering and grow recurring revenue across your book of business." },
];

const STEPS = [
  { n: 1, title: "Activate", desc: "Subscribe to the Agency Program from your shop's Plans & Billing." },
  { n: 2, title: "Onboard your clients", desc: "We help you set up each client shop and their rewards." },
  { n: 3, title: "Manage & grow", desc: "Run everything from one dashboard and add clients as you scale." },
];

export default function AgencyPage() {
  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <Header />

      <main>
        {/* Hero */}
        <section className="relative max-w-6xl mx-auto px-4 lg:px-8 pt-20 pb-14 text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-wider bg-[#FFCC00] text-black px-3 py-1 rounded-full">
            Agency Program
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-6 leading-tight">
            Manage every client shop <br className="hidden md:block" /> from one dashboard.
          </h1>
          <p className="text-gray-400 text-lg mt-5 max-w-2xl mx-auto">
            Built for agencies and multi-location operators. Run all your clients' loyalty programs under one
            account, add clients as you grow, and get priority support the whole way.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Link href="/shop?tab=plans">
              <button className="inline-flex items-center gap-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold px-6 py-3 rounded-xl transition-colors">
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/pricing">
              <button className="px-6 py-3 rounded-xl border border-gray-700 text-gray-200 hover:border-gray-500 transition-colors font-medium">
                See Pricing
              </button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-gray-800 bg-[#111111] p-6 hover:border-gray-700 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-[#FFCC00]/15 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#FFCC00]" />
                  </div>
                  <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pricing */}
        <section className="max-w-3xl mx-auto px-4 lg:px-8 py-12">
          <div className="rounded-3xl border border-[#FFCC00]/30 bg-gradient-to-br from-[#FFCC00]/[0.08] to-transparent p-8 text-center">
            <p className="text-sm font-semibold text-[#FFCC00] uppercase tracking-wide">Agency Program</p>
            <div className="flex items-baseline justify-center gap-2 mt-3">
              <span className="text-5xl font-extrabold text-white">$999</span>
              <span className="text-gray-400">/month</span>
            </div>
            <p className="text-gray-300 mt-2">Includes 10 client accounts · add more for just <span className="text-white font-semibold">$50/client</span></p>

            <ul className="text-left max-w-md mx-auto mt-6 space-y-2.5">
              {[
                "Up to 10 client shops included",
                "Unified agency dashboard",
                "Cross-client reporting & analytics",
                "Dedicated account manager + priority support",
                "White-glove client onboarding",
                "Add clients anytime at $50 each",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{item}</span>
                </li>
              ))}
            </ul>

            <Link href="/shop?tab=plans">
              <button className="inline-flex items-center gap-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold px-6 py-3 rounded-xl transition-colors mt-8">
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-gray-800 bg-[#111111] p-6 text-center">
                <div className="w-9 h-9 rounded-full bg-[#FFCC00] text-black font-bold flex items-center justify-center mx-auto mb-3">
                  {s.n}
                </div>
                <h3 className="font-semibold text-white mb-1.5">{s.title}</h3>
                <p className="text-sm text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="max-w-5xl mx-auto px-4 lg:px-8 pb-20">
          <div className="rounded-3xl bg-[#111111] border border-gray-800 p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold">Ready to scale your agency?</h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto">
              Join the RepairCoin Agency Program and bring loyalty rewards to every shop you manage.
            </p>
            <Link href="/shop?tab=plans">
              <button className="inline-flex items-center gap-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold px-7 py-3 rounded-xl transition-colors mt-6">
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
