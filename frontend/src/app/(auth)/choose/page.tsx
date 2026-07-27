"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useAuthStore } from "@/stores/authStore";
import { getApiBaseUrl } from "@/utils/apiUrl";
import Image from "next/image";
import { Store, UserRound } from "lucide-react";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

type CardShellProps = {
  children: React.ReactNode;
};

function CardShell({ children }: CardShellProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px] bg-[#101010] text-left">
      {children}
    </div>
  );
}

type RoleCardProps = {
  image: string;
  alt: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
};

function RoleCard({
  image,
  alt,
  icon,
  title,
  description,
  cta,
  onClick,
}: RoleCardProps) {
  return (
    <CardShell>
      <div className="relative aspect-[585/348] w-full shrink-0">
        <Image
          src={image}
          alt={alt}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 585px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-grow flex-col items-center px-6 pb-[50px] text-center">
        <div className="relative z-10 -mt-[35px] flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full border-2 border-[#FFCC00] bg-[#101010]">
          {icon}
        </div>
        <h2 className="mt-[5px] text-[28px] font-bold leading-[56px] tracking-[0.5253px] text-white md:text-[34px] md:leading-[72px]">
          {title}
        </h2>
        <p className="max-w-[450px] text-base leading-[1.5] tracking-[-0.32px] text-[#999999]">
          {description}
        </p>
        <button
          onClick={onClick}
          className="mt-10 h-12 w-full max-w-[416px] cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors duration-200 hover:bg-[#E5BB00]"
        >
          {cta}
        </button>
      </div>
    </CardShell>
  );
}

type StatusCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
  cta: string;
  onClick: () => void;
};

function StatusCard({
  icon,
  title,
  description,
  details,
  cta,
  onClick,
}: StatusCardProps) {
  return (
    <CardShell>
      <div className="flex h-full flex-col items-center px-6 py-[50px] text-center">
        <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full border-2 border-[#FFCC00] bg-[#101010]">
          {icon}
        </div>
        <h2 className="mt-4 text-[28px] font-bold leading-tight tracking-[0.5253px] text-white">
          {title}
        </h2>
        <p className="mt-3 max-w-[450px] text-base leading-[1.5] tracking-[-0.32px] text-[#999999]">
          {description}
        </p>
        {details && details.length > 0 && (
          <dl className="mt-6 w-full max-w-[416px] space-y-2 rounded-md border border-white/10 bg-white/5 p-4 text-left">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex items-center justify-between gap-4"
              >
                <dt className="text-sm text-[#999999]">{detail.label}</dt>
                <dd className="text-sm font-medium text-white">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <button
          onClick={onClick}
          className="mt-auto h-12 w-full max-w-[416px] cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors duration-200 hover:bg-[#E5BB00]"
        >
          {cta}
        </button>
      </div>
    </CardShell>
  );
}

function SkeletonCard({ title }: { title: string }) {
  return (
    <CardShell>
      <div className="relative aspect-[585/348] w-full shrink-0 animate-pulse bg-white/5">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#FFCC00]" />
        </div>
      </div>
      <div className="flex flex-grow flex-col items-center px-6 pb-[50px] text-center">
        <div className="relative z-10 -mt-[35px] h-[70px] w-[70px] shrink-0 rounded-full border-2 border-[#FFCC00] bg-[#101010]" />
        <h2 className="mt-[5px] text-[28px] font-bold leading-[56px] tracking-[0.5253px] text-white md:text-[34px] md:leading-[72px]">
          {title}
        </h2>
        <p className="max-w-[450px] text-base leading-[1.5] tracking-[-0.32px] text-[#999999]">
          Checking registration status...
        </p>
        <button
          disabled
          className="mt-10 h-12 w-full max-w-[416px] cursor-not-allowed rounded-md bg-white/10 text-base font-medium text-[#999999]"
        >
          Please wait...
        </button>
      </div>
    </CardShell>
  );
}

export default function ChoosePage() {
  const { account, isLoading } = useAuthStore();
  const activeAccount = useActiveAccount();
  const router = useRouter();
  const hasCheckedRef = useRef(false);
  const previousAccountRef = useRef<string | undefined>(undefined);
  const [shopApplicationStatus, setShopApplicationStatus] = useState<{
    hasApplication: boolean;
    status: "pending" | "verified" | "rejected" | null;
    shopName?: string;
  }>({ hasApplication: false, status: null });
  const [customerStatus, setCustomerStatus] = useState<{
    isRegistered: boolean;
    customerData?: any;
  }>({ isRegistered: false });
  const [checkingApplications, setCheckingApplications] = useState(false);

  // Check if wallet has existing registrations
  const checkExistingRegistrations = async (walletAddress: string) => {
    setCheckingApplications(true);
    try {
      // Check for shop application
      const shopResponse = await fetch(
        `${getApiBaseUrl()}/shops/wallet/${walletAddress}`
      );
      if (shopResponse.ok) {
        const shopData = await shopResponse.json();
        const shop = shopData.data;
        if (shop) {
          setShopApplicationStatus({
            hasApplication: true,
            status: shop.verified ? "verified" : "pending",
            shopName: shop.name,
          });
        }
      } else if (shopResponse.status === 404) {
        // No shop found - this is normal for new wallets
        setShopApplicationStatus({ hasApplication: false, status: null });
      }

      // Check for customer registration
      const customerResponse = await fetch(
        `${getApiBaseUrl()}/customers/${walletAddress}`
      );
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        setCustomerStatus({
          isRegistered: true,
          customerData: customerData.data,
        });
      } else if (customerResponse.status === 404) {
        // No customer found - this is normal for new wallets
        setCustomerStatus({ isRegistered: false });
      }
    } catch (error) {
      console.error("Error checking existing registrations:", error);
      // Don't show error to user, just assume no registrations
      setShopApplicationStatus({ hasApplication: false, status: null });
      setCustomerStatus({ isRegistered: false });
    } finally {
      setCheckingApplications(false);
    }
  };

  // Check for existing registrations when wallet connects
  // useEffect(() => {
  //   if (account?.address && !isAuthenticated) {
  //     console.log("Checking existing registrations for:", account.address);
  //     checkExistingRegistrations(account.address);
  //   } else {
  //     router.push("/");
  //   }
  // }, [account?.address, isAuthenticated]);

  // Check existing registrations when wallet connects via ConnectButton on this page
  useEffect(() => {
    if (activeAccount?.address) {
      // Check if this is a NEW connection (address changed from different address)
      const isNewConnection =
        previousAccountRef.current !== activeAccount.address &&
        previousAccountRef.current !== undefined &&
        !hasCheckedRef.current;

      // Initialize the ref on first render without triggering check
      if (previousAccountRef.current === undefined) {
        previousAccountRef.current = activeAccount.address;
        // On first render with existing connection, check registration
        console.log(
          "Checking existing registrations for:",
          activeAccount.address
        );
        checkExistingRegistrations(activeAccount.address);
        return;
      }

      if (isNewConnection) {
        hasCheckedRef.current = true;
        console.log(
          "New connection - Checking existing registrations for:",
          activeAccount.address
        );
        checkExistingRegistrations(activeAccount.address);
      }

      previousAccountRef.current = activeAccount.address;
    } else if (!activeAccount?.address && previousAccountRef.current) {
      // Reset refs when wallet disconnects
      previousAccountRef.current = undefined;
      hasCheckedRef.current = false;
    }
  }, [activeAccount?.address]);

  // Auto-redirect users who have already chosen their role
  useEffect(() => {
    // Only redirect after we've finished checking applications
    if (!checkingApplications && !isLoading) {
      if (customerStatus.isRegistered) {
        console.log(
          "Customer already registered, redirecting to customer dashboard"
        );
        router.push("/customer");
      } else if (
        shopApplicationStatus.hasApplication &&
        shopApplicationStatus.status === "verified"
      ) {
        console.log("Shop already verified, redirecting to shop dashboard");
        router.push("/shop?tab=profile");
      }
    }
  }, [
    checkingApplications,
    isLoading,
    customerStatus.isRegistered,
    shopApplicationStatus.hasApplication,
    shopApplicationStatus.status,
    router,
  ]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#191919]">
        <div className="w-full max-w-md rounded-[20px] bg-[#101010] p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#FFCC00]" />
          <h2 className="mb-2 text-xl font-semibold text-white">
            Loading FixFlow...
          </h2>
          <p className="text-[#999999]">Checking your authentication status</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#191919]">
        <div className="w-full max-w-md rounded-[20px] bg-[#101010] p-8 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-[#FFCC00] bg-[#101010]">
            <Store className="h-8 w-8 text-[#FFCC00]" strokeWidth={1.5} />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-white">
            Choose your role
          </h1>
          <p className="mb-8 text-[#999999]">
            Connect your wallet to choose your role
          </p>
          <div className="flex justify-center">
            <ConnectButton
              client={client}
              theme="dark"
              connectModal={{ size: "wide" }}
            />
          </div>
        </div>
      </div>
    );
  }

  const customerIcon = (
    <UserRound className="h-8 w-8 text-[#FFCC00]" strokeWidth={1.5} />
  );
  const shopIcon = <Store className="h-8 w-8 text-[#FFCC00]" strokeWidth={1.5} />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#191919]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[88px] h-[723px] bg-[url('/img/choose/hero-gradient.png')] bg-[length:100%_100%] bg-no-repeat"
      />

      <div className="relative mx-auto w-full max-w-[1230px] px-6 pb-24 pt-32 md:pt-[164px]">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-[40px] font-bold leading-tight tracking-[0.5253px] text-white md:text-[64px] md:leading-[72px]">
            Welcome to FixFlow
          </h1>
          <p className="mt-4 text-lg font-medium tracking-[0.2064px] text-white md:text-[22px] md:leading-[33px]">
            How would you like to get started?
          </p>
        </div>

        {/* Registration Options */}
        <div className="mt-[55px] grid grid-cols-1 gap-[60px] md:grid-cols-2">
          {/* Customer Registration */}
          {checkingApplications ? (
            <SkeletonCard title="Customer" />
          ) : customerStatus.isRegistered ? (
            <StatusCard
              icon={customerIcon}
              title="Already Registered"
              description="You're already registered as a customer in our network."
              details={[
                { label: "Customer status", value: "Active" },
                ...(customerStatus.customerData?.tier
                  ? [
                      {
                        label: "Current tier",
                        value: String(customerStatus.customerData.tier),
                      },
                    ]
                  : []),
              ]}
              cta="Go to Customer Dashboard →"
              onClick={() => router.push("/customer")}
            />
          ) : shopApplicationStatus.hasApplication ? (
            <StatusCard
              icon={customerIcon}
              title="Shop Application Found"
              description={`You have a ${
                shopApplicationStatus.status === "pending"
                  ? "pending"
                  : "verified"
              } shop application. You cannot register as both a customer and a shop with the same wallet.`}
              details={[
                ...(shopApplicationStatus.shopName
                  ? [
                      {
                        label: "Existing shop",
                        value: shopApplicationStatus.shopName,
                      },
                    ]
                  : []),
                {
                  label: "Status",
                  value:
                    shopApplicationStatus.status === "pending"
                      ? "Pending approval"
                      : "Verified",
                },
              ]}
              cta="View Shop Application →"
              onClick={() => router.push("/shop?tab=profile")}
            />
          ) : (
            <RoleCard
              image="/img/choose/customer-card.png"
              alt="Customer booking a repair on their phone"
              icon={customerIcon}
              title="Customer"
              description="Book services, earn rewards, track appointments and discover trusted local businesses."
              cta="Continue as Customer →"
              onClick={() => router.push("/register/customer")}
            />
          )}

          {/* Shop Registration */}
          {checkingApplications ? (
            <SkeletonCard title="Shop Owner" />
          ) : customerStatus.isRegistered ? (
            <StatusCard
              icon={shopIcon}
              title="Customer Registration Found"
              description="You're already registered as a customer in our network. You cannot register as both a customer and a shop with the same wallet."
              details={[
                { label: "Existing registration", value: "Customer account" },
                ...(customerStatus.customerData?.tier
                  ? [
                      {
                        label: "Tier",
                        value: String(customerStatus.customerData.tier),
                      },
                    ]
                  : []),
              ]}
              cta="View Customer Dashboard →"
              onClick={() => router.push("/customer")}
            />
          ) : shopApplicationStatus.hasApplication ? (
            <StatusCard
              icon={shopIcon}
              title={
                shopApplicationStatus.status === "pending"
                  ? "Application Pending"
                  : "Shop Registered"
              }
              description={
                shopApplicationStatus.status === "pending"
                  ? "Your shop application is being reviewed by our admin team. You'll receive access once approved."
                  : "Your shop is registered and verified in our network."
              }
              details={[
                ...(shopApplicationStatus.shopName
                  ? [
                      {
                        label: "Shop name",
                        value: shopApplicationStatus.shopName,
                      },
                    ]
                  : []),
                {
                  label: "Status",
                  value:
                    shopApplicationStatus.status === "pending"
                      ? "Awaiting admin review"
                      : "Ready to use dashboard",
                },
              ]}
              cta={
                shopApplicationStatus.status === "pending"
                  ? "View Application Status →"
                  : "Go to Shop Dashboard →"
              }
              onClick={() => router.push("/shop?tab=profile")}
            />
          ) : (
            <RoleCard
              image="/img/choose/shop-card.png"
              alt="Shop owner managing their business"
              icon={shopIcon}
              title="Shop Owner"
              description="Grow your business with AI, smart bookings, CRM, marketing tools, rewards and powerful insights."
              cta="Continue as Shop Owner →"
              onClick={() => router.push("/register/shop")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
