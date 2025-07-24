"use client";

import Image from "next/image";
import Link from "next/link";
import Section from "./Section";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: "Company",
      links: [
        { name: "About Us", href: "#" },
        { name: "Careers", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Press", href: "#" },
      ],
    },
    {
      title: "Support",
      links: [
        { name: "Help Center", href: "#" },
        { name: "Contact Us", href: "#" },
        { name: "Privacy Policy", href: "#" },
        { name: "Terms of Service", href: "#" },
      ],
    },
    {
      title: "Connect",
      links: [
        { name: "Twitter", href: "#" },
        { name: "Facebook", href: "#" },
        { name: "Instagram", href: "#" },
        { name: "LinkedIn", href: "#" },
      ],
    },
  ];

  const paymentMethods = [
    { name: "Visa", icon: "/visa.svg" },
    { name: "Mastercard", icon: "/mastercard.svg" },
    { name: "PayPal", icon: "/paypal.svg" },
    { name: "Bitcoin", icon: "/bitcoin.svg" },
  ];

  return (
    <footer className="bg-[#000000] text-gray-300">
      <Section>
        <div className="container mx-auto px-4 py-12 md:py-16">
          {/* Top Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Logo and Description */}
            <div className="md:col-span-2 w-full md:w-[40%]">
              <div className="flex flex-col items-center md:items-start space-x-3 mb-8">
                <div>
                  <img
                    src="/community-logo.png"
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
                {["twitter", "facebook", "instagram", "linkedin"].map(
                  (social) => (
                    <a
                      key={social}
                      href="#"
                      className="text-gray-400 hover:text-[#FFCC00] transition-colors"
                      aria-label={social}
                    >
                      <span className="sr-only">{social}</span>
                      <div className="w-10 h-10 rounded-full  flex items-center justify-center">
                        <span className="text-xl">
                          {social === "twitter"
                            ? "𝕏"
                            : social === "facebook"
                            ? "f"
                            : social === "instagram"
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
            {footerLinks.map((section) => (
              <div key={section.title} className="hidden md:block">
                <h3 className="text-white font-semibold text-lg mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.name}>
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
            ))}
          </div>

          <div className="hidden md:flex flex-col md:flex-row justify-end items-center">
            {/* visa */}
            <svg
              width="66"
              height="49"
              viewBox="0 0 66 49"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g filter="url(#filter0_dd_2151_3092)">
                <rect
                  x="9.30469"
                  y="5"
                  width="46.6143"
                  height="30.0304"
                  rx="5.37857"
                  fill="white"
                />
                <rect
                  x="9.19263"
                  y="4.88795"
                  width="46.8384"
                  height="30.2545"
                  rx="5.49062"
                  stroke="#D6DCE5"
                  strokeWidth="0.224107"
                />
                <path
                  d="M32.3269 15.121L30.1527 25.2845H27.5236L29.6981 15.121H32.3269ZM43.3886 21.6836L44.7728 17.8669L45.5693 21.6836H43.3886ZM46.322 25.2845H48.7539L46.6318 15.121H44.3871C43.8827 15.121 43.4571 15.4144 43.2677 15.8667L39.3232 25.2845H42.0842L42.6323 23.7668H46.0055L46.322 25.2845ZM39.4602 21.9661C39.4715 19.2836 35.7506 19.1359 35.7763 17.9376C35.784 17.5725 36.1318 17.1852 36.8913 17.0858C37.2686 17.0366 38.306 16.999 39.484 17.541L39.9453 15.3857C39.3126 15.1561 38.4984 14.9351 37.4857 14.9351C34.8872 14.9351 33.0581 16.3167 33.0427 18.295C33.0263 19.758 34.3484 20.5745 35.3446 21.0609C36.3689 21.5591 36.7131 21.8782 36.7086 22.3238C36.7018 23.0061 35.8915 23.3065 35.1355 23.3184C33.8134 23.3393 33.0462 22.9617 32.4347 22.6767L31.9583 24.9037C32.5724 25.1858 33.7063 25.4309 34.8827 25.4435C37.6443 25.4435 39.4512 24.0789 39.4602 21.9661ZM28.57 15.121L24.3103 25.2845H21.5306L19.4346 17.1733C19.3072 16.6738 19.1965 16.491 18.8095 16.2803C18.1781 15.9377 17.1342 15.6157 16.2158 15.4163L16.2785 15.121H20.7522C21.3222 15.121 21.8353 15.5006 21.9646 16.1571L23.0718 22.0388L25.8077 15.121H28.57Z"
                  fill="#1434CB"
                />
              </g>
              <defs>
                <filter
                  id="filter0_dd_2151_3092"
                  x="0.116769"
                  y="0.293736"
                  width="64.9911"
                  height="48.4071"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="0.448214" />
                  <feGaussianBlur stdDeviation="2.24107" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="BackgroundImageFix"
                    result="effect1_dropShadow_2151_3092"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="4.48214" />
                  <feGaussianBlur stdDeviation="4.48214" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="effect1_dropShadow_2151_3092"
                    result="effect2_dropShadow_2151_3092"
                  />
                  <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="effect2_dropShadow_2151_3092"
                    result="shape"
                  />
                </filter>
              </defs>
            </svg>

            {/* mastercard */}
            <svg
              width="66"
              height="49"
              viewBox="0 0 66 49"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g filter="url(#filter0_dd_2151_3094)">
                <rect
                  x="9.91895"
                  y="5"
                  width="46.6143"
                  height="30.0304"
                  rx="5.37857"
                  fill="white"
                />
                <rect
                  x="9.80689"
                  y="4.88795"
                  width="46.8384"
                  height="30.2545"
                  rx="5.49062"
                  stroke="#D6DCE5"
                  strokeWidth="0.224107"
                />
                <path
                  d="M36.5747 13.8484H29.7114V26.1819H36.5747V13.8484Z"
                  fill="#FF5F00"
                />
                <path
                  d="M30.1473 20.0151C30.1462 18.8273 30.4153 17.6548 30.9344 16.5864C31.4534 15.518 32.2087 14.5817 33.1431 13.8484C31.986 12.9389 30.5963 12.3732 29.133 12.2162C27.6696 12.0591 26.1915 12.3169 24.8678 12.9602C23.544 13.6034 22.4279 14.6061 21.6471 15.8537C20.8662 17.1013 20.4521 18.5434 20.4521 20.0151C20.4521 21.4869 20.8662 22.929 21.6471 24.1766C22.4279 25.4241 23.544 26.4269 24.8678 27.0701C26.1915 27.7133 27.6696 27.9712 29.133 27.8141C30.5963 27.657 31.986 27.0914 33.1431 26.1819C32.2087 25.4485 31.4534 24.5122 30.9344 23.4438C30.4154 22.3754 30.1462 21.2029 30.1473 20.0151Z"
                  fill="#EB001B"
                />
                <path
                  d="M45.8337 20.0151C45.8337 21.4869 45.4197 22.929 44.6389 24.1765C43.8581 25.4241 42.742 26.4268 41.4183 27.0701C40.0946 27.7133 38.6165 27.9712 37.1532 27.8141C35.6898 27.657 34.3002 27.0914 33.1431 26.1819C34.0767 25.4478 34.8314 24.5113 35.3503 23.4431C35.8693 22.3749 36.1389 21.2028 36.1389 20.0151C36.1389 18.8275 35.8693 17.6554 35.3503 16.5872C34.8314 15.5189 34.0767 14.5825 33.1431 13.8484C34.3002 12.9389 35.6898 12.3732 37.1532 12.2162C38.6165 12.0591 40.0946 12.3169 41.4183 12.9602C42.742 13.6034 43.8581 14.6062 44.6389 15.8537C45.4197 17.1013 45.8337 18.5434 45.8337 20.0151Z"
                  fill="#F79E1B"
                />
                <path
                  d="M45.0854 24.8756V24.6231H45.1872V24.5716H44.9279V24.6231H45.0297V24.8756H45.0854ZM45.5888 24.8756V24.5711H45.5093L45.4179 24.7805L45.3264 24.5711H45.2469V24.8756H45.303V24.6459L45.3887 24.8439H45.4469L45.5327 24.6454V24.8756H45.5888Z"
                  fill="#F79E1B"
                />
              </g>
              <defs>
                <filter
                  id="filter0_dd_2151_3094"
                  x="0.731027"
                  y="0.293736"
                  width="64.9911"
                  height="48.4071"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="0.448214" />
                  <feGaussianBlur stdDeviation="2.24107" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="BackgroundImageFix"
                    result="effect1_dropShadow_2151_3094"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="4.48214" />
                  <feGaussianBlur stdDeviation="4.48214" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="effect1_dropShadow_2151_3094"
                    result="effect2_dropShadow_2151_3094"
                  />
                  <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="effect2_dropShadow_2151_3094"
                    result="shape"
                  />
                </filter>
              </defs>
            </svg>

            {/* paypal */}
            <svg
              width="66"
              height="49"
              viewBox="0 0 66 49"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g filter="url(#filter0_dd_2151_3096)">
                <rect
                  x="9.5332"
                  y="5"
                  width="46.6143"
                  height="30.0304"
                  rx="5.37857"
                  fill="white"
                />
                <rect
                  x="9.42115"
                  y="4.88795"
                  width="46.8384"
                  height="30.2545"
                  rx="5.49062"
                  stroke="#D6DCE5"
                  strokeWidth="0.224107"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M19.7303 15.646H17.0428C16.8589 15.646 16.7024 15.7796 16.6738 15.9611L15.5868 22.8518C15.5652 22.9879 15.6705 23.1104 15.8084 23.1104H17.0915C17.2754 23.1104 17.4318 22.9768 17.4605 22.7949L17.7536 20.9364C17.7819 20.7544 17.9387 20.6209 18.1222 20.6209H18.973C20.7434 20.6209 21.765 19.7643 22.032 18.0669C22.1522 17.3243 22.0371 16.7408 21.6892 16.332C21.3073 15.8835 20.6297 15.646 19.7303 15.646ZM20.0403 18.1627C19.8934 19.127 19.1565 19.127 18.4441 19.127H18.0385L18.3231 17.3261C18.3399 17.2174 18.4343 17.1372 18.5443 17.1372H18.7302C19.2155 17.1372 19.6733 17.1372 19.9099 17.4138C20.0509 17.5789 20.0941 17.824 20.0403 18.1627ZM27.7638 18.1318H26.4769C26.3672 18.1318 26.2725 18.212 26.2555 18.3209L26.1986 18.6808L26.1086 18.5504C25.83 18.146 25.2088 18.0109 24.5887 18.0109C23.1664 18.0109 21.9518 19.0879 21.7152 20.5988C21.5923 21.3523 21.767 22.0729 22.1946 22.5755C22.5868 23.0375 23.148 23.2301 23.8156 23.2301C24.9615 23.2301 25.597 22.4933 25.597 22.4933L25.5396 22.8509C25.5179 22.9877 25.6232 23.1102 25.7604 23.1102H26.9197C27.1041 23.1102 27.2596 22.9766 27.2887 22.7948L27.9842 18.3904C28.0062 18.2549 27.9013 18.1318 27.7638 18.1318ZM25.9698 20.6364C25.8456 21.3715 25.2621 21.865 24.5179 21.865C24.1442 21.865 23.8454 21.7452 23.6538 21.5181C23.4635 21.2926 23.3912 20.9715 23.4517 20.614C23.5677 19.8851 24.1611 19.3756 24.894 19.3756C25.2593 19.3756 25.5565 19.4968 25.7522 19.726C25.9482 19.9574 26.026 20.2804 25.9698 20.6364ZM33.3248 18.1317H34.6181C34.7992 18.1317 34.9049 18.3348 34.802 18.4833L30.5006 24.6914C30.4309 24.792 30.3162 24.8518 30.1936 24.8518H28.9019C28.72 24.8518 28.6138 24.6471 28.7191 24.4982L30.0585 22.6078L28.634 18.4279C28.5847 18.2826 28.692 18.1317 28.8466 18.1317H30.1174C30.2825 18.1317 30.4282 18.24 30.4758 18.398L31.2318 20.9226L33.0156 18.2955C33.0854 18.1929 33.2015 18.1317 33.3248 18.1317Z"
                  fill="#253B80"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M47.3473 22.8512L48.4503 15.8345C48.4672 15.7256 48.5616 15.6454 48.6712 15.645H49.9129C50.05 15.645 50.1553 15.7679 50.1337 15.9039L49.046 22.7943C49.0176 22.9762 48.8612 23.1098 48.677 23.1098H47.5681C47.431 23.1098 47.3257 22.9872 47.3473 22.8512ZM38.9004 15.6454H36.2124C36.0289 15.6454 35.8725 15.779 35.8438 15.9605L34.7568 22.8512C34.7352 22.9872 34.8405 23.1098 34.9778 23.1098H36.357C36.4852 23.1098 36.5948 23.0163 36.6148 22.8891L36.9233 20.9358C36.9516 20.7538 37.1084 20.6203 37.2919 20.6203H38.1422C39.9129 20.6203 40.9344 19.7637 41.2016 18.0663C41.3221 17.3237 41.2063 16.7402 40.8586 16.3314C40.4769 15.8829 39.7998 15.6454 38.9004 15.6454ZM39.2104 18.1621C39.0639 19.1264 38.327 19.1264 37.6141 19.1264H37.2089L37.4939 17.3255C37.5108 17.2168 37.6043 17.1366 37.7147 17.1366H37.9005C38.3855 17.1366 38.8438 17.1366 39.0802 17.4132C39.2213 17.5783 39.2643 17.8234 39.2104 18.1621ZM46.9332 18.1312H45.6472C45.5366 18.1312 45.4428 18.2114 45.4262 18.3203L45.3693 18.6802L45.2789 18.5498C45.0003 18.1454 44.3795 18.0103 43.7593 18.0103C42.337 18.0103 41.1228 19.0873 40.8862 20.5981C40.7636 21.3517 40.9377 22.0723 41.3652 22.5748C41.7582 23.0369 42.3187 23.2294 42.9863 23.2294C44.1321 23.2294 44.7675 22.4927 44.7675 22.4927L44.7102 22.8503C44.6886 22.9871 44.7939 23.1096 44.9319 23.1096H46.0907C46.2742 23.1096 46.4306 22.976 46.4593 22.7941L47.1553 18.3898C47.1765 18.2543 47.0713 18.1312 46.9332 18.1312ZM45.1394 20.6358C45.0159 21.3709 44.4316 21.8644 43.6873 21.8644C43.3143 21.8644 43.015 21.7446 42.8231 21.5175C42.6329 21.292 42.5615 20.9709 42.6213 20.6134C42.7379 19.8845 43.3305 19.375 44.0634 19.375C44.4289 19.375 44.7259 19.4962 44.9217 19.7253C45.1185 19.9568 45.1963 20.2798 45.1394 20.6358Z"
                  fill="#179BD7"
                />
              </g>
              <defs>
                <filter
                  id="filter0_dd_2151_3096"
                  x="0.345284"
                  y="0.293736"
                  width="64.9911"
                  height="48.4071"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="0.448214" />
                  <feGaussianBlur stdDeviation="2.24107" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="BackgroundImageFix"
                    result="effect1_dropShadow_2151_3096"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="4.48214" />
                  <feGaussianBlur stdDeviation="4.48214" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="effect1_dropShadow_2151_3096"
                    result="effect2_dropShadow_2151_3096"
                  />
                  <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="effect2_dropShadow_2151_3096"
                    result="shape"
                  />
                </filter>
              </defs>
            </svg>

            {/* ipay */}
            <svg
              width="66"
              height="49"
              viewBox="0 0 66 49"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g filter="url(#filter0_dd_2151_3098)">
                <rect
                  x="10.1475"
                  y="5"
                  width="46.6143"
                  height="30.0304"
                  rx="5.37857"
                  fill="white"
                />
                <rect
                  x="10.0354"
                  y="4.88795"
                  width="46.8384"
                  height="30.2545"
                  rx="5.49062"
                  stroke="#D6DCE5"
                  strokeWidth="0.224107"
                />
                <path
                  d="M25.2247 16.0817C25.5357 15.6927 25.7467 15.1704 25.6911 14.6367C25.2358 14.6594 24.6803 14.9371 24.3587 15.3264C24.0699 15.6597 23.8143 16.2039 23.8809 16.7152C24.3919 16.7595 24.9025 16.4598 25.2247 16.0817Z"
                  fill="#000008"
                />
                <path
                  d="M25.6853 16.8151C24.9431 16.7709 24.3121 17.2363 23.9577 17.2363C23.6031 17.2363 23.0604 16.8373 22.4734 16.8481C21.7094 16.8593 21.0004 17.2913 20.6127 17.9784C19.8153 19.3528 20.4023 21.3916 21.1778 22.511C21.5543 23.0648 22.0082 23.6746 22.6062 23.6527C23.1713 23.6305 23.3927 23.2868 24.0795 23.2868C24.7659 23.2868 24.9654 23.6527 25.5635 23.6416C26.1837 23.6305 26.5715 23.0875 26.9481 22.5332C27.3801 21.9019 27.557 21.2923 27.5681 21.2588C27.557 21.2477 26.372 20.7932 26.3611 19.4302C26.3499 18.2889 27.2914 17.746 27.3357 17.7123C26.804 16.926 25.9733 16.8373 25.6853 16.8151Z"
                  fill="#000008"
                />
                <path
                  d="M32.1474 15.2705C33.7604 15.2705 34.8836 16.3824 34.8836 18.0013C34.8836 19.6259 33.7373 20.7435 32.1069 20.7435H30.3209V23.5837H29.0306V15.2705L32.1474 15.2705ZM30.3209 19.6604H31.8015C32.925 19.6604 33.5644 19.0556 33.5644 18.007C33.5644 16.9586 32.925 16.3594 31.8073 16.3594H30.3209V19.6604Z"
                  fill="#000008"
                />
                <path
                  d="M35.2208 21.8612C35.2208 20.8011 36.0331 20.1501 37.4734 20.0695L39.1325 19.9716V19.505C39.1325 18.8309 38.6773 18.4276 37.917 18.4276C37.1967 18.4276 36.7474 18.7732 36.638 19.3148H35.4628C35.5319 18.2201 36.4651 17.4136 37.963 17.4136C39.4321 17.4136 40.3711 18.1914 40.3711 19.4069V23.5837H39.1785V22.5871H39.1498C38.7985 23.2611 38.0322 23.6874 37.2372 23.6874C36.0504 23.6874 35.2208 22.95 35.2208 21.8612ZM39.1325 21.3139V20.8358L37.6403 20.9279C36.8972 20.9798 36.4767 21.3081 36.4767 21.8266C36.4767 22.3566 36.9145 22.7023 37.5828 22.7023C38.4527 22.7023 39.1325 22.1031 39.1325 21.3139Z"
                  fill="#000008"
                />
                <path
                  d="M41.497 25.8133V24.8051C41.589 24.8281 41.7963 24.8281 41.9001 24.8281C42.4762 24.8281 42.7873 24.5861 42.9773 23.964C42.9773 23.9524 43.0869 23.5953 43.0869 23.5895L40.8978 17.5231H42.2457L43.7783 22.4546H43.8012L45.3338 17.5231H46.6473L44.3773 23.9005C43.859 25.3697 43.2598 25.8421 42.0039 25.8421C41.9001 25.8421 41.589 25.8305 41.497 25.8133Z"
                  fill="#000008"
                />
              </g>
              <defs>
                <filter
                  id="filter0_dd_2151_3098"
                  x="0.959542"
                  y="0.293736"
                  width="64.9911"
                  height="48.4071"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="0.448214" />
                  <feGaussianBlur stdDeviation="2.24107" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="BackgroundImageFix"
                    result="effect1_dropShadow_2151_3098"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="4.48214" />
                  <feGaussianBlur stdDeviation="4.48214" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="effect1_dropShadow_2151_3098"
                    result="effect2_dropShadow_2151_3098"
                  />
                  <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="effect2_dropShadow_2151_3098"
                    result="shape"
                  />
                </filter>
              </defs>
            </svg>

            {/* gpay */}
            <svg
              width="66"
              height="49"
              viewBox="0 0 66 49"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g filter="url(#filter0_dd_2151_3100)">
                <rect
                  x="9.76172"
                  y="5"
                  width="46.6143"
                  height="30.0304"
                  rx="5.37857"
                  fill="white"
                />
                <rect
                  x="9.64967"
                  y="4.88795"
                  width="46.8384"
                  height="30.2545"
                  rx="5.49062"
                  stroke="#D6DCE5"
                  strokeWidth="0.224107"
                />
                <path
                  d="M32.0552 23.6143H31.0067V15.4561H33.7862C34.4906 15.4561 35.0913 15.6909 35.5827 16.1605C36.0851 16.6301 36.3363 17.2035 36.3363 17.8806C36.3363 18.5741 36.0851 19.1475 35.5827 19.6116C35.0967 20.0758 34.4961 20.3051 33.7862 20.3051H32.0552V23.6143ZM32.0552 16.4608V19.3058H33.808C34.223 19.3058 34.5725 19.1639 34.8456 18.8854C35.124 18.6069 35.266 18.2683 35.266 17.8861C35.266 17.5093 35.124 17.1762 34.8456 16.8977C34.5725 16.6083 34.2285 16.4663 33.808 16.4663H32.0552V16.4608Z"
                  fill="#3C4043"
                />
                <path
                  d="M39.0774 17.8478C39.8529 17.8478 40.4645 18.0553 40.9122 18.4703C41.36 18.8854 41.5839 19.4533 41.5839 20.1741V23.6143H40.5846V22.8389H40.5409C40.1095 23.4778 39.5307 23.7945 38.8099 23.7945C38.1928 23.7945 37.6795 23.6143 37.2645 23.2484C36.8495 22.8826 36.642 22.4293 36.642 21.8833C36.642 21.3044 36.8604 20.8457 37.2973 20.5072C37.7341 20.1632 38.3184 19.9939 39.0447 19.9939C39.6672 19.9939 40.1805 20.1085 40.5791 20.3379V20.0976C40.5791 19.7318 40.4371 19.426 40.1477 19.1693C39.8583 18.9127 39.5198 18.7871 39.1321 18.7871C38.5478 18.7871 38.0836 19.0328 37.745 19.5297L36.8222 18.9509C37.33 18.2137 38.0836 17.8478 39.0774 17.8478ZM37.7232 21.8996C37.7232 22.1727 37.8379 22.402 38.0727 22.5822C38.302 22.7624 38.5751 22.8553 38.8863 22.8553C39.3286 22.8553 39.7218 22.6914 40.0658 22.3638C40.4098 22.0362 40.5846 21.6539 40.5846 21.2116C40.2569 20.955 39.8037 20.8239 39.2194 20.8239C38.7935 20.8239 38.4385 20.9276 38.1546 21.1297C37.8652 21.3427 37.7232 21.5993 37.7232 21.8996Z"
                  fill="#3C4043"
                />
                <path
                  d="M47.2849 18.0281L43.79 26.0662H42.7088L44.0085 23.2539L41.7041 18.0281H42.8454L44.5054 22.0362H44.5272L46.1436 18.0281H47.2849Z"
                  fill="#3C4043"
                />
                <path
                  d="M27.8848 19.6444C27.8848 19.3026 27.8542 18.9755 27.7974 18.6609H23.4027V20.4629L25.9337 20.4635C25.831 21.0631 25.5007 21.5742 24.9945 21.9149V23.0841H26.5011C27.3808 22.2699 27.8848 21.0664 27.8848 19.6444Z"
                  fill="#4285F4"
                />
                <path
                  d="M24.995 21.915C24.5756 22.1979 24.0356 22.3633 23.4038 22.3633C22.1833 22.3633 21.148 21.5409 20.7772 20.4324H19.2231V21.6381C19.993 23.166 21.5755 24.2145 23.4038 24.2145C24.6674 24.2145 25.7289 23.7989 26.5016 23.0836L24.995 21.915Z"
                  fill="#34A853"
                />
                <path
                  d="M20.6308 19.5379C20.6308 19.2266 20.6827 18.9258 20.7772 18.6429V17.4372H19.2231C18.9047 18.069 18.7256 18.7821 18.7256 19.5379C18.7256 20.2937 18.9052 21.0068 19.2231 21.6386L20.7772 20.4329C20.6827 20.15 20.6308 19.8492 20.6308 19.5379Z"
                  fill="#FABB05"
                />
                <path
                  d="M23.4038 16.712C24.0934 16.712 24.711 16.9495 25.1987 17.4137L26.5338 16.0797C25.7229 15.3245 24.6657 14.8608 23.4038 14.8608C21.5761 14.8608 19.993 15.9093 19.2231 17.4372L20.7772 18.6429C21.1479 17.5344 22.1833 16.712 23.4038 16.712Z"
                  fill="#E94235"
                />
              </g>
              <defs>
                <filter
                  id="filter0_dd_2151_3100"
                  x="0.5738"
                  y="0.293736"
                  width="64.9911"
                  height="48.4071"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="0.448214" />
                  <feGaussianBlur stdDeviation="2.24107" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="BackgroundImageFix"
                    result="effect1_dropShadow_2151_3100"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="4.48214" />
                  <feGaussianBlur stdDeviation="4.48214" />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0 0.717647 0 0 0 0.08 0"
                  />
                  <feBlend
                    mode="normal"
                    in2="effect1_dropShadow_2151_3100"
                    result="effect2_dropShadow_2151_3100"
                  />
                  <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="effect2_dropShadow_2151_3100"
                    result="shape"
                  />
                </filter>
              </defs>
            </svg>
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
