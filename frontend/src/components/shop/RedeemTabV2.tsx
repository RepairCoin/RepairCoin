'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Clock, CheckCircle, XCircle, Users } from 'lucide-react';

interface RedeemTabProps {
  shopId: string;
  onRedemptionComplete: () => void;
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

type RedemptionFlow = 'two-factor' | 'qr-scan';
type CustomerInputMode = 'select' | 'manual';

export const RedeemTabV2: React.FC<RedeemTabProps> = ({ shopId, onRedemptionComplete }) => {
  const [flow, setFlow] = useState<RedemptionFlow>('two-factor');
  
  // Two-factor flow states
  const [customerInputMode, setCustomerInputMode] = useState<CustomerInputMode>('select');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<ShopCustomer | null>(null);
  const [shopCustomers, setShopCustomers] = useState<ShopCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [redeemAmount, setRedeemAmount] = useState<number>(0);
  const [currentSession, setCurrentSession] = useState<RedemptionSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'creating' | 'waiting' | 'processing'>('idle');
  
  // QR scan flow states
  const [qrCode, setQrCode] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  
  // Common states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load shop customers and check for pending sessions on mount
  useEffect(() => {
    loadShopCustomers();
    checkForPendingSessions();
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
        console.log('Loaded shop customers:', result.data.customers);
        setShopCustomers(result.data.customers || []);
      } else {
        console.error('Failed to load customers:', response.status);
      }
    } catch (err) {
      console.error('Error loading shop customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Check for existing pending sessions for this shop
  const checkForPendingSessions = async () => {
    try {
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      if (!authToken) {
        return;
      }

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
        const pendingSessions = result.data?.sessions || [];
        
        // If there's a pending session, restore it
        if (pendingSessions.length > 0) {
          const latestSession = pendingSessions[0]; // Get the most recent
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
          
          console.log('Restored pending session:', latestSession);
        }
      }
    } catch (err) {
      console.error('Error checking for pending sessions:', err);
    }
  };

  // Handle customer selection
  const handleCustomerSelect = (customer: ShopCustomer) => {
    setSelectedCustomer(customer);
    setCustomerAddress(customer.address);
  };

  // Filter customers based on search
  const filteredCustomers = shopCustomers.filter(customer => {
    const searchLower = customerSearch.toLowerCase();
    const nameMatch = customer.name && customer.name.toLowerCase().includes(searchLower);
    const addressMatch = customer.address.toLowerCase().includes(searchLower);
    return nameMatch || addressMatch;
  });

  // Poll for session status updates
  useEffect(() => {
    if (currentSession && sessionStatus === 'waiting') {
      const interval = setInterval(async () => {
        try {
          // In a real app, this would be a WebSocket connection
          // For now, we'll simulate checking session status
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/status/${currentSession.sessionId}`);
          if (response.ok) {
            const result = await response.json();
            if (result.data.status === 'approved') {
              setSessionStatus('processing');
              await processRedemption();
            } else if (result.data.status === 'rejected') {
              setError('Customer rejected the redemption request');
              setSessionStatus('idle');
              setCurrentSession(null);
            } else if (new Date(result.data.expiresAt) < new Date()) {
              setError('Redemption request expired');
              setSessionStatus('idle');
              setCurrentSession(null);
            }
          }
        } catch (err) {
          console.error('Error checking session status:', err);
        }
      }, 2000); // Check every 2 seconds

      return () => clearInterval(interval);
    }
  }, [currentSession, sessionStatus]);

  const createRedemptionSession = async () => {
    const finalAddress = customerInputMode === 'select' && selectedCustomer 
      ? selectedCustomer.address 
      : customerAddress;
      
    if (!finalAddress || !redeemAmount) {
      setError('Please select or enter customer address and amount');
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
      setCurrentSession({
        sessionId: result.data.sessionId,
        customerAddress: finalAddress,
        amount: redeemAmount,
        status: 'pending',
        expiresAt: result.data.expiresAt
      });
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

      const result = await response.json();
      setSuccess(`Successfully redeemed ${currentSession.amount} RCN for customer`);
      
      // Reset form
      setCustomerAddress('');
      setSelectedCustomer(null);
      setRedeemAmount(0);
      setCurrentSession(null);
      setSessionStatus('idle');
      setCustomerSearch('');
      
      // Notify parent
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
      
      // Auto-process if QR is valid
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

  return (
    <div className="space-y-8">
      {/* Flow Selection */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Select Redemption Method</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setFlow('two-factor')}
            className={`p-4 rounded-xl border-2 transition-all ${
              flow === 'two-factor' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold">Two-Factor Approval</h3>
            <p className="text-sm text-gray-600 mt-1">
              Request approval from customer's app
            </p>
          </button>
          
          <button
            onClick={() => setFlow('qr-scan')}
            className={`p-4 rounded-xl border-2 transition-all ${
              flow === 'qr-scan' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <QrCode className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <h3 className="font-semibold">QR Code Scan</h3>
            <p className="text-sm text-gray-600 mt-1">
              Scan customer's QR code
            </p>
          </button>
        </div>
      </div>

      {/* Two-Factor Flow */}
      {flow === 'two-factor' && (
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Two-Factor Redemption</h2>
          
          {sessionStatus === 'idle' && (
            <div className="space-y-6">
              {/* Customer Input Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setCustomerInputMode('select')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    customerInputMode === 'select'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-2" />
                  Select Customer
                </button>
                <button
                  onClick={() => setCustomerInputMode('manual')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    customerInputMode === 'manual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Enter Address
                </button>
              </div>

              {/* Customer Selection */}
              {customerInputMode === 'select' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Home-Grown Customer
                  </label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      console.log('Search term:', e.target.value);
                      console.log('Shop customers:', shopCustomers);
                      console.log('Filtered count:', filteredCustomers.length);
                    }}
                    placeholder="Search by name or address..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {loadingCustomers ? (
                    <div className="text-center py-4 text-gray-500">Loading customers...</div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      {shopCustomers.length === 0 ? 'No customers found' : 'No matching customers'}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.address}
                          onClick={() => handleCustomerSelect(customer)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 ${
                            selectedCustomer?.address === customer.address ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">
                                {customer.name || 'Unnamed Customer'}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">
                                {customer.address.slice(0, 6)}...{customer.address.slice(-4)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                {customer.lifetime_earnings} RCN
                              </p>
                              <p className="text-xs text-gray-500">
                                {customer.tier} • {customer.total_transactions} txns
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedCustomer && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Selected: <span className="font-medium">{selectedCustomer.name || selectedCustomer.address}</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Wallet Address
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use this for cross-shop customers or if customer not in your list
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Redemption Amount (RCN)
                </label>
                <input
                  type="number"
                  min="1"
                  value={redeemAmount || ''}
                  onChange={(e) => setRedeemAmount(parseInt(e.target.value) || 0)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Value: ${redeemAmount} USD
                </p>
              </div>

              <button
                onClick={createRedemptionSession}
                disabled={(
                  customerInputMode === 'select' ? !selectedCustomer : !customerAddress
                ) || !redeemAmount}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
              >
                Request Customer Approval
              </button>
            </div>
          )}

          {sessionStatus === 'creating' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Creating redemption request...</p>
            </div>
          )}

          {sessionStatus === 'waiting' && currentSession && (
            <div className="text-center py-8">
              <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
              <h3 className="text-xl font-semibold mb-2">Waiting for Customer Approval</h3>
              <p className="text-gray-600 mb-4">
                Request sent to {currentSession.customerAddress.slice(0, 6)}...{currentSession.customerAddress.slice(-4)}
              </p>
              <p className="text-lg font-mono text-blue-600 mb-6">
                Amount: {currentSession.amount} RCN
              </p>
              <div className="bg-yellow-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  Time remaining: {getTimeRemaining(currentSession.expiresAt)}
                </p>
              </div>
              <button
                onClick={() => {
                  setSessionStatus('idle');
                  setCurrentSession(null);
                }}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Cancel Request
              </button>
            </div>
          )}

          {sessionStatus === 'processing' && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-green-600">Customer Approved!</p>
              <p className="text-gray-600 mt-2">Processing redemption...</p>
            </div>
          )}
        </div>
      )}

      {/* QR Scan Flow */}
      {flow === 'qr-scan' && (
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">QR Code Redemption</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QR Code Data
              </label>
              <textarea
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="Paste QR code data or use scanner..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent h-32"
              />
              <p className="text-sm text-gray-500 mt-2">
                Customer should show their QR code from the RepairCoin app
              </p>
            </div>

            <button
              onClick={validateQRCode}
              disabled={!qrCode}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              Validate & Process QR Code
            </button>

            {scanResult && (
              <div className="bg-green-50 rounded-xl p-4">
                <h4 className="font-semibold text-green-800 mb-2">QR Code Valid</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p>Customer: {scanResult.customerAddress?.slice(0, 6)}...{scanResult.customerAddress?.slice(-4)}</p>
                  <p>Amount: {scanResult.amount} RCN</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-4">🔐 Secure Redemption Process</h3>
        
        {flow === 'two-factor' ? (
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start gap-3">
              <span className="font-bold">1.</span>
              <div>
                <p className="font-semibold">Shop Initiates Request</p>
                <p>Enter customer's wallet address and redemption amount</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold">2.</span>
              <div>
                <p className="font-semibold">Customer Receives Notification</p>
                <p>Customer gets alert on their phone to approve or reject</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold">3.</span>
              <div>
                <p className="font-semibold">Customer Approves</p>
                <p>Customer reviews details and approves the redemption</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold">4.</span>
              <div>
                <p className="font-semibold">Automatic Processing</p>
                <p>System processes redemption and burns tokens</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start gap-3">
              <span className="font-bold">1.</span>
              <div>
                <p className="font-semibold">Customer Generates QR</p>
                <p>Customer creates QR code in their app with redemption details</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold">2.</span>
              <div>
                <p className="font-semibold">Shop Scans Code</p>
                <p>Scan or paste the QR code data</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold">3.</span>
              <div>
                <p className="font-semibold">Instant Validation</p>
                <p>System validates QR code and processes redemption</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start">
            <XCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-1 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-1 text-sm text-green-700">{success}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};