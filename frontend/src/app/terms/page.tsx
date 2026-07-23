import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions - FixFlow",
  description: "FixFlow Terms and Conditions governing your access to and use of the platform",
};

export default function TermsPage() {
  const effectiveDate = "July 22, 2026";

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
          <p className="text-gray-400">Effective Date: {effectiveDate}</p>
        </div>

        {/* Introduction */}
        <div className="mb-10 text-gray-400 leading-relaxed">
          <p>
            Welcome to FixFlow. These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of the
            FixFlow platform, websites, mobile applications, APIs, and related services (collectively, the
            &quot;Services&quot;). By creating an account or using the Services, you agree to these Terms.
          </p>
          <p className="mt-3">If you do not agree to these Terms, do not use the Services.</p>
        </div>

        <Section title="1. About FixFlow">
          <p>
            FixFlow is an AI-powered business management platform that helps service businesses manage appointments,
            customers, payments, marketing, inventory, messaging, AI tools, and marketplace listings.
          </p>
          <p className="mt-3">
            FixFlow provides software only and is not the provider of services offered by businesses using the platform.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>You must be at least 18 years old and capable of entering into a legally binding agreement.</p>
          <p className="mt-3">You agree to provide accurate and current information when creating your account.</p>
        </Section>

        <Section title="3. User Accounts">
          <p className="mb-3">You are responsible for:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Maintaining the security of your account.</li>
            <li>Keeping your password and verification methods secure.</li>
            <li>All activity occurring under your account.</li>
          </ul>
          <p className="mt-3">Notify FixFlow immediately if you believe your account has been compromised.</p>
        </Section>

        <Section title="4. Marketplace">
          <p className="mb-3">Businesses listed on FixFlow operate independently.</p>
          <p className="mb-3">FixFlow:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>does not guarantee the quality of any service</li>
            <li>is not responsible for disputes between customers and businesses</li>
            <li>does not guarantee appointment availability</li>
            <li>does not guarantee pricing or warranties offered by businesses</li>
          </ul>
          <p className="mt-3">Customers contract directly with the business providing the service.</p>
        </Section>

        <Section title="5. Payments">
          <p>Payments may be processed through third-party providers including Stripe.</p>
          <p className="mt-3">
            Businesses authorize FixFlow to collect platform fees and any agreed marketplace commissions.
          </p>
          <p className="mt-3">
            FixFlow does not hold customer funds beyond what is required to facilitate payment processing.
          </p>
        </Section>

        <Section title="6. AI Features">
          <p>FixFlow includes AI-powered features designed to assist businesses and customers.</p>
          <p className="mt-3">
            AI-generated responses, recommendations, summaries, marketing content, or business insights are provided
            for informational purposes only.
          </p>
          <p className="mt-3">
            Businesses remain responsible for reviewing AI-generated content before relying upon or sending it to
            customers.
          </p>
          <p className="mt-3">FixFlow does not guarantee the accuracy or completeness of AI-generated content.</p>
        </Section>

        <Section title="7. SMS &amp; Email Communications">
          <p className="mb-3">
            By providing your phone number or email address, you consent to receive communications related to your
            account and transactions.
          </p>
          <p className="mb-3">These communications may include:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
            <li>appointment confirmations</li>
            <li>appointment reminders</li>
            <li>invoices</li>
            <li>payment receipts</li>
            <li>service updates</li>
            <li>account notifications</li>
            <li>login verification codes</li>
            <li>customer support messages</li>
            <li>AI-assisted follow-ups</li>
          </ul>
          <p className="mb-3">
            If you separately opt in to marketing messages, you may also receive promotional offers and reminders from
            businesses using FixFlow.
          </p>
          <p>You may opt out of marketing SMS at any time by replying STOP.</p>
          <p className="mt-3">Reply HELP for assistance.</p>
          <p className="mt-3">Message and data rates may apply.</p>
        </Section>

        <Section title="8. Business Responsibilities">
          <p className="mb-3">Businesses using FixFlow agree to:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>comply with all applicable laws</li>
            <li>obtain all required licenses</li>
            <li>maintain appropriate insurance where required</li>
            <li>obtain customer consent before sending marketing communications</li>
            <li>comply with TCPA, CAN-SPAM, and applicable privacy laws</li>
            <li>maintain accurate business information</li>
          </ul>
          <p className="mt-3">Businesses are solely responsible for services provided to customers.</p>
        </Section>

        <Section title="9. Customer Responsibilities">
          <p className="mb-3">Customers agree to:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>provide accurate booking information</li>
            <li>arrive for scheduled appointments</li>
            <li>comply with business cancellation policies</li>
            <li>treat businesses respectfully</li>
          </ul>
        </Section>

        <Section title="10. Prohibited Uses">
          <p className="mb-3">You may not:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>violate any law</li>
            <li>upload malicious software</li>
            <li>interfere with platform operations</li>
            <li>impersonate another person</li>
            <li>send spam</li>
            <li>misuse AI features</li>
            <li>attempt unauthorized access</li>
            <li>scrape or copy platform content without permission</li>
          </ul>
        </Section>

        <Section title="11. Intellectual Property">
          <p>
            FixFlow and all related software, trademarks, logos, AI systems, and content are owned by Repaircoin, Inc.
          </p>
          <p className="mt-3">No rights are granted except those necessary to use the Services.</p>
        </Section>

        <Section title="12. Privacy">
          <p>
            Your use of the Services is also governed by the{" "}
            <a href="/privacy-policy" className="text-[#FFCC00] hover:underline">
              FixFlow Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="13. Availability">
          <p>We strive to provide reliable service but do not guarantee uninterrupted availability.</p>
          <p className="mt-3">
            Maintenance, upgrades, outages, or third-party failures may temporarily affect the Services.
          </p>
        </Section>

        <Section title="14. Limitation of Liability">
          <p>
            To the fullest extent permitted by law, FixFlow, Repaircoin, Inc., its officers, employees, and affiliates
            shall not be liable for indirect, incidental, special, consequential, or punitive damages arising from your
            use of the Services.
          </p>
          <p className="mt-3">
            Our total liability shall not exceed the amount you paid to FixFlow during the twelve (12) months preceding
            the event giving rise to the claim.
          </p>
        </Section>

        <Section title="15. Indemnification">
          <p className="mb-3">
            You agree to defend, indemnify, and hold harmless Repaircoin, Inc. and FixFlow from claims arising out of:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>your use of the Services</li>
            <li>your violation of these Terms</li>
            <li>services you provide to customers</li>
            <li>your violation of applicable law</li>
          </ul>
        </Section>

        <Section title="16. Termination">
          <p className="mb-3">We may suspend or terminate accounts that:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>violate these Terms</li>
            <li>engage in fraudulent activity</li>
            <li>misuse the platform</li>
            <li>fail to pay applicable fees</li>
          </ul>
          <p className="mt-3">You may close your account at any time.</p>
        </Section>

        <Section title="17. Changes to These Terms">
          <p>We may update these Terms periodically.</p>
          <p className="mt-3">Material changes will be communicated through the platform or by email.</p>
          <p className="mt-3">Continued use of the Services constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section title="18. Governing Law">
          <p>
            These Terms shall be governed by the laws of the State of Texas, without regard to its conflict of law
            principles.
          </p>
          <p className="mt-3">
            Any legal action relating to these Terms shall be brought in the state or federal courts located in Hidalgo
            County, Texas, unless otherwise required by law.
          </p>
        </Section>

        <Section title="19. Contact Us">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
            <p className="text-gray-300"><strong>Repaircoin, Inc.</strong></p>
            <p className="text-gray-300">Doing Business As: FixFlow</p>
            <p className="text-gray-300">
              Website:{" "}
              <a href="https://fixflow.ai" className="text-[#FFCC00] hover:underline">
                https://fixflow.ai
              </a>
            </p>
            <p className="text-gray-300">
              Email:{" "}
              <a href="mailto:admin@repaircoin.ai" className="text-[#FFCC00] hover:underline">
                admin@repaircoin.ai
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
