'use client';

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Wallet,
  Search,
  CreditCard,
  Shield,
  TrendingDown,
  AlertCircle,
  ChevronRight,
  Smartphone,
  UserCheck,
  History,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface RedeemTabProps {
  shopId: string;
  onRedemptionComplete: () => void;
}

interface RedemptionTransaction {
  id: string;
  customerAddress: string;
  customerName?: string;
  amount: number;
  timestamp: string;
  status: 'confirmed' | 'pending' | 'failed';
  transactionHash?: string;
}

interface RedemptionSession {
  sessionId: string;
  customerAddress: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'used';
  expiresAt: string;
}

interface ShopCustomer {
  address: string;
  name?: string;
  tier: string;
  lifetime_earnings: number;
  last_transaction_date?: string;
  total_transactions: number;
}

interface ShopData {
  purchasedRcnBalance: number;
}

type RedemptionFlow = 'two-factor' | 'qr-scan';

export const RedeemTabV2: React.FC<RedeemTabProps> = ({ shopId, onRedemptionComplete }) => {
  const [flow, setFlow] = useState<RedemptionFlow>('two-factor');

  // Two-factor flow states
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<ShopCustomer | null>(null);
  const [shopCustomers, setShopCustomers] = useState<ShopCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [redeemAmount, setRedeemAmount] = useState<number>(0);
  const [currentSession, setCurrentSession] = useState<RedemptionSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'creating' | 'waiting' | 'processing'>('idle');
  const [showingAllCustomers, setShowingAllCustomers] = useState(false);
  const [shopData, setShopData] = useState<ShopData | null>(null);

  // QR scan flow states
  const [qrCode, setQrCode] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);

  // Common states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingSessions, setPendingSessions] = useState<RedemptionSession[]>([]);

  // Transaction history states
  const [transactions, setTransactions] = useState<RedemptionTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Load shop data
  const loadShopData = async () => {
    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}`,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : ''
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setShopData({
          purchasedRcnBalance: result.data.purchasedRcnBalance || 0
        });
      }
    } catch (err) {
      console.error('Error loading shop data:', err);
    }
  };

  // Load shop customers and check for pending sessions on mount
  useEffect(() => {
    loadShopData();
    loadShopCustomers();
    loadRedemptionHistory();
    checkForPendingSessions();
    
    // Set up interval to check for pending sessions every 30 seconds
    const interval = setInterval(() => {
      if (sessionStatus === 'idle') {
        checkForPendingSessions();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [shopId]);

  const loadShopCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/customers?limit=100`,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : ''
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        const shopCustomers = result.data.customers || [];

        if (shopCustomers.length === 0) {
          const allCustomersResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/customers?limit=100`,
            {
              headers: {
                'Authorization': authToken ? `Bearer ${authToken}` : ''
              }
            }
          );

          if (allCustomersResponse.ok) {
            const allCustomersResult = await allCustomersResponse.json();
            const allCustomers = allCustomersResult.data?.customers || [];

            const transformedCustomers = allCustomers.map((customer: any) => ({
              address: customer.address,
              name: customer.name || customer.email || 'Unnamed Customer',
              tier: customer.tier || 'BRONZE',
              lifetime_earnings: customer.lifetimeEarnings || 0,
              last_transaction_date: customer.lastEarnedDate,
              total_transactions: 0
            }));

            setShopCustomers(transformedCustomers);
            setShowingAllCustomers(true);
          } else {
            setShopCustomers([]);
          }
        } else {
          setShopCustomers(shopCustomers);
          setShowingAllCustomers(false);
        }
      } else {
        const allCustomersResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/customers?limit=100`,
          {
            headers: {
              'Authorization': authToken ? `Bearer ${authToken}` : ''
            }
          }
        );

        if (allCustomersResponse.ok) {
          const allCustomersResult = await allCustomersResponse.json();
          const allCustomers = allCustomersResult.data?.customers || [];

          const transformedCustomers = allCustomers.map((customer: any) => ({
            address: customer.address,
            name: customer.name || customer.email || 'Unnamed Customer',
            tier: customer.tier || 'BRONZE',
            lifetime_earnings: customer.lifetimeEarnings || 0,
            last_transaction_date: customer.lastEarnedDate,
            total_transactions: 0
          }));

          setShopCustomers(transformedCustomers);
          setShowingAllCustomers(true);
        }
      }
    } catch (err) {
      console.error('Error loading customers:', err);
      setShopCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadRedemptionHistory = async () => {
    setLoadingTransactions(true);
    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/transactions?type=redeem&limit=20`,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : ''
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        const redemptions = result.data?.transactions || [];

        const transformedTransactions = redemptions.map((tx: any) => ({
          id: tx.id,
          customerAddress: tx.customerAddress,
          customerName: tx.customerName || 'Unknown Customer',
          amount: tx.amount,
          timestamp: tx.timestamp,
          status: tx.status || 'confirmed',
          transactionHash: tx.transactionHash
        }));

        setTransactions(transformedTransactions);
      }
    } catch (err) {
      console.error('Error loading redemption history:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const checkForPendingSessions = async () => {
    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      if (!authToken) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/pending-sessions`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        const sessions = result.data?.sessions || [];
        
        // Filter out expired sessions
        const activeSessions = sessions.filter((session: any) => 
          new Date(session.expiresAt) > new Date()
        );
        
        setPendingSessions(activeSessions);

        if (activeSessions.length > 0 && sessionStatus === 'idle') {
          
          if (activeSessions.length > 0) {
            const latestSession = activeSessions[0];
            
            // Find the customer in our list
            const customer = shopCustomers.find(c => 
              c.address.toLowerCase() === latestSession.customerAddress.toLowerCase()
            );
            
            if (customer) {
              setSelectedCustomer(customer);
            }
            
            setCurrentSession({
              sessionId: latestSession.sessionId,
              customerAddress: latestSession.customerAddress,
              amount: latestSession.maxAmount,
              status: latestSession.status,
              expiresAt: latestSession.expiresAt
            });
            setSessionStatus('waiting');
            setCustomerAddress(latestSession.customerAddress);
            setRedeemAmount(latestSession.maxAmount);
            setFlow('two-factor');
            
            // Show notification
            setSuccess(`Pending redemption request from customer: ${latestSession.amount} RCN`);
            setTimeout(() => setSuccess(null), 5000);
          }
        }
      }
    } catch (err) {
      console.error('Error checking for pending sessions:', err);
    }
  };

  const handleCustomerSelect = (customer: ShopCustomer) => {
    setSelectedCustomer(customer);
    setCustomerAddress(customer.address);
  };

  const filteredCustomers = shopCustomers.filter(customer => {
    if (!customerSearch.trim()) return false;

    const searchLower = customerSearch.toLowerCase().trim();
    const nameMatch = customer.name && customer.name.toLowerCase().includes(searchLower);
    const addressMatch = customer.address.toLowerCase().includes(searchLower);

    return nameMatch || addressMatch;
  });

  // Poll for session status updates
  useEffect(() => {
    if (currentSession && sessionStatus === 'waiting') {
      let pollCount = 0;
      const maxPolls = 150; // 5 minutes max (2 seconds * 150)
      
      const interval = setInterval(async () => {
        pollCount++;
        
        if (pollCount > maxPolls) {
          setError('Request timeout - please try again');
          setSessionStatus('idle');
          setCurrentSession(null);
          clearInterval(interval);
          return;
        }
        
        try {
          const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/status/${currentSession.sessionId}`, {
            headers: {
              'Authorization': authToken ? `Bearer ${authToken}` : ''
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            const sessionData = result.data;
            
            // Update session expiry time
            setCurrentSession(prev => prev ? {...prev, expiresAt: sessionData.expiresAt} : null);
            
            if (sessionData.status === 'approved') {
              setSessionStatus('processing');
              clearInterval(interval);
              await processRedemption();
            } else if (sessionData.status === 'rejected') {
              setError('Customer rejected the redemption request');
              setSessionStatus('idle');
              setCurrentSession(null);
              clearInterval(interval);
            } else if (sessionData.status === 'expired' || new Date(sessionData.expiresAt) < new Date()) {
              setError('Redemption request expired');
              setSessionStatus('idle');
              setCurrentSession(null);
              clearInterval(interval);
            } else if (sessionData.status === 'used') {
              setSuccess('This redemption session has already been processed');
              setSessionStatus('idle');
              setCurrentSession(null);
              clearInterval(interval);
            }
          } else if (response.status === 404) {
            // Session not found
            setError('Session not found or has been cancelled');
            setSessionStatus('idle');
            setCurrentSession(null);
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Error checking session status:', err);
          // Don't clear interval on network errors - keep trying
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [currentSession, sessionStatus]);

  const createRedemptionSession = async () => {
    const finalAddress = selectedCustomer?.address || customerAddress;

    if (!finalAddress || !redeemAmount) {
      setError('Please search and select a customer, then enter amount');
      return;
    }

    setSessionStatus('creating');
    setError(null);
    setSuccess(null);

    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        body: JSON.stringify({
          customerAddress: finalAddress,
          shopId,
          amount: redeemAmount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create redemption session');
      }

      const result = await response.json();
      const newSession = {
        sessionId: result.data.sessionId,
        customerAddress: finalAddress,
        amount: redeemAmount,
        status: 'pending' as const,
        expiresAt: result.data.expiresAt
      };
      setCurrentSession(newSession);
      setSessionStatus('waiting');

    } catch (err) {
      console.error('Session creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create session');
      setSessionStatus('idle');
    }
  };

  const processRedemption = async () => {
    if (!currentSession) return;

    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        body: JSON.stringify({
          customerAddress: currentSession.customerAddress,
          amount: currentSession.amount,
          sessionId: currentSession.sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Redemption failed');
      }

      setSuccess(`Successfully redeemed ${currentSession.amount} RCN for customer`);

      // Reset form
      setCustomerAddress('');
      setSelectedCustomer(null);
      setRedeemAmount(0);
      setCurrentSession(null);
      setSessionStatus('idle');
      setCustomerSearch('');

      await loadRedemptionHistory();
      await loadShopData();
      await checkForPendingSessions();
      onRedemptionComplete();

    } catch (err) {
      console.error('Redemption error:', err);
      setError(err instanceof Error ? err.message : 'Redemption failed');
      setSessionStatus('idle');
    }
  };

  const validateQRCode = async () => {
    if (!qrCode) {
      setError('Please enter or scan a QR code');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/validate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        body: JSON.stringify({ qrCode })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid QR code');
      }

      const result = await response.json();
      setScanResult(result.data);

      await processQRRedemption(result.data);

    } catch (err) {
      console.error('QR validation error:', err);
      setError(err instanceof Error ? err.message : 'QR validation failed');
    }
  };

  const processQRRedemption = async (sessionData: any) => {
    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        body: JSON.stringify({
          customerAddress: sessionData.customerAddress,
          amount: sessionData.amount,
          sessionId: sessionData.sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Redemption failed');
      }

      setSuccess(`Successfully redeemed ${sessionData.amount} RCN via QR code`);
      setQrCode('');
      setScanResult(null);
      await loadShopData();
      await loadRedemptionHistory();
      await checkForPendingSessions();
      onRedemptionComplete();

    } catch (err) {
      console.error('QR redemption error:', err);
      setError(err instanceof Error ? err.message : 'QR redemption failed');
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

  const getTierColor = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case 'GOLD': return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white';
      case 'SILVER': return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white';
      case 'BRONZE': return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white';
    }
  };

  const hasSufficientBalance = (shopData?.purchasedRcnBalance || 0) >= redeemAmount;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Sessions Alert */}
          {pendingSessions.length > 0 && sessionStatus === 'idle' && (
            <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mr-3" />
                  <div>
                    <h4 className="font-semibold text-yellow-500">
                      {pendingSessions.length} Pending Redemption{pendingSessions.length > 1 ? 's' : ''}
                    </h4>
                    <p className="text-sm text-yellow-400">
                      Customer{pendingSessions.length > 1 ? 's are' : ' is'} waiting for redemption approval
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const session = pendingSessions[0];
                    setCurrentSession(session);
                    setSessionStatus('waiting');
                    setCustomerAddress(session.customerAddress);
                    setRedeemAmount(session.amount);
                    setFlow('two-factor');
                  }}
                  className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                >
                  Review
                </button>
              </div>
            </div>
          )}
          {/* Method Selection Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <label className="relative cursor-pointer">
              <input
                type="radio"
                name="redemptionFlow"
                value="two-factor"
                checked={flow === 'two-factor'}
                onChange={() => setFlow('two-factor')}
                className="sr-only"
              />
              <div className={`p-4 rounded-xl border transition-all ${
                flow === 'two-factor'
                  ? "bg-[#FFCC00] bg-opacity-10 border-[#FFCC00]"
                  : "bg-[#0D0D0D] border-gray-700 hover:border-gray-600"
              }`}>
                <div className="flex items-start space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                    flow === 'two-factor'
                      ? "border-[#FFCC00] bg-[#FFCC00]"
                      : "border-gray-500"
                  }`}>
                    {flow === 'two-factor' && (
                      <svg className="w-full h-full text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">Two-Factor Approval</span>
                      <Smartphone className="w-5 h-5 text-[#FFCC00]" />
                    </div>
                    <p className="text-gray-400 text-sm">Request customer approval via mobile app</p>
                  </div>
                </div>
              </div>
            </label>

            <label className="relative cursor-pointer">
              <input
                type="radio"
                name="redemptionFlow"
                value="qr-scan"
                checked={flow === 'qr-scan'}
                onChange={() => setFlow('qr-scan')}
                className="sr-only"
              />
              <div className={`p-4 rounded-xl border transition-all ${
                flow === 'qr-scan'
                  ? "bg-[#FFCC00] bg-opacity-10 border-[#FFCC00]"
                  : "bg-[#0D0D0D] border-gray-700 hover:border-gray-600"
              }`}>
                <div className="flex items-start space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                    flow === 'qr-scan'
                      ? "border-[#FFCC00] bg-[#FFCC00]"
                      : "border-gray-500"
                  }`}>
                    {flow === 'qr-scan' && (
                      <svg className="w-full h-full text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">QR Code Scan</span>
                      <QrCode className="w-5 h-5 text-[#FFCC00]" />
                    </div>
                    <p className="text-gray-400 text-sm">Instant redemption via QR code</p>
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* Two-Factor Flow */}
          {flow === 'two-factor' && sessionStatus === 'idle' && (
            <>
              {/* Customer Search Card */}
              <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Find Customer</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Search Customer
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          if (selectedCustomer && !e.target.value.includes(selectedCustomer.address.slice(0, 6))) {
                            setSelectedCustomer(null);
                            setCustomerAddress('');
                          }
                        }}
                        placeholder="Search by name or wallet address (0x...)..."
                        className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all pl-10"
                      />
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      {loadingCustomers && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <svg className="animate-spin h-5 w-5 text-[#FFCC00]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Search Results */}
                  {customerSearch && (
                    <div className="bg-[#0D0D0D] rounded-xl border border-gray-700 max-h-64 overflow-y-auto">
                      {filteredCustomers.length > 0 ? (
                        <div>
                          {filteredCustomers.map((customer) => (
                            <button
                              key={customer.address}
                              onClick={() => {
                                handleCustomerSelect(customer);
                                setCustomerSearch('');
                              }}
                              className={`w-full p-4 hover:bg-gray-800 transition-colors border-b border-gray-700 last:border-b-0 ${
                                selectedCustomer?.address === customer.address ? 'bg-gray-800' : ''
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div className="text-left">
                                  <p className="font-semibold text-white">
                                    {customer.name || 'Unnamed Customer'}
                                  </p>
                                  <p className="text-xs text-gray-400 font-mono">
                                    {customer.address.slice(0, 6)}...{customer.address.slice(-4)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className={`px-2 py-1 rounded-full text-xs font-bold ${getTierColor(customer.tier)}`}>
                                    {customer.tier}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-white">{customer.lifetime_earnings} RCN</p>
                                    <p className="text-xs text-gray-400">Lifetime</p>
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : customerSearch.match(/^0x[a-fA-F0-9]{40}$/i) ? (
                        <button
                          onClick={() => {
                            setCustomerAddress(customerSearch);
                            setSelectedCustomer({
                              address: customerSearch,
                              name: 'External Customer',
                              tier: 'UNKNOWN',
                              lifetime_earnings: 0,
                              total_transactions: 0
                            });
                            setCustomerSearch('');
                          }}
                          className="w-full p-4 hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Wallet className="w-5 h-5 text-[#FFCC00]" />
                              <div className="text-left">
                                <p className="text-sm font-medium text-[#FFCC00]">Use This Address</p>
                                <p className="text-xs text-gray-400 font-mono">
                                  {customerSearch.slice(0, 10)}...{customerSearch.slice(-8)}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </button>
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          {customerSearch.length < 3 ? 'Keep typing to search...' : 'No customers found'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Customer Display */}
                  {selectedCustomer && !customerSearch && (
                    <div className="bg-[#0D0D0D] rounded-xl p-4 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${getTierColor(selectedCustomer.tier)}`}>
                            {selectedCustomer.tier} TIER
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {selectedCustomer.name || 'External Customer'}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {selectedCustomer.address.slice(0, 8)}...{selectedCustomer.address.slice(-6)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerAddress('');
                          }}
                          className="text-[#FFCC00] hover:text-yellow-400 text-sm font-medium"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Input Card */}
              <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Redemption Amount</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Enter Amount (RCN)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={redeemAmount || ''}
                      onChange={(e) => setRedeemAmount(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all text-2xl font-bold"
                    />
                  </div>

                  {/* Quick amount buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 25, 50, 100].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setRedeemAmount(amount)}
                        className="px-3 py-2 bg-[#0D0D0D] hover:bg-gray-800 border border-gray-700 rounded-lg font-medium text-gray-300 transition-colors"
                      >
                        {amount} RCN
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Warning if insufficient balance */}
              {!hasSufficientBalance && redeemAmount > 0 && (
                <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-xl p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="font-semibold text-yellow-500 mb-1">Insufficient Balance</h4>
                      <p className="text-sm text-yellow-400">
                        Need {redeemAmount} RCN but only have {shopData?.purchasedRcnBalance || 0} RCN available.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* QR Code Flow */}
          {flow === 'qr-scan' && (
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                  <QrCode className="w-5 h-5 text-[#FFCC00]" />
                </div>
                <h2 className="text-xl font-semibold text-white">QR Code Redemption</h2>
              </div>

              <div className="space-y-4">
                {/* QR Scanner Status */}
                <div className="bg-[#0D0D0D] rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400">Scanner Status</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-400">Ready</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#1C1C1C] rounded-lg p-2">
                      <p className="text-xs text-gray-500">Scan Mode</p>
                      <p className="text-sm font-semibold text-white">Manual</p>
                    </div>
                    <div className="bg-[#1C1C1C] rounded-lg p-2">
                      <p className="text-xs text-gray-500">Shop Balance</p>
                      <p className="text-sm font-semibold text-[#FFCC00]">{shopData?.purchasedRcnBalance || 0} RCN</p>
                    </div>
                    <div className="bg-[#1C1C1C] rounded-lg p-2">
                      <p className="text-xs text-gray-500">Session Type</p>
                      <p className="text-sm font-semibold text-white">QR</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-center py-6">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-[#FFCC00] bg-opacity-10 rounded-2xl mb-4">
                    <QrCode className="w-12 h-12 text-[#FFCC00]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Scan Customer QR Code</h3>
                  <p className="text-gray-400 text-sm">
                    Customer should open their RepairCoin app and show the QR code
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    QR Code Data
                  </label>
                  <div className="relative">
                    <textarea
                      value={qrCode}
                      onChange={(e) => {
                        setQrCode(e.target.value);
                        setScanResult(null);
                        setError(null);
                      }}
                      placeholder="Paste QR code data here or use camera scanner..."
                      className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all h-32 font-mono text-sm pr-12"
                    />
                    {qrCode && (
                      <button
                        onClick={() => {
                          setQrCode('');
                          setScanResult(null);
                          setError(null);
                        }}
                        className="absolute right-3 top-3 text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Tip: Use a QR scanner app to copy the code data
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      // Simulate camera scanner (placeholder)
                      setError('Camera scanner not available - please paste QR code manually');
                      setTimeout(() => setError(null), 3000);
                    }}
                    className="bg-[#0D0D0D] hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-xl border border-gray-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>Open Camera</span>
                  </button>
                  
                  <button
                    onClick={validateQRCode}
                    disabled={!qrCode || !!scanResult}
                    className="bg-gradient-to-r from-[#FFCC00] to-[#FFA500] text-black font-bold py-3 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-yellow-500/25 flex items-center justify-center gap-2"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Validate</span>
                  </button>
                </div>

                {scanResult && (
                  <div className="space-y-3">
                    <div className="bg-green-900 bg-opacity-20 border border-green-500 rounded-xl p-4">
                      <div className="flex items-start">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-3" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-500 mb-2">QR Code Validated</h4>
                          <div className="bg-[#0D0D0D] rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Customer</span>
                              <span className="text-sm font-mono text-white">
                                {scanResult.customerAddress?.slice(0, 6)}...{scanResult.customerAddress?.slice(-4)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Amount</span>
                              <span className="text-sm font-bold text-[#FFCC00]">{scanResult.amount} RCN</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Session ID</span>
                              <span className="text-sm font-mono text-gray-300">
                                {scanResult.sessionId?.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => processQRRedemption(scanResult)}
                      disabled={!scanResult}
                      className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFA500] text-black font-bold py-4 px-6 rounded-xl transition-all hover:shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        <span>Process Redemption ({scanResult.amount} RCN)</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Waiting for Approval */}
          {sessionStatus === 'waiting' && currentSession && (
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-8 border border-gray-800">
              <div className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="animate-pulse">
                    <Clock className="w-20 h-20 text-[#FFCC00] mx-auto" />
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">Request Sent!</h3>
                <p className="text-gray-400 mb-6">
                  Waiting for customer approval
                </p>

                <div className="inline-flex items-center bg-[#0D0D0D] rounded-xl px-4 py-2 mb-6">
                  <span className="font-mono text-sm text-gray-300">
                    {currentSession.customerAddress.slice(0, 6)}...{currentSession.customerAddress.slice(-4)}
                  </span>
                </div>

                <div className="bg-[#0D0D0D] rounded-xl p-6 mb-6 border border-gray-700">
                  <p className="text-3xl font-bold text-[#FFCC00] mb-2">
                    {currentSession.amount} RCN
                  </p>
                  <p className="text-gray-400">≈ ${currentSession.amount}.00 USD</p>
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
                    onClick={() => {
                      setSessionStatus('idle');
                      setCurrentSession(null);
                      setError(null);
                      setSuccess('Redemption request cancelled');
                      setTimeout(() => setSuccess(null), 3000);
                    }}
                    className="px-6 py-3 border border-red-500 text-red-500 rounded-xl hover:bg-red-900 hover:bg-opacity-20 font-medium transition-colors"
                  >
                    Cancel Request
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
                        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/status/${currentSession.sessionId}`, {
                          headers: {
                            'Authorization': authToken ? `Bearer ${authToken}` : ''
                          }
                        });
                        if (response.ok) {
                          const result = await response.json();
                          if (result.data.status === 'approved') {
                            setSessionStatus('processing');
                            await processRedemption();
                          } else {
                            setSuccess('Status refreshed - still waiting for approval');
                            setTimeout(() => setSuccess(null), 3000);
                          }
                        }
                      } catch (err) {
                        setError('Failed to refresh status');
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
          {sessionStatus === 'processing' && (
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-12 border border-gray-800">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-green-900 bg-opacity-20 rounded-full mb-6">
                  <CheckCircle className="w-16 h-16 text-green-500 animate-bounce" />
                </div>
                <h3 className="text-2xl font-bold text-green-500 mb-2">Customer Approved!</h3>
                <p className="text-gray-400 mb-4">Processing redemption...</p>
                
                {currentSession && (
                  <div className="inline-flex flex-col items-center bg-[#0D0D0D] rounded-xl p-4 border border-gray-700">
                    <p className="text-2xl font-bold text-[#FFCC00] mb-1">
                      {currentSession.amount} RCN
                    </p>
                    <p className="text-sm text-gray-400">Processing withdrawal</p>
                  </div>
                )}
                
                <div className="mt-6">
                  <svg className="animate-spin h-8 w-8 text-[#FFCC00] mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
              <div className="bg-gradient-to-r from-[#FFCC00] to-[#FFA500] p-1">
                <div className="bg-[#1C1C1C] px-6 py-4 rounded-t-3xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Redemption Summary</h3>
                    <div className="w-12 h-12 rounded-full bg-[#FFCC00] bg-opacity-20 flex items-center justify-center">
                      <TrendingDown className="w-6 h-6 text-[#FFCC00]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance Display */}
              <div className="px-6 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Available Balance</span>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${hasSufficientBalance ? 'text-[#FFCC00]' : 'text-red-500'}`}>
                      {shopData?.purchasedRcnBalance || 0} RCN
                    </div>
                    {!hasSufficientBalance && redeemAmount > 0 && (
                      <p className="text-red-400 text-xs mt-1">
                        Need {redeemAmount - (shopData?.purchasedRcnBalance || 0)} more
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Redemption Details */}
              <div className="px-6 py-4 space-y-4">
                {selectedCustomer && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#FFCC00] rounded-full"></div>
                        <span className="text-gray-300">Customer</span>
                      </div>
                      <span className="text-white font-semibold text-sm">
                        {selectedCustomer.name || 'External'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-300">Tier</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getTierColor(selectedCustomer.tier)}`}>
                        {selectedCustomer.tier}
                      </span>
                    </div>
                  </div>
                )}

                {/* Amount Display */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-semibold text-lg">Redemption Amount</span>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[#FFCC00]">{redeemAmount || 0}</div>
                      <div className="text-xs text-gray-400">RCN</div>
                    </div>
                  </div>
                  <div className="bg-[#0D0D0D] rounded-xl p-3 text-center">
                    <span className="text-gray-400 text-sm">USD Value: </span>
                    <span className="text-white font-bold">${redeemAmount || 0}.00</span>
                  </div>
                </div>

                {/* Process Button */}
                <button
                  onClick={createRedemptionSession}
                  disabled={sessionStatus !== 'idle' || !selectedCustomer || !redeemAmount || !hasSufficientBalance}
                  className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFA500] text-black font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105"
                >
                  {sessionStatus === 'creating' ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Shield className="w-5 h-5" />
                      <span>Request Approval</span>
                    </div>
                  )}
                </button>

                {/* Exchange Rate */}
                <p className="text-center text-xs text-gray-500">
                  Exchange Rate: 1 RCN = $1.00
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
                <h3 className="text-lg font-semibold text-white">Recent Redemptions</h3>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[#FFCC00] hover:text-yellow-400 text-sm"
                >
                  {showHistory ? 'Hide' : 'Show'}
                </button>
              </div>

              {showHistory && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {loadingTransactions ? (
                    <div className="text-center py-4">
                      <svg className="animate-spin h-8 w-8 text-[#FFCC00] mx-auto" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : transactions.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No redemptions yet</p>
                  ) : (
                    transactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="bg-[#0D0D0D] rounded-lg p-3 border border-gray-700">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {tx.customerName || `${tx.customerAddress.slice(0, 6)}...`}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-500">-{tx.amount}</p>
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
            <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-green-400">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 bg-red-900 bg-opacity-20 border border-red-500 rounded-xl p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};