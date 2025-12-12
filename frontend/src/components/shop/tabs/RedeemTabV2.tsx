"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  Search,
  CreditCard,
  Shield,
  TrendingDown,
  AlertCircle,
  ChevronRight,
  Smartphone,
  RefreshCw,
  Camera,
  X,
} from "lucide-react";
import { LookupIcon, RedeemIcon } from "../../icon";
import { showToast } from "@/utils/toast";
import QrScanner from "qr-scanner";
import toast from "react-hot-toast";
import Tooltip from "../../ui/tooltip";
import apiClient from "@/services/api/client";
import DisableMask from "@/components/status/DisableMask";
import { ShopData as ShopDataImport } from "../ShopDashboardClient";
import { DISABLE_CONTENT } from "@/constants/shop";
interface ShopData extends Omit<ShopDataImport, "walletAddress">{
  walletAddress?: string;
}

interface RedeemTabProps {
  shopId: string;
  isOperational: boolean | null;
  onRedemptionComplete: () => void;
  setShowOnboardingModal: (show: boolean) => void;
  shopData?: ShopData | null;
  isBlocked?: boolean;
  blockReason?: string;
  shopRcnBalance?: number; // Shop's operational RCN balance
}

interface RedemptionTransaction {
  id: string;
  customerAddress: string;
  customerName?: string;
  amount: number;
  timestamp: string;
  status: "confirmed" | "pending" | "failed";
  transactionHash?: string;
}

interface RedemptionSession {
  sessionId: string;
  customerAddress: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "expired" | "used";
  expiresAt: string;
}

interface ShopCustomer {
  address: string;
  name?: string;
  tier: string;
  lifetime_earnings: number;
  last_transaction_date?: string;
  total_transactions: number;
  isActive?: boolean;
  suspended?: boolean;
  suspensionReason?: string;
}

type RedemptionFlow = "approval";

export const RedeemTabV2: React.FC<RedeemTabProps> = ({
  shopId,
  isOperational,
  onRedemptionComplete,
  setShowOnboardingModal,
  shopData,
  isBlocked = false,
  blockReason = "This action is currently blocked",
  shopRcnBalance = 0,
}) => {
  const [flow, setFlow] = useState<RedemptionFlow>("approval");

  // Two-factor flow states
  const [customerAddress, setCustomerAddress] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<ShopCustomer | null>(
    null
  );
  const [shopCustomers, setShopCustomers] = useState<ShopCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [redeemAmount, setRedeemAmount] = useState<number>(0);
  const [currentSession, setCurrentSession] =
    useState<RedemptionSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "creating" | "waiting" | "processing"
  >("idle");
  const [showingAllCustomers, setShowingAllCustomers] = useState(false);
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [crossShopInfo, setCrossShopInfo] = useState<{
    isHomeShop: boolean;
    maxRedeemable: number;
    crossShopLimit: number;
  } | null>(null);
  const [validatingRedemption, setValidatingRedemption] = useState(false);
  const [checkingCustomerExists, setCheckingCustomerExists] = useState(false);
  const [customerExistsResult, setCustomerExistsResult] = useState<{
    exists: boolean;
    checked: boolean;
    customerData?: any;
  }>({ exists: false, checked: false });

  // Common states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingSessions, setPendingSessions] = useState<RedemptionSession[]>(
    []
  );

  // Transaction history states
  const [transactions, setTransactions] = useState<RedemptionTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // QR Scanner states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Proactively refresh auth token on mount to ensure fast API responses
  useEffect(() => {
    const refreshToken = async () => {
      try {
        await apiClient.post('/auth/refresh');
        console.log('Token refreshed proactively on page load');
      } catch (err) {
        // Ignore errors - token might already be valid
        console.log('Token refresh not needed or failed:', err);
      }
    };
    refreshToken();
  }, []);

  // Load shop customers and check for pending sessions on mount
  useEffect(() => {
    loadShopCustomers();
    loadRedemptionHistory();
    checkForPendingSessions();

    // Set up interval to check for pending sessions every 30 seconds
    const interval = setInterval(() => {
      if (sessionStatus === "idle") {
        checkForPendingSessions();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [shopId]);

  // Validate redemption in real-time when amount changes (with debounce)
  // This pre-validates before the user clicks the button
  // Uses the same endpoint as the button click but with validateOnly flag
  useEffect(() => {
    // Clear crossShopInfo when no customer selected
    if (!selectedCustomer?.address || !shopId) {
      setCrossShopInfo(null);
      setError(null);  // Clear error when no customer
      return;
    }

    // Clear error and skip validation if no amount entered yet
    if (!redeemAmount || redeemAmount <= 0) {
      setError(null);  // Clear error when amount is cleared
      setValidatingRedemption(false);
      return;
    }

    // Set validating immediately to disable button while checking
    setValidatingRedemption(true);

    // Short debounce to batch rapid typing, but keep it fast
    const timeoutId = setTimeout(async () => {
      try {
        console.log("Pre-validating redemption:", selectedCustomer.address, shopId, redeemAmount);

        // Use the same endpoint as button click, but with validateOnly flag
        const verifyResponse = await apiClient.post(`/tokens/redemption-session/create`, {
          customerAddress: selectedCustomer.address,
          shopId: shopId,
          amount: redeemAmount,
          validateOnly: true  // Just validate, don't create session
        });

        console.log("Pre-validation response:", verifyResponse);

        // apiClient returns response.data directly, so check the structure
        const data = verifyResponse?.data || verifyResponse;

        if (data) {
          // Update crossShopInfo for display purposes
          if (data.isHomeShop !== undefined) {
            setCrossShopInfo({
              isHomeShop: data.isHomeShop,
              maxRedeemable: data.maxRedeemable || 0,
              crossShopLimit: data.crossShopLimit || 0
            });
          }

          // Update customerBalance with the correct availableBalance from backend
          // This is more accurate than the separate balance fetch
          if (data.availableBalance !== undefined) {
            setCustomerBalance(data.availableBalance);
          }

          // Don't show red error banner for validation errors - the warning boxes handle them
          // Cross-shop limit -> purple warning box
          // Insufficient balance -> red/yellow warning boxes already in UI
          // Just clear any existing error
          setError(null);
        }
      } catch (err: any) {
        console.error("Pre-validation error:", err);
        // Log the actual error for debugging
        console.error("Error details:", err?.response?.data || err?.message);
        // Don't set error on network failures - let the button click handle it
      } finally {
        setValidatingRedemption(false);
      }
    }, 150); // 150ms debounce - fast but still batches rapid typing

    return () => clearTimeout(timeoutId);
  }, [selectedCustomer?.address, shopId, redeemAmount]);

  const loadShopCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await apiClient.get(
        `/shops/${shopId}/customers?limit=100`
      );

      if (response.success) {
        const result = response;
        const shopCustomers = result.data.customers || [];

        if (shopCustomers.length === 0) {
          try {
            const allCustomersResponse = await apiClient.get(
              "/customers?limit=100"
            );

            if (allCustomersResponse.success) {
              const allCustomers = allCustomersResponse.data?.customers || [];

              const transformedCustomers = allCustomers.map(
                (customer: any) => ({
                  address: customer.address,
                  name: customer.name || customer.email || "Unnamed Customer",
                  tier: customer.tier || "BRONZE",
                  lifetime_earnings: customer.lifetimeEarnings || 0,
                  last_transaction_date: customer.lastEarnedDate,
                  total_transactions: 0,
                  isActive: customer.active !== false,
                  suspended: customer.active === false,
                  suspendedAt: customer.suspendedAt,
                  suspensionReason: customer.suspensionReason,
                })
              );

              setShopCustomers(transformedCustomers);
              setShowingAllCustomers(true);
            } else {
              setShopCustomers([]);
            }
          } catch (error) {
            console.error("Error loading all customers:", error);
            setShopCustomers([]);
          }
        } else {
          setShopCustomers(shopCustomers);
          setShowingAllCustomers(false);
        }
      } else {
        try {
          const allCustomersResponse = await apiClient.get(
            "/customers?limit=100"
          );

          if (allCustomersResponse.success) {
            const allCustomers = allCustomersResponse.data?.customers || [];

            const transformedCustomers = allCustomers.map((customer: any) => ({
              address: customer.address,
              name: customer.name || customer.email || "Unnamed Customer",
              tier: customer.tier || "BRONZE",
              lifetime_earnings: customer.lifetimeEarnings || 0,
              last_transaction_date: customer.lastEarnedDate,
              total_transactions: 0,
              isActive: customer.active !== false,
              suspended: customer.active === false,
              suspendedAt: customer.suspendedAt,
              suspensionReason: customer.suspensionReason,
            }));

            setShopCustomers(transformedCustomers);
            setShowingAllCustomers(true);
          }
        } catch (error) {
          console.error("Error loading all customers:", error);
        }
      }
    } catch (err) {
      console.error("Error loading customers:", err);
      setShopCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadRedemptionHistory = async () => {
    setLoadingTransactions(true);
    try {
      const response = await apiClient.get(
        `/shops/${shopId}/transactions?type=redemptions&limit=20`
      );

      console.log("[RedeemTabV2] Redemption history response:", response);

      if (response.success) {
        const result = response;
        const redemptions = result.data?.transactions || [];

        console.log("[RedeemTabV2] Redemptions found:", redemptions.length, redemptions);

        const transformedTransactions = redemptions.map((tx: any) => ({
          id: tx.id,
          customerAddress: tx.customerAddress,
          customerName: tx.customerName || "Unknown Customer",
          amount: tx.amount,
          timestamp: tx.createdAt || tx.timestamp,
          status: tx.status || "confirmed",
          transactionHash: tx.transactionHash,
        }));

        setTransactions(transformedTransactions);
      } else {
        console.log("[RedeemTabV2] Response not successful:", response);
      }
    } catch (err) {
      console.error("[RedeemTabV2] Error loading redemption history:", err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const checkForPendingSessions = async () => {
    try {
      const response = await apiClient.get(`/shops/${shopId}/pending-sessions`);

      if (response.success) {
        const result = response;
        const sessions = result.data?.sessions || [];

        // Filter out expired sessions
        const activeSessions = sessions.filter(
          (session: any) => new Date(session.expiresAt) > new Date()
        );

        setPendingSessions(activeSessions);

        if (activeSessions.length > 0 && sessionStatus === "idle") {
          if (activeSessions.length > 0) {
            const latestSession = activeSessions[0];

            // Find the customer in our list
            const customer = shopCustomers.find(
              (c) =>
                c.address.toLowerCase() ===
                latestSession.customerAddress.toLowerCase()
            );

            if (customer) {
              setSelectedCustomer(customer);
            }

            setCurrentSession({
              sessionId: latestSession.sessionId,
              customerAddress: latestSession.customerAddress,
              amount: latestSession.maxAmount,
              status: latestSession.status,
              expiresAt: latestSession.expiresAt,
            });
            setSessionStatus("waiting");
            setCustomerAddress(latestSession.customerAddress);
            setRedeemAmount(latestSession.maxAmount);
            setFlow("approval");

            // Show notification
            setSuccess(
              `Pending redemption request from customer: ${latestSession.amount} RCN`
            );
            setTimeout(() => setSuccess(null), 5000);
          }
        }
      }
    } catch (err) {
      console.error("Error checking for pending sessions:", err);
    }
  };

  const fetchCustomerBalance = async (address: string) => {
    setLoadingBalance(true);
    setCrossShopInfo(null);
    try {
      const response = await apiClient.get(`/customers/balance/${address}`);

      if (response.success) {
        const result = response;
        // Use databaseBalance from backend - this already accounts for:
        // - lifetime earnings
        // - total redemptions
        // - pending mint balance (tokens queued for blockchain minting)
        const availableBalance = result.data?.databaseBalance || 0;
        setCustomerBalance(availableBalance);
      } else {
        console.warn("Could not fetch customer balance:", response.status);
        setCustomerBalance(0);
      }
    } catch (err) {
      console.warn("Error fetching customer balance:", err);
      setCustomerBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleCustomerSelect = (customer: ShopCustomer) => {
    console.log("Selecting customer:", customer);

    // Prevent selecting shop's own wallet address
    if (
      shopData?.walletAddress &&
      customer.address.toLowerCase() === shopData.walletAddress.toLowerCase()
    ) {
      setError("Cannot process redemption from your own wallet address");
      toast.error("Cannot process redemption from your own wallet address");
      return;
    }

    // Check if customer is suspended
    if (customer.isActive === false || customer.suspended) {
      const errorMsg = `Cannot process redemption for suspended customer${
        customer.suspensionReason ? ": " + customer.suspensionReason : ""
      }`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setSelectedCustomer(customer);
    setCustomerAddress(customer.address);
    console.log("Customer selected:", { customer, address: customer.address });

    // Fetch customer balance
    fetchCustomerBalance(customer.address);
  };

  const filteredCustomers = shopCustomers.filter((customer) => {
    if (!customerSearch.trim()) return false;

    const searchLower = customerSearch.toLowerCase().trim();
    const nameMatch =
      customer.name && customer.name.toLowerCase().includes(searchLower);
    const addressMatch = customer.address.toLowerCase().includes(searchLower);

    return nameMatch || addressMatch;
  });

  // Auto-select if only one result
  useEffect(() => {
    if (filteredCustomers.length === 1 && customerSearch.trim()) {
      const customer = filteredCustomers[0];
      if (!selectedCustomer || selectedCustomer.address !== customer.address) {
        console.log("Auto-selecting single search result:", customer);
        handleCustomerSelect(customer);
      }
    }
  }, [filteredCustomers.length, customerSearch]);

  // Check if customer exists when valid Ethereum address is entered
  useEffect(() => {
    const checkCustomerExists = async () => {
      // Only check if it's a valid Ethereum address and not in filtered customers
      const isValidAddress = /^0x[a-fA-F0-9]{40}$/i.test(customerSearch);

      if (!isValidAddress || filteredCustomers.length > 0) {
        setCustomerExistsResult({ exists: false, checked: false });
        return;
      }

      setCheckingCustomerExists(true);
      try {
        const response = await apiClient.get(`/customers/${customerSearch}`);

        if (response.success) {
          setCustomerExistsResult({
            exists: true,
            checked: true,
            customerData: response.data.customer,
          });
        } else {
          setCustomerExistsResult({ exists: false, checked: true });
        }
      } catch (err) {
        console.error("Error checking customer existence:", err);
        setCustomerExistsResult({ exists: false, checked: true });
      } finally {
        setCheckingCustomerExists(false);
      }
    };

    checkCustomerExists();
  }, [customerSearch, filteredCustomers.length]);

  // Poll for session status updates
  useEffect(() => {
    if (currentSession && sessionStatus === "waiting") {
      let pollCount = 0;
      const maxPolls = 150; // 5 minutes max (2 seconds * 150)

      const interval = setInterval(async () => {
        pollCount++;

        if (pollCount > maxPolls) {
          setError("Request timeout - please try again");
          setSessionStatus("idle");
          setCurrentSession(null);
          clearInterval(interval);
          return;
        }

        try {
          const response = await apiClient.get(
            `/tokens/redemption-session/status/${currentSession.sessionId}`
          );

          if (response.success) {
            const result = response;
            const sessionData = result.data;

            // Update session expiry time
            setCurrentSession((prev) =>
              prev ? { ...prev, expiresAt: sessionData.expiresAt } : null
            );

            if (sessionData.status === "approved") {
              setSessionStatus("processing");
              clearInterval(interval);
              await processRedemption();
            } else if (sessionData.status === "rejected") {
              // Check if session was cancelled by shop or rejected by customer
              const metadata = sessionData.metadata;
              const cancelledByShop = metadata?.cancelledByShop;

              if (cancelledByShop) {
                setError("Redemption request was cancelled");
              } else {
                setError("Customer rejected the redemption request");
              }
              setSessionStatus("idle");
              setCurrentSession(null);
              clearInterval(interval);
            } else if (
              sessionData.status === "expired" ||
              new Date(sessionData.expiresAt) < new Date()
            ) {
              setError("Redemption request expired");
              setSessionStatus("idle");
              setCurrentSession(null);
              clearInterval(interval);
            } else if (sessionData.status === "used") {
              setSuccess("This redemption session has already been processed");
              setSessionStatus("idle");
              setCurrentSession(null);
              clearInterval(interval);
            }
          } else if (response.status === 404) {
            // Session not found
            setError("Session not found or has been cancelled");
            setSessionStatus("idle");
            setCurrentSession(null);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Error checking session status:", err);
          // Don't clear interval on network errors - keep trying
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [currentSession, sessionStatus]);

  // All redemptions now require customer approval for security

  const createRedemptionSession = async () => {
    // Check if shop is blocked first
    if (isBlocked) {
      setError(blockReason);
      toast.error(blockReason, {
        duration: 5000,
        position: "top-right",
        style: {
          background: "#EF4444",
          color: "white",
          fontWeight: "bold",
        },
        icon: "🚫",
      });
      return;
    }

    if (!isOperational) {
      setShowOnboardingModal(true);
    } else {
      const finalAddress = selectedCustomer?.address || customerAddress;

      if (!finalAddress || !redeemAmount) {
        setError("Please search and select a customer, then enter amount");
        return;
      }

      // Prevent shop from redeeming from their own wallet
      if (
        shopData?.walletAddress &&
        finalAddress.toLowerCase() === shopData.walletAddress.toLowerCase()
      ) {
        setError("Cannot process redemption from your own wallet address");
        return;
      }

      // Check if customer is suspended
      if (
        selectedCustomer &&
        (selectedCustomer.isActive === false || selectedCustomer.suspended)
      ) {
        const errorMsg = `Cannot process redemption for suspended customer${
          selectedCustomer.suspensionReason
            ? ": " + selectedCustomer.suspensionReason
            : ""
        }`;
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      setSessionStatus("creating");
      setError(null);
      setSuccess(null);

      try {
        const response = await apiClient.post(
          "/tokens/redemption-session/create",
          {
            customerAddress: finalAddress,
            shopId,
            amount: redeemAmount,
          }
        );

        if (!response.success) {
          throw new Error(
            response.error || "Failed to create redemption session"
          );
        }

        const result = response;
        const newSession = {
          sessionId: result.data.sessionId,
          customerAddress: finalAddress,
          amount: redeemAmount,
          status: "pending" as const,
          expiresAt: result.data.expiresAt,
        };
        setCurrentSession(newSession);
        setSessionStatus("waiting");
      } catch (err) {
        console.error("Session creation error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to create session"
        );
        setSessionStatus("idle");
      }
    }
  };

  const processRedemption = async () => {
    if (!currentSession) return;

    try {
      const response = await apiClient.post(`/shops/${shopId}/redeem`, {
        customerAddress: currentSession.customerAddress,
        amount: currentSession.amount,
        sessionId: currentSession.sessionId,
      });

      if (!response.success) {
        throw new Error(response.error || "Redemption failed");
      }

      setSuccess(
        `Successfully redeemed ${currentSession.amount} RCN for customer`
      );

      // Reset form
      setCustomerAddress("");
      setSelectedCustomer(null);
      setRedeemAmount(0);
      setCurrentSession(null);
      setSessionStatus("idle");
      setCustomerSearch("");
      setCustomerBalance(null);
      setCrossShopInfo(null);

      await loadRedemptionHistory();
      await checkForPendingSessions();
      onRedemptionComplete();
    } catch (err) {
      console.error("Redemption error:", err);
      setError(err instanceof Error ? err.message : "Redemption failed");
      setSessionStatus("idle");
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) return "Expired";

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // QR Scanner functions
  const startQRScanner = async () => {
    try {
      setShowQRScanner(true);
      setCameraLoading(true);

      // Wait for video element to be ready in the DOM
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!videoRef.current) {
        throw new Error("Video element not ready");
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const scannedText = result.data;
          console.log("QR scan result:", scannedText);

          // Validate if it's an Ethereum address
          const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
          if (ethAddressRegex.test(scannedText)) {
            setCustomerSearch(scannedText);
            setCustomerAddress(scannedText);
            stopQRScanner();
            toast.success("Customer wallet address scanned successfully!");

            // Try to find and auto-select the customer
            setTimeout(() => {
              const customer = shopCustomers.find(
                (c) => c.address.toLowerCase() === scannedText.toLowerCase()
              );
              if (customer) {
                handleCustomerSelect(customer);
              }
            }, 100);
          } else {
            toast.error("Invalid wallet address in QR code");
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment", // Use back camera on mobile
        }
      );

      setQrScanner(scanner);

      // Start the scanner with better error handling
      try {
        await scanner.start();
        setCameraLoading(false);
      } catch (startError: any) {
        console.error("Scanner start error:", startError);

        // Provide more specific error messages
        if (startError.name === "NotAllowedError") {
          toast.error(
            "Camera permission denied. Please allow camera access in your browser settings."
          );
        } else if (startError.name === "NotFoundError") {
          toast.error("No camera found on this device.");
        } else if (startError.name === "NotReadableError") {
          toast.error("Camera is already in use by another application.");
        } else {
          toast.error("Failed to start camera. Please try again.");
        }

        setShowQRScanner(false);
        setQrScanner(null);
        setCameraLoading(false);
      }
    } catch (error) {
      console.error("Error initializing QR scanner:", error);
      toast.error("Failed to initialize camera. Please try again.");
      setShowQRScanner(false);
      setCameraLoading(false);
    }
  };

  const stopQRScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }

    // Explicitly stop all video tracks to ensure camera is released
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Camera track stopped:", track.kind);
      });
      videoRef.current.srcObject = null;
    }

    setShowQRScanner(false);
    setCameraLoading(false);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  const getTierColor = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case "GOLD":
        return "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white";
      case "SILVER":
        return "bg-gradient-to-r from-gray-400 to-gray-500 text-white";
      case "BRONZE":
        return "bg-gradient-to-r from-orange-500 to-orange-600 text-white";
      default:
        return "bg-gradient-to-r from-gray-400 to-gray-500 text-white";
    }
  };

  const maskState = useMemo(() => {
    if (!shopData) return;
    const { verified, active, operational_status: os } = shopData;
    const isOp = os === "rcg_qualified" || os === "subscription_qualified" || (!os && active && verified);
    const msgs = [
      !verified && DISABLE_CONTENT["VERIFY_ACCOUNT"],
      !active && DISABLE_CONTENT["INACTIVE_ACCOUNT"],
      !isOp && DISABLE_CONTENT["UNSUBSCRIBE"],
    ].filter(Boolean);
    return { disable: msgs.length > 0, content: msgs.join(" ") };
  }, [shopData]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Sessions Alert */}
          {pendingSessions.length > 0 && sessionStatus === "idle" && (
            <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mr-3" />
                  <div>
                    <h4 className="font-semibold text-yellow-500">
                      {pendingSessions.length} Pending Redemption
                      {pendingSessions.length > 1 ? "s" : ""}
                    </h4>
                    <p className="text-sm text-yellow-400">
                      Customer{pendingSessions.length > 1 ? "s are" : " is"}{" "}
                      waiting for redemption approval
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const session = pendingSessions[0];
                    setCurrentSession(session);
                    setSessionStatus("waiting");
                    setCustomerAddress(session.customerAddress);
                    setRedeemAmount(session.amount);
                    setFlow("approval");
                  }}
                  className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                >
                  Review
                </button>
              </div>
            </div>
          )}
          {/* Security Notice */}
          <div className="bg-blue-900 bg-opacity-20 border border-blue-500 rounded-xl p-4">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-400 mb-1">
                  Secure Redemption Process
                </h4>
                <p className="text-sm text-blue-300">
                  For security, all redemptions require customer approval on
                  their own device. Customer must approve the transaction
                  themselves on their phone/device.
                </p>
              </div>
            </div>
          </div>

          {/* Customer Input Flow - Used by both immediate and session-based */}
          {sessionStatus === "idle" && (
            <>
              {/* Customer Search Card */}
              <div className="bg-[#212121] rounded-3xl">
                <div
                  className="w-full flex items-center justify-between px-4 md:px-8 py-4 text-white rounded-t-3xl"
                  style={{
                    backgroundImage: `url('/img/cust-ref-widget3.png')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  <div className="flex gap-2 items-center">
                    <LookupIcon width={24} height={24} color={"black"} />
                    <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                      Step 1: Select Customer
                    </p>
                  </div>
                  <Tooltip
                    title="How redemption works"
                    position="bottom"
                    className="right-0"
                    content={
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-400">
                              1
                            </span>
                          </div>
                          <span className="text-gray-300">
                            Search for customer by wallet address or scan QR
                            code
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-400">
                              2
                            </span>
                          </div>
                          <span className="text-gray-300">
                            Enter the RCN amount customer wants to redeem
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-400">
                              3
                            </span>
                          </div>
                          <span className="text-gray-300">
                            System calculates redemption value (100% at your
                            shop, 20% elsewhere)
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-400">
                              4
                            </span>
                          </div>
                          <span className="text-gray-300">
                            Approve the redemption to transfer RCN and complete
                            transaction
                          </span>
                        </li>
                      </ul>
                    }
                  />
                </div>
                <DisableMask {...maskState} onClick={() => setShowOnboardingModal(true)}>
                  <div className="space-y-4 px-4 md:px-8 py-4">
                    <div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => {
                              setCustomerSearch(e.target.value);
                              if (
                                selectedCustomer &&
                                !e.target.value.includes(
                                  selectedCustomer.address.slice(0, 6)
                                )
                              ) {
                                setSelectedCustomer(null);
                                setCustomerAddress("");
                                setCustomerBalance(null);
                                setCrossShopInfo(null);
                              }
                            }}
                            placeholder="Type customer name or wallet address..."
                            className="w-full px-4 py-3 bg-[#2F2F2F] text-white rounded-xl transition-all pl-10 pr-4 border-2 border-transparent focus:border-[#FFCC00]"
                          />
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          {loadingCustomers && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <svg
                                className="animate-spin h-5 w-5 text-[#FFCC00]"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={startQRScanner}
                          disabled={loadingCustomers}
                          className="px-4 py-3 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-[#FFCC00] text-black hover:bg-[#FFD700] flex items-center justify-center gap-2 whitespace-nowrap"
                          title="Scan customer's QR code"
                        >
                          <Camera className="w-5 h-5" />
                          <span className="hidden sm:inline">Scan QR</span>
                        </button>
                      </div>
                    </div>

                    {/* Search Results */}
                    {customerSearch && !selectedCustomer && (
                      <div className="bg-[#0D0D0D] rounded-xl border border-gray-700 max-h-64 overflow-y-auto">
                        {filteredCustomers.length > 0 ? (
                          <div>
                            {filteredCustomers.map((customer) => (
                              <button
                                key={customer.address}
                                onClick={() => {
                                  console.log(
                                    "Customer button clicked:",
                                    customer
                                  );
                                  handleCustomerSelect(customer);
                                  setCustomerSearch("");
                                }}
                                className={`w-full p-4 hover:bg-gray-800 transition-colors border-b border-gray-700 last:border-b-0 ${
                                  selectedCustomer?.address === customer.address
                                    ? "bg-gray-800"
                                    : ""
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="text-left">
                                    <p className="font-semibold text-white">
                                      {customer.name || "Unnamed Customer"}
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono">
                                      {customer.address.slice(0, 6)}...
                                      {customer.address.slice(-4)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`px-2 py-1 rounded-full text-xs font-bold ${getTierColor(
                                        customer.tier
                                      )}`}
                                    >
                                      {customer.tier}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-semibold text-white">
                                        {customer.lifetime_earnings} RCN
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        Lifetime
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : customerSearch.match(/^0x[a-fA-F0-9]{40}$/i) ? (
                          // Check if entered address is shop's own wallet
                          shopData?.walletAddress &&
                          customerSearch.toLowerCase() ===
                            shopData.walletAddress.toLowerCase() ? (
                            <div className="p-4 bg-red-900/20 border border-red-500 rounded-xl">
                              <div className="flex items-center gap-3">
                                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <div>
                                  <p className="text-red-400 font-semibold text-sm">
                                    Cannot Redeem From Own Wallet
                                  </p>
                                  <p className="text-red-300/70 text-xs mt-1">
                                    You cannot process redemption from your own
                                    wallet address. Please enter a customer&apos;s
                                    wallet address.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : checkingCustomerExists ? (
                            <div className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <svg
                                  className="animate-spin h-5 w-5 text-[#FFCC00]"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                <span className="text-gray-400 text-sm">
                                  Checking customer...
                                </span>
                              </div>
                            </div>
                          ) : !customerExistsResult.checked ||
                            !customerExistsResult.exists ? (
                            <div className="p-4 bg-red-900/20 border border-red-500 rounded-xl">
                              <div className="flex items-center gap-3">
                                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <div>
                                  <p className="text-red-400 font-semibold text-sm">
                                    Customer Not Registered
                                  </p>
                                  <p className="text-red-300/70 text-xs mt-1">
                                    This wallet address is not registered.
                                    Customer must register before redemption.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                // Use the customer data already fetched by checkCustomerExists
                                const customerData =
                                  customerExistsResult.customerData;

                                if (customerData) {
                                  setSelectedCustomer({
                                    address: customerSearch,
                                    name:
                                      customerData.name || "External Customer",
                                    tier: customerData.tier || "UNKNOWN",
                                    lifetime_earnings: 0,
                                    total_transactions: 0,
                                    isActive: customerData.active !== false,
                                    suspended: customerData.active === false,
                                    suspendedAt: customerData.suspendedAt,
                                    suspensionReason:
                                      customerData.suspensionReason,
                                  });
                                  setCustomerAddress(customerSearch);

                                  // Fetch customer balance for external customers
                                  fetchCustomerBalance(customerSearch);

                                  setCustomerSearch("");

                                  // Check if customer is suspended and show error
                                  if (customerData.active === false) {
                                    const errorMsg = `Cannot process redemption for suspended customer${
                                      customerData.suspensionReason
                                        ? ": " + customerData.suspensionReason
                                        : ""
                                    }`;
                                    setError(errorMsg);
                                    toast.error(errorMsg);
                                  }
                                } else {
                                  // Fallback if data not available
                                  setCustomerAddress(customerSearch);
                                  setSelectedCustomer({
                                    address: customerSearch,
                                    name: "External Customer",
                                    tier: "UNKNOWN",
                                    lifetime_earnings: 0,
                                    total_transactions: 0,
                                  });

                                  // Fetch customer balance for external customers
                                  fetchCustomerBalance(customerSearch);

                                  setCustomerSearch("");
                                }
                              }}
                              className="w-full p-4 hover:bg-gray-800 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Wallet className="w-5 h-5 text-[#FFCC00]" />
                                  <div className="text-left">
                                    <p className="text-sm font-medium text-[#FFCC00]">
                                      Use This Address
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono">
                                      {customerSearch.slice(0, 10)}...
                                      {customerSearch.slice(-8)}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              </div>
                            </button>
                          )
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            {customerSearch.length < 3
                              ? "Keep typing to search..."
                              : "No customers found"}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selected Customer Display */}
                    {selectedCustomer && (
                      <div className="bg-gradient-to-r from-green-900/20 to-green-800/20 rounded-xl p-4 border-2 border-green-500">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <div className="flex items-center gap-4">
                              <div
                                className={`px-3 py-1 rounded-full text-xs font-bold ${getTierColor(
                                  selectedCustomer.tier
                                )}`}
                              >
                                {selectedCustomer.tier} TIER
                              </div>
                              <div>
                                <p className="font-semibold text-white">
                                  {selectedCustomer.name || "External Customer"}
                                </p>
                                <p className="text-xs text-gray-400 font-mono">
                                  {selectedCustomer.address.slice(0, 8)}...
                                  {selectedCustomer.address.slice(-6)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCustomer(null);
                              setCustomerAddress("");
                              setCustomerSearch("");
                              setCustomerBalance(null);
                              setCrossShopInfo(null);
                            }}
                            className="text-[#FFCC00] hover:text-yellow-400 text-sm font-medium px-3 py-1 rounded-lg border border-[#FFCC00] hover:bg-yellow-900/20"
                          >
                            Change
                          </button>
                        </div>

                        {/* Show suspension warning if customer is suspended */}
                        {(selectedCustomer.isActive === false ||
                          selectedCustomer.suspended) && (
                          <div className="mt-4 bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                            <div className="flex items-center gap-3">
                              <svg
                                className="w-5 h-5 text-red-400 flex-shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div>
                                <p className="text-red-400 font-semibold text-sm">
                                  Customer Account Suspended
                                </p>
                                <p className="text-red-300/70 text-xs mt-1">
                                  {selectedCustomer.suspensionReason
                                    ? `This customer's account has been suspended: ${selectedCustomer.suspensionReason}`
                                    : "This customer's account has been suspended. Cannot process redemption for suspended customers."}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </DisableMask>
              </div>
              {/* Amount Input Card */}
              <div className="bg-[#212121] rounded-3xl">
                <div
                  className="w-full flex gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
                  style={{
                    backgroundImage: `url('/img/cust-ref-widget3.png')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  <LookupIcon width={24} height={24} color={"black"} />
                  <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                    Step 2: Enter Redemption Amount
                  </p>
                </div>
                <DisableMask {...maskState} onClick={() => setShowOnboardingModal(true)}>
                <div className="space-y-4 px-4 md:px-8 py-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Customer wants to redeem (RCN)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={redeemAmount || ""}
                      onChange={(e) => {
                        const amount = parseInt(e.target.value) || 0;
                        console.log("Setting redeem amount:", amount);
                        setRedeemAmount(amount);
                      }}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-[#2F2F2F] text-[#FFCC00] rounded-xl transition-all text-2xl font-bold"
                    />
                  </div>

                  {/* Quick amount buttons */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[10, 25, 50, 100].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          console.log("Quick amount button clicked:", amount);
                          setRedeemAmount(amount);
                        }}
                        className="px-3 py-2 bg-[#FFCC00] hover:bg-yellow-500 border border-gray-700 rounded-3xl font-medium text-black transition-colors"
                      >
                        {amount} RCN
                      </button>
                    ))}
                  </div>
                </div>
                </DisableMask>
              </div>
            </>
          )}

          {/* Waiting for Approval */}
          {sessionStatus === "waiting" && currentSession && (
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-8 border border-gray-800">
              <div className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="animate-pulse">
                    <Clock className="w-20 h-20 text-[#FFCC00] mx-auto" />
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">
                  Request Sent!
                </h3>
                <p className="text-gray-400 mb-6">
                  Waiting for customer approval
                </p>

                <div className="inline-flex items-center bg-[#0D0D0D] rounded-xl px-4 py-2 mb-6">
                  <span className="font-mono text-sm text-gray-300">
                    {currentSession.customerAddress.slice(0, 6)}...
                    {currentSession.customerAddress.slice(-4)}
                  </span>
                </div>

                <div className="bg-[#0D0D0D] rounded-xl p-6 mb-6 border border-gray-700">
                  <p className="text-3xl font-bold text-[#FFCC00] mb-2">
                    {currentSession.amount} RCN
                  </p>
                  <p className="text-gray-400">
                    ≈ ${currentSession.amount}.00 USD
                  </p>
                </div>

                <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center space-x-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <span className="text-lg font-mono font-bold text-yellow-400">
                      {getTimeRemaining(currentSession.expiresAt)}
                    </span>
                  </div>
                  <p className="text-xs text-yellow-400 mt-1">Time Remaining</p>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={async () => {
                      if (!currentSession) return;

                      try {
                        const response = await apiClient.post(
                          "/tokens/redemption-session/cancel",
                          {
                            sessionId: currentSession.sessionId,
                          }
                        );

                        if (response.success) {
                          setSessionStatus("idle");
                          setCurrentSession(null);
                          setError(null);
                          setSuccess("Redemption request cancelled");
                          setTimeout(() => setSuccess(null), 3000);
                          // Refresh pending sessions
                          await checkForPendingSessions();
                        } else {
                          const errorData = await response.json();
                          setError(
                            errorData.error || "Failed to cancel request"
                          );
                          setTimeout(() => setError(null), 5000);
                        }
                      } catch (err) {
                        console.error("Error cancelling session:", err);
                        setError("Failed to cancel request");
                        setTimeout(() => setError(null), 5000);
                      }
                    }}
                    className="px-6 py-3 border border-red-500 text-red-500 rounded-xl hover:bg-red-900 hover:bg-opacity-20 font-medium transition-colors"
                  >
                    Cancel Request
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const response = await apiClient.get(
                          `/tokens/redemption-session/status/${currentSession.sessionId}`
                        );

                        if (response.success) {
                          const result = response;
                          if (result.data.status === "approved") {
                            setSessionStatus("processing");
                            await processRedemption();
                          } else {
                            setSuccess(
                              "Status refreshed - still waiting for approval"
                            );
                            setTimeout(() => setSuccess(null), 3000);
                          }
                        }
                      } catch (err) {
                        setError("Failed to refresh status");
                        setTimeout(() => setError(null), 3000);
                      }
                    }}
                    className="px-6 py-3 bg-[#FFCC00] text-black rounded-xl hover:bg-yellow-400 font-medium transition-colors flex items-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh Status</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Processing */}
          {sessionStatus === "processing" && (
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-12 border border-gray-800">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-green-900 bg-opacity-20 rounded-full mb-6">
                  <CheckCircle className="w-16 h-16 text-green-500 animate-bounce" />
                </div>
                <h3 className="text-2xl font-bold text-green-500 mb-2">
                  Customer Approved!
                </h3>
                <p className="text-gray-400 mb-4">Processing redemption...</p>

                {currentSession && (
                  <div className="inline-flex flex-col items-center bg-[#0D0D0D] rounded-xl p-4 border border-gray-700">
                    <p className="text-2xl font-bold text-[#FFCC00] mb-1">
                      {currentSession.amount} RCN
                    </p>
                    <p className="text-sm text-gray-400">
                      Processing withdrawal
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <svg
                    className="animate-spin h-8 w-8 text-[#FFCC00] mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            {/* Redemption Summary Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1C1C] to-[#252525] border border-gray-800">
              {/* Decorative Header */}
              <div className="p-1">
                <div className="bg-[#1C1C1C] px-6 py-4 rounded-t-3xl">
                  <div className="flex items-center gap-2">
                    <RedeemIcon width={24} height={24} color={"#FFCC00"} />
                    <h3 className="text-xl font-bold text-white">
                      Redemption Summary
                    </h3>
                  </div>
                </div>
              </div>

              {/* Redemption Details */}
              <div className="px-6 py-4 space-y-4">
                {/* Shop RCN Balance Display */}
                <div className="bg-[#0D0D0D] rounded-xl p-3 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Your Shop RCN</span>
                    <span className={`font-bold ${shopRcnBalance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Math.floor(shopRcnBalance)} RCN
                    </span>
                  </div>
                </div>

                {selectedCustomer && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#FFCC00] rounded-full"></div>
                        <span className="text-gray-300">Customer</span>
                      </div>
                      <span className="text-white font-semibold text-sm">
                        {selectedCustomer.name || "External"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-300">Tier</span>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${getTierColor(
                          selectedCustomer.tier
                        )}`}
                      >
                        {selectedCustomer.tier}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-300">Customer Balance</span>
                      </div>
                      <span className="text-white font-semibold text-sm">
                        {loadingBalance ? (
                          <span className="text-gray-400">Loading...</span>
                        ) : customerBalance !== null ? (
                          <span
                            className={
                              customerBalance > 0
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {Math.floor(customerBalance)} RCN
                          </span>
                        ) : (
                          <span className="text-gray-400">Unknown</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Amount Display */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-semibold text-lg">
                      Redemption Amount
                    </span>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[#FFCC00]">
                        {redeemAmount || 0} RCN
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#0D0D0D] rounded-xl p-3 text-center">
                    <span className="text-gray-400 text-sm">USD Value: </span>
                    <span className="text-white font-bold">
                      ${((redeemAmount || 0) * 0.10).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Insufficient Customer Balance Warning */}
                {selectedCustomer &&
                  redeemAmount > 0 &&
                  customerBalance !== null &&
                  customerBalance < redeemAmount && (
                    <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-xl p-4 mb-4">
                      <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-red-400 mb-1">
                            Customer Insufficient Balance
                          </h4>
                          <p className="text-sm text-red-300">
                            Customer has {Math.floor(customerBalance)} RCN, but{" "}
                            {redeemAmount} RCN requested.
                            {loadingBalance && " (Checking balance...)"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Insufficient Shop RCN Balance Warning */}
                {redeemAmount > 0 && shopRcnBalance < redeemAmount && (
                  <div className="bg-orange-900 bg-opacity-20 border border-orange-500 rounded-xl p-4 mb-4">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-orange-400 mb-1">
                          Shop Insufficient RCN
                        </h4>
                        <p className="text-sm text-orange-300">
                          Your shop has {Math.floor(shopRcnBalance)} RCN, but{" "}
                          {redeemAmount} RCN requested. Purchase more RCN to process this redemption.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cross-Shop Redemption Limit Warning */}
                {selectedCustomer &&
                  redeemAmount > 0 &&
                  crossShopInfo &&
                  !crossShopInfo.isHomeShop &&
                  redeemAmount > crossShopInfo.crossShopLimit && (
                    <div className="bg-purple-900 bg-opacity-20 border border-purple-500 rounded-xl p-4 mb-4">
                      <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-purple-500 mr-3 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-purple-400 mb-1">
                            Cross-Shop Limit Exceeded
                          </h4>
                          <p className="text-sm text-purple-300">
                            This is not the customer's home shop. Maximum redeemable here is{" "}
                            <span className="font-bold">{Math.floor(crossShopInfo.crossShopLimit)} RCN</span> (20% of balance).
                            Customer can redeem full balance at their home shop.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Process Button */}
                {(() => {
                  const insufficientCustomerBalance =
                    selectedCustomer &&
                    redeemAmount > 0 &&
                    customerBalance !== null &&
                    customerBalance < redeemAmount;
                  const insufficientShopBalance =
                    redeemAmount > 0 && shopRcnBalance < redeemAmount;
                  const crossShopLimitExceeded =
                    selectedCustomer &&
                    redeemAmount > 0 &&
                    crossShopInfo &&
                    !crossShopInfo.isHomeShop &&
                    redeemAmount > crossShopInfo.crossShopLimit;
                  const isSuspended =
                    selectedCustomer &&
                    (selectedCustomer.isActive === false ||
                      selectedCustomer.suspended);
                  const isDisabled =
                    sessionStatus !== "idle" ||
                    !selectedCustomer ||
                    !redeemAmount ||
                    redeemAmount <= 0 ||
                    insufficientCustomerBalance ||
                    insufficientShopBalance ||
                    crossShopLimitExceeded ||
                    loadingBalance ||
                    validatingRedemption ||
                    isSuspended;

                  return (
                    <button
                      onClick={createRedemptionSession}
                      disabled={isDisabled}
                      className="w-full bg-[#FFCC00] text-black font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105 disabled:transform-none"
                      title={
                        sessionStatus !== "idle"
                          ? `Session in progress (${sessionStatus})`
                          : !selectedCustomer
                          ? "Please select a customer"
                          : isSuspended
                          ? "Cannot process redemption for suspended customers"
                          : !redeemAmount || redeemAmount <= 0
                          ? `Please enter redemption amount (current: ${redeemAmount})`
                          : loadingBalance
                          ? "Loading customer balance..."
                          : insufficientCustomerBalance
                          ? `Customer has insufficient balance (${
                              Math.floor(customerBalance || 0)
                            } RCN available)`
                          : insufficientShopBalance
                          ? `Shop has insufficient RCN (${Math.floor(shopRcnBalance)} RCN available, need ${redeemAmount} RCN)`
                          : crossShopLimitExceeded
                          ? `Cross-shop limit: Max ${Math.floor(crossShopInfo?.crossShopLimit || 0)} RCN (20%) at this shop`
                          : "Send request to customer's device for approval"
                      }
                    >
                      {sessionStatus === "creating" ? (
                        <div className="flex items-center justify-center">
                          <svg
                            className="animate-spin h-5 w-5 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Processing...
                        </div>
                      ) : sessionStatus === "processing" ? (
                        <div className="flex items-center justify-center">
                          <svg
                            className="animate-spin h-5 w-5 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Redeeming...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Shield className="w-5 h-5" />
                          <span>Request Customer Approval</span>
                        </div>
                      )}
                    </button>
                  );
                })()}

                {/* Exchange Rate */}
                <p className="text-center text-xs text-gray-500">
                  Exchange Rate: 1 RCN = $0.10
                </p>
              </div>
            </div>

            {/* Session Stats Card */}
            {/* <div className="mt-6 bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-4">Session Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#FFCC00]">
                    {pendingSessions.length}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Pending</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {transactions.filter(t => t.status === 'confirmed').length}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Completed</p>
                </div>
              </div>
            </div> */}

            {/* Recent Transactions */}
            <div className="mt-6 bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Recent Redemptions
                </h3>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[#FFCC00] hover:text-yellow-400 text-sm"
                >
                  {showHistory ? "Hide" : "Show"}
                </button>
              </div>

              {showHistory && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {loadingTransactions ? (
                    <div className="text-center py-4">
                      <svg
                        className="animate-spin h-8 w-8 text-[#FFCC00] mx-auto"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </div>
                  ) : transactions.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">
                      No redemptions yet
                    </p>
                  ) : (
                    transactions.slice(0, 5).map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-[#0D0D0D] rounded-lg p-3 border border-gray-700"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {tx.customerName ||
                                `${tx.customerAddress.slice(0, 6)}...`}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-500">
                              -{tx.amount}
                            </p>
                            <p className="text-xs text-gray-400">RCN</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mt-6 bg-green-900 bg-opacity-20 border border-green-500 rounded-xl p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-green-500 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-green-400">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 bg-red-900 bg-opacity-20 border border-red-500 rounded-xl p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-500 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-blue-400" />
                Scan Customer QR Code
              </h3>
              <button
                onClick={stopQRScanner}
                className="p-2 hover:bg-gray-600 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-xl"
                playsInline
                muted
              />
              {cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
                  <div className="text-center">
                    <svg
                      className="animate-spin h-12 w-12 text-blue-400 mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <p className="text-white text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
              {!cameraLoading && (
                <div className="absolute inset-0 border-2 border-blue-400 rounded-xl">
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400"></div>
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400"></div>
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400"></div>
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400"></div>
                </div>
              )}
            </div>

            <p className="text-gray-400 text-sm mt-4 text-center">
              Position the customer&apos;s QR code within the frame to scan
              their wallet address
            </p>

            <button
              onClick={stopQRScanner}
              className="w-full mt-4 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
            >
              Cancel Scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
