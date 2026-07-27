import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Messaging Policy - FixFlow",
  description:
    "How FixFlow sends SMS text messages, how you opt in and out, and how we handle your mobile number.",
};

// SMS Messaging Policy — the page Twilio's toll-free verification points at for the opt-in workflow
// (reason code 30498). Every section here is a Twilio requirement: program name, message types,
// opt-in method, frequency, rates disclosure, STOP/HELP, and the no-third-party-sharing statement.
// Content mirrors the canonical use-case + CTA copy in
// docs/tasks/strategy/twilio-tollfree-verification-compliance.md. LEGAL: copy pending sign-off.
export default function SmsPolicyPage() {
  const effectiveDate = "July 27, 2026";

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">SMS Messaging Policy</h1>
          <p className="text-gray-400">Effective Date: {effectiveDate}</p>
        </div>

        <div className="mb-10 text-gray-400 leading-relaxed">
          <p>
            This SMS Messaging Policy explains how FixFlow (operated by Repaircoin, Inc.) sends text
            messages, how you give and withdraw consent, and how we handle your mobile number. It
            applies to the FixFlow platform, websites, and mobile applications.
          </p>
        </div>

        <Section title="Messages we send">
          <p>
            With your consent, FixFlow sends transactional text messages related to the services you
            book through businesses on our platform:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Appointment confirmations</li>
            <li>Appointment reminders</li>
            <li>Repair and service status updates</li>
            <li>Payment confirmations</li>
            <li>One-time verification codes</li>
            <li>Customer-support replies</li>
          </ul>
          <p className="mt-3">
            We send marketing or promotional text messages <strong>only</strong> to customers who have
            separately and explicitly opted in to marketing communications.
          </p>
        </Section>

        <Section title="How you opt in">
          <p>
            You opt in to SMS by checking the SMS consent box on FixFlow when you book a service or in
            your account settings. The box is not checked by default — consent is always an
            affirmative choice. Marketing messages require a separate, distinct opt-in.
          </p>
        </Section>

        <Section title="Message frequency & rates">
          <p>
            Message frequency varies based on your appointments and activity. Message and data rates
            may apply, depending on your mobile carrier and plan.
          </p>
        </Section>

        <Section title="Opting out & help">
          <p>
            You can opt out of SMS at any time by replying <strong>STOP</strong> to any message. You
            will receive one confirmation message and then no further texts unless you opt in again.
            Reply <strong>HELP</strong> for assistance, or contact us at{" "}
            <a href="mailto:admin@fixflow.ai" className="text-[#FFCC00] hover:underline">
              admin@fixflow.ai
            </a>
            .
          </p>
        </Section>

        <Section title="Your mobile number & privacy">
          <p>
            When you opt in to SMS, we use your mobile number only to send the messages you consented
            to. <strong>We do not sell or share your SMS opt-in, consent, or mobile number with any
            third party for their own marketing.</strong> See our{" "}
            <a href="/privacy-policy" className="text-[#FFCC00] hover:underline">
              Privacy Policy
            </a>{" "}
            for how we handle your information.
          </p>
        </Section>

        <Section title="Contact us">
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
              <a href="mailto:admin@fixflow.ai" className="text-[#FFCC00] hover:underline">
                admin@fixflow.ai
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
