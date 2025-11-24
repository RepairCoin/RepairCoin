'use client'

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Footer = React.memo(() => {
  const socialLinks = [
    {
      name: "twitter",
      link: "https://x.com/Repaircoin2025",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    {
      name: "facebook",
      link: "https://web.facebook.com/repaircoin/",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    }
  ]

  return (
    <footer className="bg-[#101010] text-white border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Logo and Description */}
          <div className="space-y-6">
            <div className="relative w-[180px] h-9">
              <Image
                src="/img/nav-logo.png"
                alt="RepairCoin Logo"
                fill
                sizes="180px"
                className="object-contain object-left"
              />
            </div>
            <p className="text-gray-300 text-base leading-relaxed">
              Connecting shops and customers through tokenized loyalty — one repair at a time.
            </p>
            <div>
              <p className="text-gray-300 text-base mb-4">
                Join the RepairCoin Network
              </p>
              <div className="flex items-center gap-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-6 h-6 flex items-center justify-center text-white hover:text-[#ffcc00] transition-colors"
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Explore Links */}
          <div>
            <h3 className="text-xl font-bold text-white mb-6">Explore</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/about" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  About RepairCoin
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  About US
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* For Shops Links */}
          <div>
            <h3 className="text-xl font-bold text-white mb-6">For Shops</h3>
            <ul className="space-y-4">
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Partner Tiers
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Governance (RCG)
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Onboarding Guide
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Terms and Conditions
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-xl font-bold text-white mb-6">Support</h3>
            <ul className="space-y-4">
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  FAQs
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link href="#" className="text-base text-white hover:text-[#ffcc00] transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 pt-8">
          <p className="text-center text-gray-500 text-base">
            © 2025 - FixFlow.ai | All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
