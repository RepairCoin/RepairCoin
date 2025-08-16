
import Section from "./Section";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: "Lorem 1",
      links: [
        { name: "Lorem", href: "#" },
        { name: "Lorem", href: "#" },
        { name: "Lorem", href: "#" },
        { name: "Lorem", href: "#" },
      ],
    },
    {
      title: "Lorem 2",
      links: [
        { name: "Lorem", href: "#" },
        { name: "Lorem", href: "#" },
        { name: "Lorem", href: "#" },
        { name: "Lorem", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Privacy Policy", href: "#" },
        { name: "Terms and Condition", href: "#" },
      ],
    },
  ];

  const paymentMethods = [
    { name: "Visa", icon: "/visa.svg" },
    { name: "Mastercard", icon: "/mastercard.svg" },
    { name: "PayPal", icon: "/paypal.svg" },
    { name: "Bitcoin", icon: "/bitcoin.svg" },
  ];

  const socialLinks = [
    {
      name: "twitter",
      link: "https://x.com/Repaircoin2025",
    },
    {
      name: "facebook",
      link: "https://web.facebook.com/repaircoin/",
    },
    {
      name: "instagram",
      link: "#",
    },
    {
      name: "linkedIn",
      link: "#",
    },
  ]

  return (
    <footer className="bg-[#0D0D0D] text-gray-300">
      <Section>
        <div className="container mx-auto px-4 py-12 md:py-16">
          {/* Top Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Logo and Description */}
            <div className="md:col-span-2 w-full md:w-[40%]">
              <div className="flex flex-col items-center md:items-start space-x-3 mb-8">
                <div>
                  <img
                    src="/img/community-logo.png"
                    alt="RepairCoin Logo"
                    className="h-10 w-auto"
                  />
                </div>
                <span className="text-[#FFCC00] text-sm font-medium">
                  The Repair Industry’s Loyalty Token
                </span>
              </div>
              <p className="text-gray-400 text-center md:text-left mb-6">
                Follow our Social Media for more news and be updated to our
                promos!{" "}
              </p>
              <div className="flex space-x-4 justify-center md:justify-start">
                {socialLinks.map(
                  (social) => (
                    <a
                      key={social.name}
                      href={social.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-[#FFCC00] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center">
                        <span className="text-xl">
                          {social.name === "twitter"
                            ? "𝕏"
                            : social.name === "facebook"
                            ? "f"
                            : social.name === "instagram"
                            ? "📸"
                            : "in"}
                        </span>
                      </div>
                    </a>
                  )
                )}
              </div>
            </div>

            {/* Footer Links */}
            {/* {footerLinks.map((section) => (
              <div key={section.title} className="hidden md:block">
                <h3 className="text-white font-semibold text-lg mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <Link
                        href={link.href}
                        className="text-gray-400 hover:text-[#FFCC00] transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))} */}
          </div>

          {/* Bottom Section */}
          <div className="pt-8">
            <div className="flex flex-col md:flex-row justify-center items-center">
              <p className="text-gray-400 text-sm mb-4 md:mb-0">
                RepairCoin © 2025 All Rights Reserved
              </p>
            </div>
          </div>
        </div>
      </Section>
    </footer>
  );
};

export default Footer;
