import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - FixFlow",
  description: "FixFlow Privacy Policy - How we collect, use, and protect your data",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "April 3, 2026";

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: {lastUpdated}</p>
        </div>

        {/* Introduction */}
        <Section title="1. Introduction">
          <p>
            FixFlow (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the FixFlow mobile application and website.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
            service marketplace and rewards platform.
          </p>
          <p className="mt-3">
            By using FixFlow, you agree to the collection and use of information in accordance with this policy.
          </p>
        </Section>

        {/* Information We Collect */}
        <Section title="2. Information We Collect">
          <h3 className="text-white font-semibold mb-3">Personal Information</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
            <li><strong>Name</strong> — Used to identify you on the platform</li>
            <li><strong>Email address</strong> — Used for account management and notifications</li>
            <li><strong>Phone number</strong> (optional) — Used for account verification</li>
            <li><strong>Profile photo</strong> (optional) — Displayed on your profile</li>
            <li><strong>Wallet address</strong> — Used for blockchain-based rewards and authentication</li>
          </ul>

          <h3 className="text-white font-semibold mb-3">Financial Information</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
            <li><strong>Purchase history</strong> — Service bookings and transaction records</li>
            <li><strong>Token balances</strong> — RCN reward token balances and redemption history</li>
            <li><strong>Payment processing</strong> — Handled securely by Stripe. We do not store your credit card numbers or payment details.</li>
          </ul>

          <h3 className="text-white font-semibold mb-3">Usage Information</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
            <li><strong>Approximate location</strong> — Used to find nearby shops (not stored permanently)</li>
            <li><strong>In-app messages</strong> — Communications between customers and shops</li>
            <li><strong>Reviews and ratings</strong> — Feedback you provide on services</li>
            <li><strong>Search queries</strong> — Used to improve service recommendations (processed ephemerally)</li>
            <li><strong>Photos</strong> — Profile images and message attachments you upload</li>
          </ul>

          <h3 className="text-white font-semibold mb-3">Information We Do NOT Collect</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Phone contacts or address book</li>
            <li>Calendar events</li>
            <li>Files or documents from your device</li>
            <li>Browsing history</li>
            <li>Audio or video recordings</li>
            <li>Device IDs or advertising identifiers</li>
          </ul>
        </Section>

        {/* How We Use Your Information */}
        <Section title="3. How We Use Your Information">
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Provide, maintain, and improve our services</li>
            <li>Process service bookings and payments</li>
            <li>Manage your RCN reward token balances</li>
            <li>Enable messaging between customers and service providers</li>
            <li>Send booking confirmations and appointment reminders</li>
            <li>Display nearby shops based on your location</li>
            <li>Facilitate reviews and ratings for services</li>
            <li>Prevent fraud and ensure platform security</li>
            <li>Comply with legal obligations</li>
          </ul>
        </Section>

        {/* Data Sharing */}
        <Section title="4. Data Sharing">
          <p className="mb-3">We do not sell your personal information. We share data only with:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li><strong>Stripe</strong> — Payment processing (payment details only)</li>
            <li><strong>Thirdweb</strong> — Blockchain wallet connection and token transactions</li>
            <li><strong>DigitalOcean</strong> — Cloud hosting and image storage</li>
            <li><strong>Service providers (shops)</strong> — Your name and booking details when you book a service</li>
          </ul>
          <p className="mt-3">
            We may also disclose information if required by law or to protect the rights, safety, or property of
            FixFlow, our users, or the public.
          </p>
        </Section>

        {/* Data Security */}
        <Section title="5. Data Security">
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>All data is encrypted in transit using HTTPS/TLS</li>
            <li>Passwords and sensitive tokens are encrypted at rest</li>
            <li>JWT-based authentication with automatic token refresh</li>
            <li>Role-based access control (customer, shop, admin)</li>
            <li>Secure message encryption for locked messages (AES-256)</li>
          </ul>
          <p className="mt-3">
            While we implement industry-standard security measures, no method of electronic transmission or storage
            is 100% secure. We cannot guarantee absolute security.
          </p>
        </Section>

        {/* Data Retention */}
        <Section title="6. Data Retention">
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li><strong>Account data</strong> — Retained while your account is active</li>
            <li><strong>Transaction records</strong> — Retained for 7 years for financial compliance</li>
            <li><strong>Messages</strong> — Retained while your account is active</li>
            <li><strong>Blockchain records</strong> — On-chain data is permanent and cannot be deleted</li>
            <li><strong>Location data</strong> — Not stored; used ephemerally for nearby shop search</li>
          </ul>
        </Section>

        {/* Your Rights */}
        <Section title="7. Your Rights">
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li><strong>Access</strong> — View your personal data through your account profile</li>
            <li><strong>Update</strong> — Edit your profile information at any time</li>
            <li><strong>Delete</strong> — Request account deletion by emailing us</li>
            <li><strong>Export</strong> — Request a copy of your data</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact us at{" "}
            <a href="mailto:Repaircoin2025@gmail.com" className="text-[#FFCC00] hover:underline">
              Repaircoin2025@gmail.com
            </a>
          </p>
        </Section>

        {/* Children's Privacy */}
        <Section title="8. Children&apos;s Privacy">
          <p>
            FixFlow is not intended for users under 18 years of age. We do not knowingly collect personal information
            from children. If you believe a child has provided us with personal data, please contact us and we will
            delete it promptly.
          </p>
        </Section>

        {/* Third-Party Services */}
        <Section title="9. Third-Party Services">
          <p className="mb-3">Our app integrates with the following third-party services, each with their own privacy policies:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li><strong>Stripe</strong> — Payment processing</li>
            <li><strong>Thirdweb</strong> — Blockchain wallet and smart contract interactions</li>
            <li><strong>DigitalOcean Spaces</strong> — Image and file storage</li>
            <li><strong>Expo / React Native</strong> — App framework and push notifications</li>
          </ul>
        </Section>

        {/* Changes to This Policy */}
        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by updating the
            &quot;Last updated&quot; date at the top of this page. Continued use of the app after changes constitutes
            acceptance of the updated policy.
          </p>
        </Section>

        {/* Contact Us */}
        <Section title="11. Contact Us">
          <p className="mb-3">If you have questions about this Privacy Policy, contact us at:</p>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
            <p className="text-gray-300"><strong>FixFlow</strong></p>
            <p className="text-gray-300">
              Email:{" "}
              <a href="mailto:Repaircoin2025@gmail.com" className="text-[#FFCC00] hover:underline">
                Repaircoin2025@gmail.com
              </a>
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold mb-4 text-[#FFCC00]">{title}</h2>
      <div className="text-gray-400 leading-relaxed">{children}</div>
    </div>
  );
}
