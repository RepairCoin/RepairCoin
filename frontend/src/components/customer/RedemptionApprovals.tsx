"use client";

import React, { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CheckCircle, XCircle, Clock, QrCode, Flame } from "lucide-react";
import { toast } from "react-hot-toast";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { createThirdwebClient } from "thirdweb";
import { QRCodeModal } from "../QRCodeModal";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

interface RedemptionSession {
  sessionId: string;
  shopId: string;
  amount: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  burnTransactionHash?: string; // Track if tokens have been burned
}

interface BurnStatus {
  [sessionId: string]: {
    burning: boolean;
    burned: boolean;
    transactionHash?: string;
  };
}

export function RedemptionApprovals() {
  const account = useActiveAccount();
  const [sessions, setSessions] = useState<RedemptionSession[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [burnStatus, setBurnStatus] = useState<BurnStatus>({});

  // For QR generation
  const [qrShopId, setQrShopId] = useState("");
  const [qrAmount, setQrAmount] = useState(0);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (account?.address) {
      loadSessions();
      // Poll for new sessions
      const interval = setInterval(loadSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [account?.address]);

  const loadSessions = async () => {
    if (!account?.address) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/my-sessions`,
        {
          headers: {
            Authorization: `Bearer ${
              localStorage.getItem("customerAuthToken") || ""
            }`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSessions(result.data.sessions);
        setPendingCount(result.data.pendingCount);
      } else {
        console.error("Failed to load sessions:", response.status);
        if (response.status === 401) {
          console.error(
            "Customer not authenticated - token may be missing or invalid"
          );
        }
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const burnTokens = async (sessionId: string, amount: number) => {
    if (!account) {
      toast.error("Please connect your wallet");
      return;
    }

    setBurnStatus((prev) => ({
      ...prev,
      [sessionId]: { burning: true, burned: false },
    }));

    try {
      // Get the RepairCoin contract
      const contract = getContract({
        client,
        chain: baseSepolia,
        address:
          process.env.NEXT_PUBLIC_REPAIRCOIN_CONTRACT_ADDRESS ||
          "0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5",
      });

      // Prepare the transfer to burn address
      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [BURN_ADDRESS, BigInt(amount) * BigInt(10 ** 18)], // Convert to wei
      });

      // Send the transaction from customer's wallet
      const result = await sendTransaction({
        transaction,
        account: account,
      });

      console.log("Burn transaction sent:", result.transactionHash);

      // Update burn status
      setBurnStatus((prev) => ({
        ...prev,
        [sessionId]: {
          burning: false,
          burned: true,
          transactionHash: result.transactionHash,
        },
      }));

      toast.success(`Burned ${amount} RCN successfully!`);
      return result.transactionHash;
    } catch (error: any) {
      console.error("Error burning tokens:", error);
      setBurnStatus((prev) => ({
        ...prev,
        [sessionId]: { burning: false, burned: false },
      }));

      if (error.message?.includes("User rejected")) {
        toast.error("Transaction cancelled");
      } else if (error.message?.includes("insufficient")) {
        toast.error("Insufficient RCN balance");
      } else {
        toast.error("Failed to burn tokens");
      }
      throw error;
    }
  };

  const approveSession = async (
    sessionId: string,
    transactionHash?: string
  ) => {
    setProcessing(sessionId);

    try {
      // In a real app, we'd sign the approval with the wallet
      const message = JSON.stringify({
        action: "approve_redemption",
        sessionId,
        timestamp: new Date().toISOString(),
        burnTransactionHash: transactionHash,
      });

      // Simulate wallet signature (in production, use actual wallet signing)
      const signature = `0x${Buffer.from(message).toString("hex")}`;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              localStorage.getItem("customerAuthToken") || ""
            }`,
          },
          body: JSON.stringify({
            sessionId,
            signature,
            transactionHash, // Include burn transaction hash if provided
          }),
        }
      );

      if (response.ok) {
        toast.success("Redemption approved successfully");
        await loadSessions();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to approve redemption");
      }
    } catch (error) {
      toast.error("Failed to approve redemption");
    } finally {
      setProcessing(null);
    }
  };

  const rejectSession = async (sessionId: string) => {
    setProcessing(sessionId);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              localStorage.getItem("customerAuthToken") || ""
            }`,
          },
          body: JSON.stringify({ sessionId }),
        }
      );

      if (response.ok) {
        toast.success("Redemption rejected");
        await loadSessions();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to reject redemption");
      }
    } catch (error) {
      toast.error("Failed to reject redemption");
    } finally {
      setProcessing(null);
    }
  };

  const generateQRCode = async () => {
    if (!qrShopId || !qrAmount) {
      toast.error("Please select shop and enter amount");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/generate-qr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              localStorage.getItem("customerAuthToken") || ""
            }`,
          },
          body: JSON.stringify({
            shopId: qrShopId,
            amount: qrAmount,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setGeneratedQR(result.data.qrCode);
        setShowQRModal(true);
        toast.success("QR code generated! Show this to the shop.");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to generate QR code");
      }
    } catch (error) {
      toast.error("Failed to generate QR code");
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Approvals Alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-yellow-600 mr-3" />
            <p className="text-sm md:text-base text-yellow-800 font-medium">
              You have {pendingCount} pending redemption request
              {pendingCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* QR Generator */}
      <div
        className="bg-[#212121] rounded-xl md:rounded-2xl lg:rounded-3xl overflow-hidden"
        style={{
          backgroundImage: `url('/img/cus-approval-1.png')`,
          backgroundSize: "cover",
          backgroundPosition: "right",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div
          className="w-full px-4 md:px-6 lg:px-8 py-3 md:py-4 text-white rounded-t-xl md:rounded-t-2xl lg:rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "right",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-lg md:text-xl text-gray-900 font-bold">
            Generate Redemption QR Code
          </p>
        </div>
        <div className="flex flex-col w-2/3 p-8 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Shop ID
            </label>
            <input
              type="text"
              value={qrShopId}
              onChange={(e) => setQrShopId(e.target.value)}
              placeholder="Enter shop ID"
              className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (RCN)
            </label>
            <input
              type="number"
              min="1"
              value={qrAmount || ""}
              onChange={(e) => setQrAmount(parseInt(e.target.value) || 0)}
              placeholder="Enter amount"
              className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={generateQRCode}
            className="w-full flex items-center justify-center gap-2 bg-[#FFCC00] text-black py-2 rounded-lg transition mt-10"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
            >
              <rect width="24" height="24" fill="url(#pattern0_3380_5422)" />
              <defs>
                <pattern
                  id="pattern0_3380_5422"
                  patternContentUnits="objectBoundingBox"
                  width="1"
                  height="1"
                >
                  <use
                    xlinkHref="#image0_3380_5422"
                    transform="scale(0.00195312)"
                  />
                </pattern>
                <image
                  id="image0_3380_5422"
                  width="512"
                  height="512"
                  preserveAspectRatio="none"
                  xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAQAElEQVR4AezXC3bbOBYEUHr2v2cPlXT+li1RAB6Auj5iEsskgLpP6VT/7ziOd9fWBud4vQgQIHBJwL8PG/8beSsAlz4VHiJAgAABAgRWFTgOBWDd2Tk5AQIECBC4LKAAXKbzIAECBAgQWFPgdmoF4KbgIkCAAAECYQIKQNjAxSVAgACBdIHv+RWA7w5+JUCAAAECUQIKQNS4hSVAgACBdIEf+RWAHxJ+J0CAAAECQQIKQNCwRSVAgACBdIFf+RWAXxb+RIAAAQIEYgQUgJhRC0qAAAEC6QK/51cAftfwZwIECBAgECKgAIQMWkwCBAgQSBf4M78C8KeH7wgQIECAQISAAhAxZiEJECBAIF3g7/wKwN8ividAgAABAgECCkDAkEUkQIAAgXSBf/MrAP+aeIcAAQIECGwvoABsP2IBCRAgQCBd4KP8CsBHKt4jQIAAAQKbCygAmw9YPAIECBBIF/g4vwLwsYt3CRAgQIDA1gIKwNbjFY4AAQIE0gXu5VcA7sl4nwABAgQIbCygAGw8XNEIECBAIF3gfn4F4L6NnxAgQIAAgW0FFIBtRysYAQIECKQLfJZfAfhMx88IECBAgMCmAgrApoMViwABAgTSBT7PX1kA3s6juY6jt8HhiwABAhcFev/3yfrHt38DjoqvygJQkdeeBAgQIEAgQuCrkArAV0J+ToAAAQIENhRQADYcqkgECBAgkC7wdX4F4GsjdxAgQIAAge0EFIDtRioQAQIECKQLPJJfAXhEyT0ECBAgQGAzAQVgs4GKQ4AAAQLpAo/lVwAec3IXAQIECBDYSkAB2GqcwhAgQIBAusCj+RWAR6XcR4AAAQIENhJQADYapigECBAgkC7weH4F4HErdxIgQIAAgW0EFIBtRikIAQIECKQLPJNfAXhGy70ECBAgQGATAQVgk0GKQYAAAQLpAs/lVwCe83I3AQIECBDYQkAB2GKMQhAgQIBAusCz+RWAZ8XcT4AAAQIENhBQADYYoggECBAgkC7wfH4F4HkzTxAgQIAAgeUFFIDlRygAAQIECKQLXMmvAFxR8wwBAgQIEFhcQAFYfICOT4AAAQLpAtfyKwDX3DxFgAABAgSWFlAAlh6fwxMgQIBAusDV/ArAVTnPESBAgACBhQUUgIWH5+gECBAgkC5wPb8CcN3OkwQIECBAYFkBBWDZ0Tk4AQIECKQLvJI/tQC8n2iu42DQ1uD8WJW8quZYEvbctCqvfdv+fZnN8/xoZb1SC0DWlKUlQIAAgQ0FXoukALzm52kCBAgQILCkgAKw5NgcmgABAgTSBV7NrwC8Kuh5AgQIECCwoIACsODQHJkAAQIE0gVez68AvG5oBQIECBAgsJyAArDcyByYAAECBNIFWuRXAFooWoMAAQIECCwmoAAsNjDHJUCAAIF0gTb5FYA2jlYhQIAAAQJLCSgAS43LYQkQIEAgXaBVfgWglaR1CBAgQIDAQgIKwELDclQCBAgQSBdol18BaGdpJQIECBAgsIyAArDMqByUAAECBNIFWuZXAFpqWosAAQIECCwioAAsMijHJECAAIF0gbb5FYC2nlYjQIAAAQJLCCgAS4zJIQkQIEAgXaB1fgWgtaj1CBAgQIDAAgIKwAJDckQCBAgQSBdon18BaG9qRQIECBAgML2AAjD9iByQAAECBNIFeuRXAHqoWpMAAQIECEwuoABMPiDHI0CAAIF0gT75FYA+rlYlQIAAAQJTCygAU4/H4QgQIEAgXaBXfgWgl6x1CRAgQIDAxAIKwMTDcTQCBAgQSBfol18B6Gf70cpv55uu4+htcBR9vZ/7Vly9Pe+tf8aNet1z8P7R9O/04WuMgAIwxtkuBAgQIEDgaYGeDygAPXWtTYAAAQIEJhVQACYdjGMRIECAQLpA3/wKQF9fqxMgQIAAgSkFFIApx+JQBAgQIJAu0Du/AtBb2PoECBAgQGBCAQVgwqE4EgECBAikC/TPrwD0N7YDAQIECBCYTkABmG4kDkSAAAEC6QIj8isAI5TtQYAAAQIEJhNQACYbiOMQIECAQLrAmPwKwBhnuxAgQIAAgakEFICpxuEwBAgQIJAuMCq/AjBK2j4ECBAgQGAiAQVgomE4CgECBAikC4zLrwCMs7YTAQIECBCYRkABmGYUDkKAAAEC6QIj8ysAI7XtRYAAAQIEJhFQACYZhGMQIECAQLrA2PwKwFhvuxEgQIAAgSkEFIApxuAQBAgQIJAuMDq/AjBa3H4ECBAgQGACAQVggiE4AgECBAikC4zPrwCMN7cjAQIECBAoF1AAykfgAAQIECCQLlCRXwGoULcnAQIECBAoFlAAigdgewIECBBIF6jJrwDUuNuVAAECBAiUCigApfw2J0CAAIF0gar8twLwdm5ecZ3beg0SeD/3qbjObaNeFX+PbntWzPa2Z9RwC8PerCuuwshxW9/+Hg+/bgUgTlpgAgQIECAwh0DdKRSAOns7EyBAgACBMgEFoIzexgQIECCQLlCZXwGo1Lc3AQIECBAoElAAiuBtS4AAAQLpArX5FYBaf7sTIECAAIESAQWghN2mBAgQIJAuUJ1fAaiegP0JECBAgECBgAJQgG5LAgQIEEgXqM+vANTPwAkIECBAgMBwAQVgOLkNCRAgQCBdYIb8CsAMU3AGAgQIECAwWEABGAxuOwIECBBIF5gjvwIwxxycggABAgQIDBVQAIZy24wAAQIE0gVmya8AzDIJ5yBAgAABAgMFFICB2LYiQIAAgXSBefIrAPPMwkkIECBAgMAwAQVgGLWNCBAgQCBdYKb8CsBM03AWAgQIECAwSEABGARtGwIECBBIF5grvwIw1zychgABAgQIDBFQAIYw24QAAQIE0gVmy68AzDYR5yFAgAABAgMEFIAByLYgQIAAgXSB+fIrAPPNxIkIECBAgEB3AQWgO7ENCBAgQCBdYMb8CsCMU3EmAgQIECDQWUAB6AxseQIECBBIF5gzvwIw51xan+rtXLDiOrf1IkDgRYGKv7u3PV88tsdnF1AAZp+Q8xEgQIDA0gKzHl4BmHUyzkWAAAECBDoKKAAdcS1NgAABAukC8+ZXAOadjZMRIECAAIFuAgpAN1oLEyBAgEC6wMz5FYCZp+NsBAgQIECgk4AC0AnWsgQIECCQLjB3fgVg7vk4HQECBAgQ6CKgAHRhtSgBAgQIpAvMnl8BmH1CzkeAAAECBDoIKAAdUC1JgAABAukC8+dXAOafkRMSIECAAIHmAgpAc1ILEiBAgEC6wAr5FYAVpuSMBAgQIECgsYAC0BjUcgQIECCQLrBGfgVgjTk5JQECBAgQaCqgADTltBgBAgQIpAuskl8BWGVSzkmAAAECBBoKKAANMS1FgAABAukC6+RXANaZlZMSIECAAIFmAgpAM0oLESBAgEC6wEr5FYCVpuWsBAgQIECgkYAC0AjSMgQIECCQLrBWfgVgrXk5LQECBAgQaCKgADRhtAgBAgQIpAusll8BWG1izkuAAAECBBoIKAANEC1BgAABAukC6+VXANabmRMTIECAAIGXBRSAlwktQIAAAQLpAivmVwDGTu393M51HL0NTuao19uZtuI6t4169f7cWv/7fxuiPlSVYRWASn17EyBAgMAGAmtGUADWnJtTEyBAgACBlwQUgJf4PEyAAAEC6QKr5lcAVp2ccxMgQIAAgRcEFIAX8DxKgAABAukC6+ZXANadnZMTIECAAIHLAgrAZToPEiBAgEC6wMr5FYCVp+fsBAgQIEDgooACcBHOYwQIECCQLrB2fgVg7fk5PQECBAgQuCSgAFxi8xABAgQIpAusnl8BWH2Czk+AAAECBC4IKAAX0DxCgAABAukC6+dXANafoQQECBAgQOBpAQXgaTIPECBAgEC6wA75FYAdpigDAQIECBB4UkABeBLM7QQIECCQLrBHfgVgjzlKQYAAAQIEnhJQAJ7icjMBAgQIpAvskl8B2GWSchAgQIAAgScEFIAnsNxKgAABAukC++RXAPaZpSQECBAgQOBhAQXgYSo3EiBAgEC6wE75FYCdpikLAQIECBB4UEABeBDKbQQIECCQLrBXfgVgr3lKQ4AAAQIEHhJQAB5ichMBAgQIpAvsll8B2G2i8hAgQIAAgQcEFIAHkNxCgAABAukC++VPLQBv5yhdx8GgrcFR9PV+7ltxnduWvNI+tyXI56acT4SdX6kFYOeZykaAAAECjQV2XE4B2HGqMhEgQIAAgS8EFIAvgPyYAAECBNIF9syvAOw5V6kIECBAgMCnAgrApzx+SIAAAQLpArvmVwB2naxcBAgQIEDgEwEF4BMcPyJAgACBdIF98ysA+85WMgIECBAgcFdAAbhL4wcECBAgkC6wc34FYOfpykaAAAECBO4IKAB3YLxNgAABAukCe+dXAPaer3QECBAgQOBDAQXgQxZvEiBAgEC6wO75FYDdJywfAQIECBD4QEAB+ADFWwQIECCQLrB/fgVg/xlLSIAAAQIE/hFQAP4h8QYBAgQIpAsk5FcAEqYsIwECBAgQ+EtAAfgLxLcECBAgkC6QkV8ByJizlAQIECBA4A8BBeAPDt8QIECAQLpASn4FIGXSchIgQIAAgd8EFIDfMPyRAAECBNIFcvIrADmzlpQAAQIECPwUUAB+UvgDAQIECKQLJOVXAJKmLSsBAgQIEPhPQAH4D8JvBAgQIJAukJVfAciat7QECBAgQOCbgALwjcEvBAgQIJAukJY/tQC8n4N2HQeDtgbnxyrq5fPT9vNzz/Pt/FRVXPfOs+v7J3PWK7UAZE1ZWgIECBD4QiDvxwpA3swlJkCAAAEChwLgQ0CAAAEC8QKJAApA4tRlJkCAAIF4AQUg/iMAgAABAukCmfkVgMy5S02AAAEC4QIKQPgHQHwCBAikC6TmVwBSJy83AQIECEQLKADR4xeeAAEC6QK5+RWA3NlLToAAAQLBAgpA8PBFJ0CAQLpAcn4FIHn6shMgQIBArIACEDt6wQkQIJAukJ1fAciev/QECBAgECqgAIQOXmwCBAikC6TnVwDSPwHyEyBAgECkgAIQOXahCRAgkC4gvwLgM0CAAAECBAIFFIDAoYtMgACBdAH5j0MB8CkgQIAAAQKBAgpA4NBFJkCAQLaA9DcBBeCm4CJAgAABAmECCkDYwMUlQIBAuoD83wUUgO8OfiVAgAABAlECCkDUuIUlQIBAuoD8PwQUgB8SfidAgAABAkECCkDQsEUlQIBAuoD8vwQUgF8W/kSAAAECBGIEFICYUQtKgACBdAH5fxdILQBvJ0LSdcYteSUZ37K+n8oV121v13HsalDxmbrtuavnvVxH2ldqAUibs7wECBCIFwDwp4AC8KeH7wgQIECAQISAAhAxZiEJECCQLiD/3wIKwN8ividAgAABAgECCkDAkEUkQIBAuoD8/wooAP+aeIcAAQIECGwvoABsP2IBCRAgkC4g/0cCCsBHKt4jQIAAAQKbCygAmw9YY9ggagAADVVJREFUPAIECKQLyP+xgALwsYt3CRAgQIDA1gIKwNbjFY4AAQLpAvLfE1AA7sl4nwABAgQIbCygAGw8XNEIECCQLiD/fQEF4L6NnxAgQIAAgW0FFIBtRysYAQIE0gXk/0xAAfhMx88IECBAgMCmAgrApoMViwABAukC8n8uoAB87uOnBAgQIEBgSwEFYMuxCkWAAIF0Afm/ElAAvhLycwIECBAgsKGAArDhUEUiQIBAuoD8XwsoAF8buYMAAQIECGwnoABsN1KBCBAgkC4g/yMCCsAjSu4hQIAAAQKbCSgAmw1UHAIECKQLyP+YgALwmJO7CBAgQIDAVgIKwFbjFIYAAQLpAvI/KqAAPCrlPgIECBAgsJGAArDRMEUhQIBAuoD8jwsoAI9btbjz/Vyk4jq3jXpVGN/2fDuVK65z25LXLbPrOHoblAz33LR3rtnWPyNnvRSArHlLS4AAgY0FRHtGQAF4Rsu9BAgQIEBgEwEFYJNBikGAAIF0AfmfE1AAnvNyNwECBAgQ2EJAAdhijEIQIEAgXUD+ZwUUgGfF3E+AAAECBDYQUAA2GKIIBAgQSBeQ/3kBBeB5M08QIECAAIHlBRSA5UcoAAECBNIF5L8ioABcUfMMAQIECBBYXEABWHyAjk+AAIF0AfmvCSgA19w8RYAAAQIElhZQAJYen8MTIEAgXUD+qwIKwFU5zxEgQIAAgYUFFICFh+foBAgQSBeQ/7qAAnDdzpMECBAgQGBZAQVg2dE5OAECBNIF5H9FQAF4Rc+zBAgQIEBgUQEFYNHBOTYBAgTSBeR/TUABeM3P0wQIECBAYEkBBWDJsTk0AQIE0gXkf1VAAXhV0PMECBAgQGBBAQVgwaE5MgECBNIF5H9dQAF43dAKBAgQIEBgOQEFYLmROTABAgTSBeRvIaAAtFC0BgECBAgQWExAAVhsYI5LgACBdAH52wgoAG0crUKAAAECBJYSUACWGpfDEiBAIF1A/lYCqQXg/QSsuN7OfSuuc1uvjQUqPsu3PSs+y7c9q0Z529t1HL0NDl9jBFILwBhduxAgQIBAUwGLtRNQANpZWokAAQIECCwjoAAsMyoHJUCAQLqA/C0FFICWmtYiQIAAAQKLCCgAiwzKMQkQIJAuIH9bAQWgrafVCBAgQIDAEgIKwBJjckgCBAikC8jfWkABaC1qPQIECBAgsICAArDAkByRAAEC6QLytxdQANqbWpEAAQIECEwvoABMPyIHJECAQLqA/D0EFIAeqtYkQIAAAQKTCygAkw/I8QgQIJAuIH8fAQWgj6tVCRAgQIDA1AIKwNTjcTgCBAikC8jfS0AB6CVrXQIECBAgMLGAAjDxcByNAAEC6QLy9xNQAPrZWpkAAQIECEwroABMOxoHI0CAQLqA/D0FFICeutYmQIAAAQKTCigAkw7GsQgQIJAuIH9fAQWgr6/VCRAgQIDAlAIKwJRjcSgCBAikC8jfW0AB6C1sfQIECBAgMKGAAjDhUByJAAEC6QLy9xdQAPob24EAAQIECEwnoABMNxIHIkCAQLqA/CMEFIARyvYgQIAAAQKTCSgAkw3EcQgQIJAuIP8YAQVgjHPqLu9n8Irr7dy34jq3LXlVZL3tWTHb254lyIWb3jJXXIWRbT1CQAEYoWwPAgQIEHhQwG2jBBSAUdL2IUCAAAECEwkoABMNw1EIECCQLiD/OAEFYJy1nQgQIECAwDQCCsA0o3AQAgQIpAvIP1JAARipbS8CBAgQIDCJgAIwySAcgwABAukC8o8VUADGetuNAAECBAhMIaAATDEGhyBAgEC6gPyjBRSA0eL2I0CAAAECEwgoABMMwREIECCQLiD/eAEFYLy5HQkQIECAQLmAAlA+AgcgQIBAuoD8FQIKQIW6PQkQIECAQLGAAlA8ANsTIEAgXUD+GgEFoMbdrgQIECBAoFRAASjltzkBAgTSBeSvElAAquTtS4AAAQIECgUUgEJ8WxMgQCBdQP46AQWgzt7OBAgQIECgTEABKKO3MQECBNIF5K8UUAAq9e1NgAABAgSKBBSAInjbEiBAIF1A/loBBaDW3+4ECBAgQKBEQAEoYbcpAQIE0gXkrxZQAKonYH8CBAgQIFAgoAAUoNuSAAEC6QLy1wsoAPUzcAICBAgQIDBcQAEYTm5DAgQIpAvIP4NAagF4O/Errvdz34rr3LbkVWF827Mk7LlpxWxve55bl7xu1hVXSdjCTSuMb3sWRrb1CIHUAjDC1h4ECBAg8IGAt+YQuBWA2/9BVFxzCDgFAQIECBCoFaj4N/j9VgBqY9udAAECBIIERJ1FQAGYZRLOQYAAAQIEBgooAAOxbUWAAIF0AfnnEVAA5pmFkxAgQIAAgWECCsAwahsRIEAgXUD+mQQUgJmm4SwECBAgQGCQgAIwCNo2BAgQSBeQfy4BBWCueTgNAQIECBAYIqAADGG2CQECBNIF5J9NQAGYbSLOQ4AAAQIEBggoAAOQbUGAAIF0AfnnE1AA5puJExEgQIAAge4CCkB3YhsQIEAgXUD+GQUUgBmn4kwECBAgQKCzgALQGdjyBAgQSBeQf04BBWDOuTgVAQIECBDoKqAAdOW1OAECBNIF5J9VQAGYdTLORYAAAQIEOgooAB1xLU2AAIF0AfnnFVAA5p2NkxEgQIAAgW4CCkA3WgsTIEAgXUD+mQUUgJmn42wECBAgQKCTgALQCdayBAgQSBeQf24BBWDu+TgdAQIECBDoIqAAdGG1KAECBNIF5J9dQAGYfULOR4AAAQIEOggoAB1QLUmAAIF0AfnnF0gtAO/naCqut3PfiuvctuRVYVy5ZwnyuWlV5nPrqFeVc9q+UR+qyrCpBaDS3N4ECBDYXEC8FQQUgBWm5IwECBAgQKCxgALQGNRyBAgQSBeQfw0BBWCNOTklAQIECBBoKqAANOW0GAECBNIF5F9FQAFYZVLOSYAAAQIEGgooAA0xLUWAAIF0AfnXEVAA1pmVkxIgQIAAgWYCCkAzSgsRIEAgXUD+lQQUgJWm5awECBAgQKCRgALQCNIyBAgQSBeQfy0BBWCteTktAQIECBBoIqAANGG0CAECBNIF5F9NQAFYbWLOS4AAAQIEGggoAA0QLUGAAIF0AfnXE1AA1puZExMgQIAAgZcFFICXCS1AgACBdAH5VxRQAFacmjMTIECAAIEXBRSAFwE9ToAAgXQB+dcUUADWnJtTEyBAgACBlwQUgJf4PEyAAIF0AflXFVAAVp2ccxMgQIAAgRcEFIAX8DxKgACBdAH51xVQANadnZMTIECAAIHLAgrAZToPEiBAIF1A/pUFFICVp+fsBAgQIEDgooACcBHOYwQIEEgXkH9tAQVg7fk5PQECBAgQuCSgAFxi8xABAgTSBeRfXSC1ALydg6u4zm1LXhVZ7XkcuxscRV+7u8p3lPzdOdK+UgtA2pzlJUCAQFMBi60voACsP0MJCBAgQIDA0wIKwNNkHiBAgEC6gPw7CCgAO0xRBgIECBAg8KSAAvAkmNsJECCQLiD/HgIKwB5zlIIAAQIECDwloAA8xeVmAgQIpAvIv4uAArDLJOUgQIAAAQJPCCgAT2C5lQABAukC8u8joADsM0tJCBAgQIDAwwIKwMNUbiRAgEC6gPw7CSgAO01TFgIECBAg8KCAAvAglNsIECCQLiD/XgIKwF7zlIYAAQIECDwkoAA8xOQmAgQIpAvIv5uAArDbROUhQIAAAQIPCCgADyC5hQABAukC8u8noADsN1OJCBAgQIDAlwIKwJdEbiBAgEC6gPw7CigAO05VJgIECBAg8IWAAvAFkB8TIEAgXUD+PQUUgD3nKhUBAgQIEPhUQAH4lMcPCRAgkC4g/64CCsCuk5WLAAECBAh8IqAAfILjRwQIEEgXkH9fAQVg39lKRoAAAQIE7gooAHdp/IAAAQLpAvLvLKAA7Dxd2QgQIECAwB0BBeAOjLcJECCQLiD/3gIKwN7zlY4AAQIECHwooAB8yOJNAgQIpAvIv7tAZQF4P3Fdx9Hb4GT2IkCAwCWB3v99sv73fwMuDefVhyoLwKtn9zwBAgQIdBKw7P4CCsD+M5aQAAECBAj8I6AA/EPiDQIECKQLyJ8goAAkTFlGAgQIECDwl4AC8BeIbwkQIJAuIH+GgAKQMWcpCRAgQIDAHwIKwB8cviFAgEC6gPwpAgpAyqTlJECAAAECvwkoAL9h+CMBAgTSBeTPEVAAcmYtKQECBAgQ+CmgAPyk8AcCBAikC8ifJKAAJE1bVgIECBAg8J+AAvAfhN8IECCQLiB/loACkDVvaQkQIECAwDcBBeAbg18IECCQLiB/moACkDZxeQkQIECAwCmgAJwIXgQIEEgXkD9PQAHIm7nEBAgQIEDgUAB8CAgQIBAvACBRQAFInLrMBAgQIBAvoADEfwQAECCQLiB/poACkDl3qQkQIEAgXEABCP8AiE+AQLqA/KkCCkDq5OUmQIAAgWgBBSB6/MITIJAuIH+ugAKQO3vJCRAgQCBYQAEIHr7oBAikC8ifLKAAJE9fdgIECBCIFVAAYkcvOAEC6QLyZwv8HwAA///wTodrAAAABklEQVQDAD+2VYmMUZOuAAAAAElFTkSuQmCC"
                />
              </defs>
            </svg>
            Generate QR Code
          </button>
        </div>
      </div>

      {/* Redemption Sessions */}
      <div className="bg-[#212121] rounded-xl md:rounded-2xl lg:rounded-3xl overflow-hidden">
        <div
          className="w-full px-4 md:px-6 lg:px-8 py-3 md:py-4 text-white rounded-t-xl md:rounded-t-2xl lg:rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "right",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-lg md:text-xl text-gray-900 font-bold">
            Generate Redemption QR Code
          </p>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm md:text-base text-gray-500 text-center py-8">
            No redemption requests
          </p>
        ) : (
          <div className="flex flex-col w-full p-8 gap-6">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className={`p-4 rounded-lg ${
                  session.status === "pending"
                    ? "bg-yellow-50"
                    : "bg-[#525252]"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm md:text-base text-gray-100">
                      <span className="text-[#FFCC00]">{session.amount} RCN</span> at {session.shopId}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested: {new Date(session.createdAt).toLocaleString()}
                    </p>
                    {session.status === "pending" && (
                      <p className="text-xs text-yellow-400 mt-1">
                        Expires in: {getTimeRemaining(session.expiresAt)}
                      </p>
                    )}
                  </div>

                  {session.status === "pending" && (
                    <div className="flex gap-2">
                      {!burnStatus[session.sessionId]?.burned ? (
                        <button
                          onClick={() =>
                            burnTokens(session.sessionId, session.amount)
                          }
                          disabled={
                            processing === session.sessionId ||
                            burnStatus[session.sessionId]?.burning
                          }
                          className="px-2 md:px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-xs md:text-sm flex items-center gap-1"
                        >
                          {burnStatus[session.sessionId]?.burning ? (
                            <>
                              <span className="animate-spin">⏳</span>{" "}
                              Burning...
                            </>
                          ) : (
                            <>
                              <Flame className="w-4 h-4" /> Burn{" "}
                              {session.amount} RCN
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              approveSession(
                                session.sessionId,
                                burnStatus[session.sessionId]?.transactionHash
                              )
                            }
                            disabled={processing === session.sessionId}
                            className="px-2 md:px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs md:text-sm"
                          >
                            Approve
                          </button>
                          <span className="text-xs text-green-600 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" /> Burned
                          </span>
                        </>
                      )}
                      <button
                        onClick={() => rejectSession(session.sessionId)}
                        disabled={
                          processing === session.sessionId ||
                          burnStatus[session.sessionId]?.burning
                        }
                        className="px-2 md:px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-xs md:text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {session.status === "approved" && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}

                  {session.status === "rejected" && (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}

                  {session.status === "used" && (
                    <span className="text-xs md:text-sm text-gray-500">
                      Completed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {generatedQR && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          qrData={generatedQR}
          title="Redemption QR Code"
          description={`Redeem ${qrAmount} RCN at ${qrShopId}`}
        />
      )}
    </div>
  );
}
