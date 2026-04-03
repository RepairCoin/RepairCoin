import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Account - FixFlow",
  description: "Request deletion of your FixFlow account and associated data",
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Delete Your FixFlow Account</h1>
          <p className="text-gray-400">
            We're sorry to see you go. Follow the steps below to request account deletion.
          </p>
        </div>

        {/* How to Request */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">How to Request Account Deletion</h2>
          <p className="text-gray-400 mb-4">
            To request deletion of your account and associated data, please send an email to:
          </p>
          <a
            href="mailto:Repaircoin2025@gmail.com?subject=Account%20Deletion%20Request"
            className="inline-block bg-[#FFCC00] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#e6b800] transition-colors"
          >
            Repaircoin2025@gmail.com
          </a>
          <div className="mt-6">
            <p className="text-gray-400 mb-3">Please include the following in your email:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="text-[#FFCC00] mr-2">1.</span>
                Your registered email address
              </li>
              <li className="flex items-start">
                <span className="text-[#FFCC00] mr-2">2.</span>
                Your wallet address
              </li>
              <li className="flex items-start">
                <span className="text-[#FFCC00] mr-2">3.</span>
                Subject line: &quot;Account Deletion Request&quot;
              </li>
            </ul>
          </div>
        </div>

        {/* What Gets Deleted */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">What Gets Deleted</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Your profile information (name, email, phone number)
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Your profile photo
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Your message history
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Your notification history
            </li>
          </ul>
        </div>

        {/* What is Retained */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">What is Retained</h2>
          <p className="text-gray-400 mb-4">
            The following data is retained for legal and financial compliance:
          </p>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-center">
              <svg className="w-5 h-5 text-[#FFCC00] mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Transaction records (required for financial reporting, retained for 7 years)
            </li>
            <li className="flex items-center">
              <svg className="w-5 h-5 text-[#FFCC00] mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Blockchain records (on-chain data cannot be deleted)
            </li>
          </ul>
        </div>

        {/* Timeline */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Timeline</h2>
          <p className="text-gray-300">
            Your account will be deleted within <span className="text-[#FFCC00] font-semibold">30 days</span> of
            receiving your request. You will receive a confirmation email once your account has been deleted.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>
            If you have any questions, contact us at{" "}
            <a href="mailto:support@repaircoin.ai" className="text-[#FFCC00] hover:underline">
              support@repaircoin.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
