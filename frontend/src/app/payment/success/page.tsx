"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";

interface PaymentSummary {
  orderId: string;
  status: string;
  paymentStatus: string;
  serviceName: string;
  shopName: string;
  amount: number;
  rcnDiscount: number;
  bookingDate: string;
  bookingTime: string;
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("No order ID provided");
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/services/orders/${orderId}/payment-summary`
        );
        if (response.data.success) {
          setSummary(response.data.data);
        } else {
          setError("Could not load order details");
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError("Order not found");
        } else {
          setError("Could not load order details");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-400 mb-8">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

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

        {/* Success Card */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
          {/* Checkmark */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Payment Successful!</h1>
            <p className="text-gray-400 mt-1">Your appointment has been confirmed</p>
          </div>

          {/* Order Details */}
          {summary && (
            <div className="space-y-4 mt-8">
              <div className="bg-gray-700/30 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Service</span>
                  <span className="text-white font-medium">{summary.serviceName}</span>
                </div>
                <div className="border-t border-gray-700" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Shop</span>
                  <span className="text-white font-medium">{summary.shopName}</span>
                </div>
                {summary.bookingDate && (
                  <>
                    <div className="border-t border-gray-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Date</span>
                      <span className="text-white font-medium">{summary.bookingDate}</span>
                    </div>
                  </>
                )}
                {summary.bookingTime && (
                  <>
                    <div className="border-t border-gray-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Time</span>
                      <span className="text-white font-medium">{summary.bookingTime}</span>
                    </div>
                  </>
                )}
                <div className="border-t border-gray-700" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Amount Paid</span>
                  <span className="text-green-400 font-bold text-lg">${summary.amount.toFixed(2)}</span>
                </div>
                {summary.rcnDiscount > 0 && (
                  <>
                    <div className="border-t border-gray-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">RCN Savings</span>
                      <span className="text-yellow-400 font-medium">-${summary.rcnDiscount.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Confirmation message */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                <p className="text-green-300 text-sm">
                  A confirmation email has been sent with your appointment details.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 mt-6">
                <Link
                  href="/customer?tab=orders"
                  className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all text-center"
                >
                  View My Orders
                </Link>
                <Link
                  href="/"
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-center"
                >
                  Go to Homepage
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
