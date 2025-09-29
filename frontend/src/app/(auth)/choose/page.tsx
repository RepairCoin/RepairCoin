"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function ChoosePage() {
  const { account, isAuthenticated, isLoading, userType, userProfile } =
    useAuth();
  const router = useRouter();
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
        `${process.env.NEXT_PUBLIC_API_URL}/shops/wallet/${walletAddress}`
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
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${walletAddress}`
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

  // Auto-redirect authenticated users to their appropriate dashboard
  // useEffect(() => {
  //   if (isAuthenticated && userType && !isLoading) {
  //     console.log("Redirecting user:", { userType, userProfile });

  //     switch (userType) {
  //       case "admin":
  //         router.push("/admin");
  //         break;
  //       case "shop":
  //         router.push("/shop");
  //         break;
  //       case "customer":
  //         router.push("/customer");
  //         break;
  //       default:
  //         console.warn("Unknown user type:", userType);
  //     }
  //   }
  // }, [isAuthenticated, userType, isLoading, router, userProfile]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Loading RepairCoin...
            </h2>
            <p className="text-gray-600">Checking your authentication status</p>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🏪</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Choose your role
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your wallet to choose your role
            </p>
            <ConnectButton
              client={client}
              theme="light"
              connectModal={{ size: "wide" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-10 pt-36 bg-[#0D0D0D]"
      style={{
        backgroundImage: `url('/img/dashboard-bg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-screen-2xl w-[70%] mx-auto">
        {/* Header */}
        <div className="w-full flex flex-col  items-center md:gap-6 gap-4">
          <p className="md:text-5xl text-3xl text-center font-bold text-white tracking-wide">
            Welcome to RepairCoin
          </p>
          <p className="text-white text-xs md:text-base mb-6 xl:w-2/3 md:w-2/4 text-center tracking-wide">
            Choose how you'd like to join our blockchain-powered repair
            ecosystem
          </p>
        </div>

        {/* Registration Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
          {/* Customer Registration */}
          <div className="rounded-2xl shadow-xl hover:shadow-2xl transition-shadow h-full">
            <div className="text-center h-full flex flex-col">
              {checkingApplications ? (
                <>
                  <div className="text-5xl mb-4">🔄</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Checking Registration...
                  </h3>
                  <p className="text-gray-600 mb-6 flex-grow">
                    Please wait while we check for existing registrations
                  </p>
                  <div className="mt-auto">
                    <div className="w-full bg-gray-200 rounded-xl py-4 px-6">
                      <div className="animate-pulse flex items-center justify-center">
                        <div className="rounded-full h-4 w-4 bg-gray-400"></div>
                      </div>
                    </div>
                  </div>
                </>
              ) : customerStatus.isRegistered ? (
                <>
                  <div className="text-5xl mb-4">✅</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Already Registered
                  </h3>
                  <p className="text-gray-600 mb-6 flex-grow">
                    You're already registered as a customer in our network
                  </p>
                  <div className="bg-green-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-green-600">Customer Status:</p>
                    <p className="font-semibold text-green-900">Active</p>
                    {customerStatus.customerData?.tier && (
                      <>
                        <p className="text-sm text-green-600 mt-2">
                          Current Tier:
                        </p>
                        <p className="font-semibold text-green-900">
                          {customerStatus.customerData.tier}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="mt-auto">
                    <button
                      onClick={() => router.push("/customer")}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                    >
                      Go to Customer Dashboard
                    </button>
                  </div>
                </>
              ) : shopApplicationStatus.hasApplication ? (
                <>
                  <div className="text-5xl mb-4">🚫</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Shop Application Found
                  </h3>
                  <p className="text-gray-600 mb-6 flex-grow">
                    You have a{" "}
                    {shopApplicationStatus.status === "pending"
                      ? "pending"
                      : "verified"}{" "}
                    shop application. You cannot register as both a customer and
                    a shop with the same wallet.
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="text-sm text-yellow-700">
                      <p className="font-medium mb-1">Existing Shop:</p>
                      <p className="font-semibold">
                        {shopApplicationStatus.shopName}
                      </p>
                      <p className="mt-2">
                        Status:{" "}
                        <span className="font-medium">
                          {shopApplicationStatus.status === "pending"
                            ? "Pending Approval"
                            : "Verified"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <button
                      onClick={() => router.push("/shop")}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                    >
                      View Shop Application
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-full bg-[#1C1C1C] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="relative w-full bg-[#1C1C1C] overflow-hidden">
                    <div className="w-full pt-[56.25%] relative">
                      <img
                        src="/img/choose-avatar1.png"
                        alt="Customer"
                        className="absolute top-0 left-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col flex-grow p-5 sm:p-6 gap-2">
                    <p className="text-2xl font-semibold text-white mb-2 sm:mb-3 line-clamp-2">
                      I'm a Customer
                    </p>
                    <p className="text-gray-300 text-xs mb-4 line-clamp-3">
                      Start earning RepairCoin tokens for your device repairs
                      and redeem them for discounts
                    </p>
                    <div className="flex flex-col mt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <svg
                          width="25"
                          height="25"
                          viewBox="0 0 30 30"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M15 2.8125C8.27988 2.8125 2.8125 8.27988 2.8125 15C2.8125 21.7201 8.27988 27.1875 15 27.1875C21.7201 27.1875 27.1875 21.7201 27.1875 15C27.1875 8.27988 21.7201 2.8125 15 2.8125ZM21.3428 10.9154L13.4678 20.2904C13.3814 20.3933 13.2739 20.4764 13.1526 20.5342C13.0313 20.5919 12.899 20.6229 12.7646 20.625H12.7488C12.6174 20.625 12.4875 20.5973 12.3675 20.5438C12.2475 20.4903 12.14 20.4122 12.0521 20.3145L8.67715 16.5645C8.59144 16.4735 8.52476 16.3664 8.48104 16.2494C8.43732 16.1323 8.41744 16.0077 8.42256 15.8829C8.42769 15.758 8.45771 15.6355 8.51088 15.5224C8.56404 15.4093 8.63928 15.308 8.73215 15.2245C8.82503 15.1409 8.93367 15.0767 9.0517 15.0357C9.16973 14.9947 9.29476 14.9777 9.41945 14.9858C9.54414 14.9938 9.66597 15.0266 9.77777 15.0824C9.88958 15.1382 9.98911 15.2158 10.0705 15.3105L12.7242 18.259L19.9072 9.70957C20.0683 9.52329 20.2963 9.40789 20.5418 9.38833C20.7873 9.36877 21.0307 9.4466 21.2193 9.60502C21.4079 9.76343 21.5265 9.9897 21.5497 10.2349C21.5728 10.4801 21.4984 10.7246 21.3428 10.9154Z"
                            fill="#FFCC00"
                          />
                        </svg>
                        <span className="text-gray-300">
                          Earn 10-25 RCN per repair
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg
                          width="25"
                          height="25"
                          viewBox="0 0 30 30"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M15 2.8125C8.27988 2.8125 2.8125 8.27988 2.8125 15C2.8125 21.7201 8.27988 27.1875 15 27.1875C21.7201 27.1875 27.1875 21.7201 27.1875 15C27.1875 8.27988 21.7201 2.8125 15 2.8125ZM21.3428 10.9154L13.4678 20.2904C13.3814 20.3933 13.2739 20.4764 13.1526 20.5342C13.0313 20.5919 12.899 20.6229 12.7646 20.625H12.7488C12.6174 20.625 12.4875 20.5973 12.3675 20.5438C12.2475 20.4903 12.14 20.4122 12.0521 20.3145L8.67715 16.5645C8.59144 16.4735 8.52476 16.3664 8.48104 16.2494C8.43732 16.1323 8.41744 16.0077 8.42256 15.8829C8.42769 15.758 8.45771 15.6355 8.51088 15.5224C8.56404 15.4093 8.63928 15.308 8.73215 15.2245C8.82503 15.1409 8.93367 15.0767 9.0517 15.0357C9.16973 14.9947 9.29476 14.9777 9.41945 14.9858C9.54414 14.9938 9.66597 15.0266 9.77777 15.0824C9.88958 15.1382 9.98911 15.2158 10.0705 15.3105L12.7242 18.259L19.9072 9.70957C20.0683 9.52329 20.2963 9.40789 20.5418 9.38833C20.7873 9.36877 21.0307 9.4466 21.2193 9.60502C21.4079 9.76343 21.5265 9.9897 21.5497 10.2349C21.5728 10.4801 21.4984 10.7246 21.3428 10.9154Z"
                            fill="#FFCC00"
                          />
                        </svg>
                        <span className="text-gray-300">
                          Redeem tokens for discounts
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg
                          width="25"
                          height="25"
                          viewBox="0 0 30 30"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M15 2.8125C8.27988 2.8125 2.8125 8.27988 2.8125 15C2.8125 21.7201 8.27988 27.1875 15 27.1875C21.7201 27.1875 27.1875 21.7201 27.1875 15C27.1875 8.27988 21.7201 2.8125 15 2.8125ZM21.3428 10.9154L13.4678 20.2904C13.3814 20.3933 13.2739 20.4764 13.1526 20.5342C13.0313 20.5919 12.899 20.6229 12.7646 20.625H12.7488C12.6174 20.625 12.4875 20.5973 12.3675 20.5438C12.2475 20.4903 12.14 20.4122 12.0521 20.3145L8.67715 16.5645C8.59144 16.4735 8.52476 16.3664 8.48104 16.2494C8.43732 16.1323 8.41744 16.0077 8.42256 15.8829C8.42769 15.758 8.45771 15.6355 8.51088 15.5224C8.56404 15.4093 8.63928 15.308 8.73215 15.2245C8.82503 15.1409 8.93367 15.0767 9.0517 15.0357C9.16973 14.9947 9.29476 14.9777 9.41945 14.9858C9.54414 14.9938 9.66597 15.0266 9.77777 15.0824C9.88958 15.1382 9.98911 15.2158 10.0705 15.3105L12.7242 18.259L19.9072 9.70957C20.0683 9.52329 20.2963 9.40789 20.5418 9.38833C20.7873 9.36877 21.0307 9.4466 21.2193 9.60502C21.4079 9.76343 21.5265 9.9897 21.5497 10.2349C21.5728 10.4801 21.4984 10.7246 21.3428 10.9154Z"
                            fill="#FFCC00"
                          />
                        </svg>
                        <span className="text-gray-300">
                          Access tier benefits
                        </span>
                      </div>
                    </div>
                    <div className="mt-8">
                      <button
                        onClick={() => router.push("/customer/register")}
                        className="w-full bg-[#FFCC00] text-black font-semibold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                      >
                        Register as Customer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shop Registration */}
          <div className="rounded-2xl shadow-xl hover:shadow-2xl transition-shadow h-full">
            <div className="text-center h-full flex flex-col">
              {checkingApplications ? (
                <>
                  <div className="text-5xl mb-4">🔄</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Checking Application...
                  </h3>
                  <p className="text-gray-600 mb-6 flex-grow">
                    Please wait while we check for existing shop applications
                  </p>
                  <div className="mt-auto">
                    <div className="w-full bg-gray-200 rounded-xl py-4 px-6">
                      <div className="animate-pulse flex items-center justify-center">
                        <div className="rounded-full h-4 w-4 bg-gray-400"></div>
                      </div>
                    </div>
                  </div>
                </>
              ) : customerStatus.isRegistered ? (
                <>
                  <div className="text-5xl mb-4">🚫</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Customer Registration Found
                  </h3>
                  <p className="text-gray-600 mb-6 flex-grow">
                    You're already registered as a customer in our network. You
                    cannot register as both a customer and a shop with the same
                    wallet.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="text-sm text-blue-700">
                      <p className="font-medium mb-1">Existing Registration:</p>
                      <p className="font-semibold">Customer Account</p>
                      {customerStatus.customerData?.tier && (
                        <p className="mt-2">
                          Tier:{" "}
                          <span className="font-medium">
                            {customerStatus.customerData.tier}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto">
                    <button
                      onClick={() => router.push("/customer")}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                    >
                      View Customer Dashboard
                    </button>
                  </div>
                </>
              ) : shopApplicationStatus.hasApplication ? (
                <>
                  <div className="text-5xl mb-4">
                    {shopApplicationStatus.status === "pending" ? "⏳" : "✅"}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {shopApplicationStatus.status === "pending"
                      ? "Application Pending"
                      : "Shop Registered"}
                  </h3>
                  <p className="text-gray-600 mb-6 flex-grow">
                    {shopApplicationStatus.status === "pending"
                      ? "Your shop application is being reviewed by our admin team"
                      : "Your shop is registered and verified in our network"}
                  </p>
                  {shopApplicationStatus.shopName && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <p className="text-sm text-gray-600">Shop Name:</p>
                      <p className="font-semibold text-gray-900">
                        {shopApplicationStatus.shopName}
                      </p>
                    </div>
                  )}
                  <div className="space-y-3 text-sm mb-6">
                    {shopApplicationStatus.status === "pending" ? (
                      <div className="text-yellow-600 bg-yellow-50 rounded-lg p-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span>⏳</span>
                          <span className="font-medium">
                            Awaiting Admin Review
                          </span>
                        </div>
                        <p className="text-xs">
                          You'll receive access once approved
                        </p>
                      </div>
                    ) : (
                      <div className="text-green-600 bg-green-50 rounded-lg p-3">
                        <div className="flex items-center justify-center gap-2">
                          <span>✓</span>
                          <span className="font-medium">
                            Ready to Use Dashboard
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto">
                    <button
                      onClick={() => router.push("/shop")}
                      className={`w-full font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer ${
                        shopApplicationStatus.status === "pending"
                          ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                          : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                      }`}
                    >
                      {shopApplicationStatus.status === "pending"
                        ? "View Application Status"
                        : "Go to Shop Dashboard"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col h-full bg-[#1C1C1C] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <div className="relative w-full bg-[#1C1C1C] overflow-hidden">
                      <div className="w-full pt-[56.25%] relative">
                        <img
                          src="/img/choose-avatar2.png"
                          alt="Customer"
                          className="absolute top-0 left-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col flex-grow p-5 sm:p-6 gap-2">
                      <p className="text-2xl font-semibold text-white mb-2 sm:mb-3 line-clamp-2">
                        I’m a Repair Shop Owner
                      </p>
                      <p className="text-gray-300 text-xs mb-4 line-clamp-3">
                        Join our network to offer loyalty tokens to your
                        customers and boost retentions
                      </p>
                      <div className="flex flex-col mt-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <svg
                            width="25"
                            height="25"
                            viewBox="0 0 30 30"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M15 2.8125C8.27988 2.8125 2.8125 8.27988 2.8125 15C2.8125 21.7201 8.27988 27.1875 15 27.1875C21.7201 27.1875 27.1875 21.7201 27.1875 15C27.1875 8.27988 21.7201 2.8125 15 2.8125ZM21.3428 10.9154L13.4678 20.2904C13.3814 20.3933 13.2739 20.4764 13.1526 20.5342C13.0313 20.5919 12.899 20.6229 12.7646 20.625H12.7488C12.6174 20.625 12.4875 20.5973 12.3675 20.5438C12.2475 20.4903 12.14 20.4122 12.0521 20.3145L8.67715 16.5645C8.59144 16.4735 8.52476 16.3664 8.48104 16.2494C8.43732 16.1323 8.41744 16.0077 8.42256 15.8829C8.42769 15.758 8.45771 15.6355 8.51088 15.5224C8.56404 15.4093 8.63928 15.308 8.73215 15.2245C8.82503 15.1409 8.93367 15.0767 9.0517 15.0357C9.16973 14.9947 9.29476 14.9777 9.41945 14.9858C9.54414 14.9938 9.66597 15.0266 9.77777 15.0824C9.88958 15.1382 9.98911 15.2158 10.0705 15.3105L12.7242 18.259L19.9072 9.70957C20.0683 9.52329 20.2963 9.40789 20.5418 9.38833C20.7873 9.36877 21.0307 9.4466 21.2193 9.60502C21.4079 9.76343 21.5265 9.9897 21.5497 10.2349C21.5728 10.4801 21.4984 10.7246 21.3428 10.9154Z"
                              fill="#FFCC00"
                            />
                          </svg>
                          <span className="text-gray-300">
                            Purchase RCN at $0.10 per token
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <svg
                            width="25"
                            height="25"
                            viewBox="0 0 30 30"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M15 2.8125C8.27988 2.8125 2.8125 8.27988 2.8125 15C2.8125 21.7201 8.27988 27.1875 15 27.1875C21.7201 27.1875 27.1875 21.7201 27.1875 15C27.1875 8.27988 21.7201 2.8125 15 2.8125ZM21.3428 10.9154L13.4678 20.2904C13.3814 20.3933 13.2739 20.4764 13.1526 20.5342C13.0313 20.5919 12.899 20.6229 12.7646 20.625H12.7488C12.6174 20.625 12.4875 20.5973 12.3675 20.5438C12.2475 20.4903 12.14 20.4122 12.0521 20.3145L8.67715 16.5645C8.59144 16.4735 8.52476 16.3664 8.48104 16.2494C8.43732 16.1323 8.41744 16.0077 8.42256 15.8829C8.42769 15.758 8.45771 15.6355 8.51088 15.5224C8.56404 15.4093 8.63928 15.308 8.73215 15.2245C8.82503 15.1409 8.93367 15.0767 9.0517 15.0357C9.16973 14.9947 9.29476 14.9777 9.41945 14.9858C9.54414 14.9938 9.66597 15.0266 9.77777 15.0824C9.88958 15.1382 9.98911 15.2158 10.0705 15.3105L12.7242 18.259L19.9072 9.70957C20.0683 9.52329 20.2963 9.40789 20.5418 9.38833C20.7873 9.36877 21.0307 9.4466 21.2193 9.60502C21.4079 9.76343 21.5265 9.9897 21.5497 10.2349C21.5728 10.4801 21.4984 10.7246 21.3428 10.9154Z"
                              fill="#FFCC00"
                            />
                          </svg>
                          <span className="text-gray-300">
                            Automatic Tier Bonuses
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <svg
                            width="25"
                            height="25"
                            viewBox="0 0 30 30"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M15 2.8125C8.27988 2.8125 2.8125 8.27988 2.8125 15C2.8125 21.7201 8.27988 27.1875 15 27.1875C21.7201 27.1875 27.1875 21.7201 27.1875 15C27.1875 8.27988 21.7201 2.8125 15 2.8125ZM21.3428 10.9154L13.4678 20.2904C13.3814 20.3933 13.2739 20.4764 13.1526 20.5342C13.0313 20.5919 12.899 20.6229 12.7646 20.625H12.7488C12.6174 20.625 12.4875 20.5973 12.3675 20.5438C12.2475 20.4903 12.14 20.4122 12.0521 20.3145L8.67715 16.5645C8.59144 16.4735 8.52476 16.3664 8.48104 16.2494C8.43732 16.1323 8.41744 16.0077 8.42256 15.8829C8.42769 15.758 8.45771 15.6355 8.51088 15.5224C8.56404 15.4093 8.63928 15.308 8.73215 15.2245C8.82503 15.1409 8.93367 15.0767 9.0517 15.0357C9.16973 14.9947 9.29476 14.9777 9.41945 14.9858C9.54414 14.9938 9.66597 15.0266 9.77777 15.0824C9.88958 15.1382 9.98911 15.2158 10.0705 15.3105L12.7242 18.259L19.9072 9.70957C20.0683 9.52329 20.2963 9.40789 20.5418 9.38833C20.7873 9.36877 21.0307 9.4466 21.2193 9.60502C21.4079 9.76343 21.5265 9.9897 21.5497 10.2349C21.5728 10.4801 21.4984 10.7246 21.3428 10.9154Z"
                              fill="#FFCC00"
                            />
                          </svg>
                          <span className="text-gray-300">
                            Cross-shop redemption network
                          </span>
                        </div>
                      </div>
                      <div className="mt-8">
                        <button
                          onClick={() => router.push("/shop/register")}
                          className="w-full bg-[#FFCC00] text-black font-semibold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                        >
                          Register as Shop
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* How to Earn More RepairCoin Section */}
        <div
          className="my-28 bg-gradient-to-b from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
          style={{
            backgroundImage: `url('/img/cus-how-to-earn.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <h2 className="text-3xl tracking-wide font-bold text-white my-6 text-center">
            How to Earn More RepairCoin
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
            {/* Refer Friends Card */}
            <div className="rounded-2xl p-6">
              <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
                <img
                  src="/img/story1.png"
                  alt="Refer Friends"
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
                1. Get Repairs
              </h3>
              <p className="text-gray-300 text-sm tracking-wide text-center">
                Customers get their devices repaired at participating shops.
              </p>
            </div>

            {/* Complete Repairs Card */}
            <div className="rounded-2xl p-6">
              <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
                <img
                  src="/img/whatWeDo3.png"
                  alt="Complete Repairs"
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
                2. Earn Tokens
              </h3>
              <p className="text-gray-300 text-sm tracking-wide text-center">
                Receive RepairCoin tokens based on repair value and tier
              </p>
            </div>

            {/* Upgrade Your Tier Card */}
            <div className="rounded-2xl p-6">
              <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
                <img
                  src="/img/customer-avatar.png"
                  alt="Upgrade Your Tier"
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
                3. Redeem Benefits
              </h3>
              <p className="text-gray-300 text-sm tracking-wide text-center">
                Use tokens for discounts at any participating shop
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
