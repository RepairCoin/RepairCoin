"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

interface ThankYouTemplateProps {
  source: string;
}

export default function ThankYouTemplate({ source }: ThankYouTemplateProps) {
  const [email, setEmail] = useState("");
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("rc_waitlist_thankyou");
    if (stored) {
      const data = JSON.parse(stored);
      setEmail(data.email || "");
      setIsDemo(data.type === "demo");
      sessionStorage.removeItem("rc_waitlist_thankyou");
    }
  }, []);

  // Where to link back based on source
  const waitlistLink =
    source === "direct" ? "/waitlist" : `/waitlist/${source}`;

  return (
    <div className="min-h-screen bg-[#101010] text-white">
      {/* Header */}
      <header className="py-6 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <Link href="/" className="inline-block">
            <div className="relative w-[185px] h-[50px]">
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
      </header>

      {/* Thank You Content */}
      <section className="relative px-6 md:px-12 overflow-hidden" style={{ minHeight: "calc(100vh - 82px)" }}>
        <div
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
          style={{
            backgroundImage: `url('/img/waitlist/hero/hero_bg.png')`,
          }}
        />

        <div className="max-w-3xl mx-auto relative z-10 flex flex-col items-center justify-center py-20 md:py-32">
          {/* Success Icon */}
          <div className="w-24 h-24 bg-[#FFCC00] rounded-full flex items-center justify-center mb-8">
            <svg
              className="w-12 h-12 text-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Heading */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-center"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            {isDemo ? "Demo Request Received!" : "You\u2019re on the list!"}
          </h1>

          {/* Subtext */}
          <p
            className="text-center mb-10 max-w-xl"
            style={{
              fontFamily: 'var(--font-inria-sans), "Inria Sans", sans-serif',
              fontSize: "18px",
              lineHeight: "30px",
              color: "rgba(200, 200, 200, 1)",
            }}
          >
            {isDemo ? (
              <>
                Thank you for requesting a free demo.
                {email && (
                  <>
                    {" "}We&apos;ll reach out to{" "}
                    <span className="text-[#FFCC00] font-semibold">{email}</span>{" "}
                    to schedule your personalized walkthrough.
                  </>
                )}
              </>
            ) : (
              <>
                Thank you for joining RepairCoin.
                {email && (
                  <>
                    {" "}We&apos;ll notify you at{" "}
                    <span className="text-[#FFCC00] font-semibold">{email}</span>{" "}
                    when we launch.
                  </>
                )}
              </>
            )}
          </p>

          {/* What Happens Next */}
          <div
            className="w-full max-w-lg rounded-2xl p-8 mb-10"
            style={{
              background: "#0D0D0D",
              border: "1px solid rgba(221, 221, 221, 0.44)",
            }}
          >
            <h3
              className="text-center mb-6"
              style={{
                fontFamily: "Poppins, sans-serif",
                fontWeight: 600,
                fontSize: "18px",
                color: "#FFCC00",
              }}
            >
              What Happens Next?
            </h3>
            <div className="space-y-4">
              {[
                {
                  step: "1",
                  text: "Check your inbox for a confirmation email",
                },
                {
                  step: "2",
                  text: isDemo
                    ? "Our team will reach out to schedule your demo"
                    : "We\u2019ll notify you as we get closer to launch",
                },
                {
                  step: "3",
                  text: "Early signups get priority access and founding partner benefits",
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#FFCC00] rounded-full flex items-center justify-center flex-shrink-0">
                    <span
                      className="text-black font-bold text-sm"
                      style={{ fontFamily: "Poppins, sans-serif" }}
                    >
                      {item.step}
                    </span>
                  </div>
                  <p
                    className="pt-1"
                    style={{
                      fontFamily:
                        'var(--font-inria-sans), "Inria Sans", sans-serif',
                      fontSize: "16px",
                      lineHeight: "24px",
                      color: "rgba(200, 200, 200, 1)",
                    }}
                  >
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/"
              className="px-8 py-4 font-semibold transition-colors text-center"
              style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: "16px",
                background: "rgba(255, 204, 0, 1)",
                borderRadius: "8px",
                color: "#000",
              }}
            >
              Return to Home
            </Link>
            <Link
              href={waitlistLink}
              className="px-8 py-4 font-semibold transition-colors text-center"
              style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: "16px",
                background: "#fff",
                borderRadius: "8px",
                color: "#000",
              }}
            >
              Back to Waitlist
            </Link>
          </div>

          {/* Social Share */}
          <div className="mt-12 text-center">
            <p
              className="mb-4"
              style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: "14px",
                color: "rgba(151, 151, 151, 1)",
              }}
            >
              Spread the word
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://x.com/Repaircoin2025"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "rgba(43, 43, 45, 1)" }}
              >
                <img
                  src="/img/waitlist/footer/socialicon2.svg"
                  alt="X"
                  className="w-[17px] h-[17px]"
                />
              </a>
              <a
                href="https://www.instagram.com/repaircoin/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "rgba(43, 43, 45, 1)" }}
              >
                <img
                  src="/img/waitlist/footer/socialicon3.svg"
                  alt="Instagram"
                  className="w-[18px] h-[18px]"
                />
              </a>
              <a
                href="https://www.facebook.com/repaircoin"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "rgba(43, 43, 45, 1)" }}
              >
                <img
                  src="/img/waitlist/footer/socialicon1.svg"
                  alt="Facebook"
                  className="w-[9px] h-[17px]"
                />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
