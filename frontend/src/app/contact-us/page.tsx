import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us - FixFlow",
  description: "Get in touch with the FixFlow team for support, feedback, or inquiries",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
          <p className="text-gray-400">
            Have a question, feedback, or need support? We&apos;d love to hear from you.
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {/* Email */}
          <a
            href="mailto:Repaircoin2025@gmail.com"
            className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 hover:border-[#FFCC00]/40 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-[#FFCC00]/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#FFCC00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">Email</h3>
            <p className="text-[#FFCC00] group-hover:underline">Repaircoin2025@gmail.com</p>
          </a>

          {/* Website */}
          <a
            href="https://repaircoin.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 hover:border-[#FFCC00]/40 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-[#FFCC00]/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#FFCC00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">Website</h3>
            <p className="text-[#FFCC00] group-hover:underline">repaircoin.ai</p>
          </a>
        </div>

        {/* Support Topics */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 mb-10">
          <h2 className="text-xl font-semibold mb-4">How Can We Help?</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">General Inquiries</h3>
                <p className="text-gray-400 text-sm">Questions about FixFlow, features, or partnerships</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Technical Support</h3>
                <p className="text-gray-400 text-sm">App issues, bugs, or account problems</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Shop Onboarding</h3>
                <p className="text-gray-400 text-sm">Register your business on the FixFlow platform</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">Report an Issue</h3>
                <p className="text-gray-400 text-sm">Report fraud, abuse, or safety concerns</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-3">
          <a href="/privacy-policy" className="text-gray-400 hover:text-[#FFCC00] text-sm transition-colors">
            Privacy Policy
          </a>
          <span className="text-gray-600">|</span>
          <a href="/delete-account" className="text-gray-400 hover:text-[#FFCC00] text-sm transition-colors">
            Delete Account
          </a>
        </div>
      </div>
    </div>
  );
}
