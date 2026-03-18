"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function PaymentCancelledContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="relative w-[185px] h-[50px] mx-auto">
              <Image
                src="/img/nav-logo.png"
                alt="RepairCoin Logo"
                fill
                className="object-contain"
                sizes="185px"
              />
            </div>
          </Link>
        </div>

        {/* Cancelled Card */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h1>
          <p className="text-gray-400 mb-8">
            Your payment was not completed. No charges were made.
            {orderId && " You can use the payment link in your email to try again."}
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all text-center"
            >
              Go to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
        </div>
      }
    >
      <PaymentCancelledContent />
    </Suspense>
  );
}
