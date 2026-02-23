"use client";

import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { ReactNode, useEffect } from "react";

interface RecaptchaProviderProps {
  children: ReactNode;
}

export function RecaptchaProvider({ children }: RecaptchaProviderProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  useEffect(() => {
    if (!siteKey) {
      console.warn(
        "NEXT_PUBLIC_RECAPTCHA_SITE_KEY not configured. CAPTCHA will be disabled.",
      );
    }
  }, []);

  // If no site key is configured, render children without CAPTCHA
  if (!siteKey) {
    return <>{children}</>;
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={siteKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: "head",
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
