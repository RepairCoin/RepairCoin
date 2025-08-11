'use client';

import React, { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { CheckCircle, XCircle, Clock, QrCode, Flame } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

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
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [qrShopId, setQrShopId] = useState('');
  const [qrAmount, setQrAmount] = useState(0);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);

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
            'Authorization': `Bearer ${localStorage.getItem('customerAuthToken') || ''}`
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSessions(result.data.sessions);
        setPendingCount(result.data.pendingCount);
      } else {
        console.error('Failed to load sessions:', response.status);
        if (response.status === 401) {
          console.error('Customer not authenticated - token may be missing or invalid');
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const burnTokens = async (sessionId: string, amount: number) => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    setBurnStatus(prev => ({
      ...prev,
      [sessionId]: { burning: true, burned: false }
    }));

    try {
      // Get the RepairCoin contract
      const contract = getContract({
        client,
        chain: baseSepolia,
        address: process.env.NEXT_PUBLIC_REPAIRCOIN_CONTRACT_ADDRESS || '0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5'
      });

      // Prepare the transfer to burn address
      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [BURN_ADDRESS, BigInt(amount) * BigInt(10 ** 18)] // Convert to wei
      });

      // Send the transaction from customer's wallet
      const result = await sendTransaction({
        transaction,
        account: account
      });

      console.log('Burn transaction sent:', result.transactionHash);
      
      // Update burn status
      setBurnStatus(prev => ({
        ...prev,
        [sessionId]: { 
          burning: false, 
          burned: true,
          transactionHash: result.transactionHash
        }
      }));

      toast.success(`Burned ${amount} RCN successfully!`);
      return result.transactionHash;

    } catch (error: any) {
      console.error('Error burning tokens:', error);
      setBurnStatus(prev => ({
        ...prev,
        [sessionId]: { burning: false, burned: false }
      }));
      
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction cancelled');
      } else if (error.message?.includes('insufficient')) {
        toast.error('Insufficient RCN balance');
      } else {
        toast.error('Failed to burn tokens');
      }
      throw error;
    }
  };

  const approveSession = async (sessionId: string, transactionHash?: string) => {
    setProcessing(sessionId);
    
    try {
      // In a real app, we'd sign the approval with the wallet
      const message = JSON.stringify({
        action: 'approve_redemption',
        sessionId,
        timestamp: new Date().toISOString(),
        burnTransactionHash: transactionHash
      });
      
      // Simulate wallet signature (in production, use actual wallet signing)
      const signature = `0x${Buffer.from(message).toString('hex')}`;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('customerAuthToken') || ''}`
          },
          body: JSON.stringify({ 
            sessionId, 
            signature,
            transactionHash // Include burn transaction hash if provided
          })
        }
      );

      if (response.ok) {
        toast.success('Redemption approved successfully');
        await loadSessions();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to approve redemption');
      }
    } catch (error) {
      toast.error('Failed to approve redemption');
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
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('customerAuthToken') || ''}`
          },
          body: JSON.stringify({ sessionId })
        }
      );

      if (response.ok) {
        toast.success('Redemption rejected');
        await loadSessions();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reject redemption');
      }
    } catch (error) {
      toast.error('Failed to reject redemption');
    } finally {
      setProcessing(null);
    }
  };

  const generateQRCode = async () => {
    if (!qrShopId || !qrAmount) {
      toast.error('Please select shop and enter amount');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/generate-qr`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('customerAuthToken') || ''}`
          },
          body: JSON.stringify({
            shopId: qrShopId,
            amount: qrAmount
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        setGeneratedQR(result.data.qrCode);
        toast.success('QR code generated! Show this to the shop.');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate QR code');
      }
    } catch (error) {
      toast.error('Failed to generate QR code');
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
            <p className="text-sm sm:text-base text-yellow-800 font-medium">
              You have {pendingCount} pending redemption request{pendingCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
        <button
          onClick={() => setShowQRGenerator(!showQRGenerator)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <QrCode className="w-5 h-5" />
          Generate QR Code for Redemption
        </button>
      </div>

      {/* QR Generator */}
      {showQRGenerator && (
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-4">Generate Redemption QR Code</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shop ID
              </label>
              <input
                type="text"
                value={qrShopId}
                onChange={(e) => setQrShopId(e.target.value)}
                placeholder="Enter shop ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (RCN)
              </label>
              <input
                type="number"
                min="1"
                value={qrAmount || ''}
                onChange={(e) => setQrAmount(parseInt(e.target.value) || 0)}
                placeholder="Enter amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={generateQRCode}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
            >
              Generate QR Code
            </button>

            {generatedQR && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">QR Code Data (expires in 60 seconds):</p>
                <div className="bg-white p-3 rounded border border-gray-200 break-all font-mono text-xs">
                  {generatedQR}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Show this to the shop for instant redemption
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Redemption Sessions */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-4">Redemption Requests</h3>
        
        {sessions.length === 0 ? (
          <p className="text-sm sm:text-base text-gray-500 text-center py-8">No redemption requests</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className={`p-4 rounded-lg border ${
                  session.status === 'pending' 
                    ? 'border-yellow-200 bg-yellow-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base text-gray-900">
                      {session.amount} RCN at {session.shopId}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      Requested: {new Date(session.createdAt).toLocaleString()}
                    </p>
                    {session.status === 'pending' && (
                      <p className="text-xs sm:text-sm text-yellow-700 mt-1">
                        Expires in: {getTimeRemaining(session.expiresAt)}
                      </p>
                    )}
                  </div>
                  
                  {session.status === 'pending' && (
                    <div className="flex gap-2">
                      {!burnStatus[session.sessionId]?.burned ? (
                        <button
                          onClick={() => burnTokens(session.sessionId, session.amount)}
                          disabled={processing === session.sessionId || burnStatus[session.sessionId]?.burning}
                          className="px-2 sm:px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-xs sm:text-sm flex items-center gap-1"
                        >
                          {burnStatus[session.sessionId]?.burning ? (
                            <>
                              <span className="animate-spin">⏳</span> Burning...
                            </>
                          ) : (
                            <>
                              <Flame className="w-4 h-4" /> Burn {session.amount} RCN
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => approveSession(session.sessionId, burnStatus[session.sessionId]?.transactionHash)}
                            disabled={processing === session.sessionId}
                            className="px-2 sm:px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs sm:text-sm"
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
                        disabled={processing === session.sessionId || burnStatus[session.sessionId]?.burning}
                        className="px-2 sm:px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-xs sm:text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  
                  {session.status === 'approved' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  
                  {session.status === 'rejected' && (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  
                  {session.status === 'used' && (
                    <span className="text-xs sm:text-sm text-gray-500">Completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}