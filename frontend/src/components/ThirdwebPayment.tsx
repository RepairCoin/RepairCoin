// ThirdwebPayment.tsx - Crypto payment component for RCN purchases
'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { getContract, prepareContractCall, sendTransaction, readContract, eth_getBalance } from "thirdweb";
import { createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { getRpcClient } from "thirdweb/rpc";
// parseUnits not available in thirdweb v5, using manual calculation
const parseUnits = (value: string, decimals: number): bigint => {
  return BigInt(Math.floor(parseFloat(value) * Math.pow(10, decimals)));
};

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
});

// Base Sepolia testnet addresses
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
const SHOP_TREASURY = "0x761E5E59485ec6feb263320f5d636042bD9EBc8c"; // Your admin wallet for receiving payments

interface ThirdwebPaymentProps {
  purchaseId: string;
  amount: number;
  totalCost: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

export default function ThirdwebPayment({ 
  purchaseId, 
  amount, 
  totalCost, 
  onSuccess, 
  onError,
  onCancel
}: ThirdwebPaymentProps) {
  const account = useActiveAccount();
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'usdc' | 'eth'>('usdc');
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [networkValid, setNetworkValid] = useState(false);

  // Fetch balances when account changes
  useEffect(() => {
    const fetchBalances = async () => {
      if (!account) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setNetworkValid(false);
      console.log('Fetching balances for account:', account.address);
      console.log('Current chain ID:', account.chainId);
      
      try {
        // Try to fetch balance first - if it works, we're probably on the right network
        console.log('Account chain info:', {
          chainId: account.chainId,
          address: account.address
        });

        // Get USDC balance
        try {
          const usdcContract = getContract({
            client,
            chain: baseSepolia,
            address: USDC_ADDRESS
          });

          const usdcBalanceRaw = await readContract({
            contract: usdcContract,
            method: "function balanceOf(address) returns (uint256)",
            params: [account.address]
          });

          // Convert from 6 decimals for USDC
          const usdcBalanceNum = Number(usdcBalanceRaw) / 1e6;
          setUsdcBalance(usdcBalanceNum);
          console.log('USDC balance fetched:', usdcBalanceNum, 'USDC');
        } catch (usdcError) {
          console.error('Error fetching USDC balance:', usdcError);
          setUsdcBalance(0);
        }

        // Get ETH balance using Thirdweb v5 RPC method
        try {
          console.log('Fetching ETH balance using Thirdweb v5 RPC...');
          
          // Create RPC client for Base Sepolia
          const rpcRequest = getRpcClient({
            client,
            chain: baseSepolia,
          });
          
          // Get balance using eth_getBalance RPC call
          const balanceHex = await eth_getBalance(rpcRequest, {
            address: account.address,
            blockTag: "latest"
          });
          
          // Convert hex to number and then to ETH
          const balanceWei = BigInt(balanceHex);
          const ethBalanceNum = Number(balanceWei) / 1e18;
          
          console.log('ETH balance fetched:', ethBalanceNum, 'ETH');
          console.log('Balance in Wei:', balanceWei.toString());
          
          setEthBalance(ethBalanceNum);
          
          // If we successfully fetched ETH balance, the network is valid
          setNetworkValid(true);
          
        } catch (ethError) {
          console.error('Error fetching ETH balance:', ethError);
          setEthBalance(0);
          setNetworkValid(false);
        }

      } catch (error) {
        console.error('Error fetching balances:', error);
        setNetworkValid(false);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [account]);

  const payWithUSDC = async () => {
    if (!account) {
      onError('Please connect your wallet');
      return;
    }

    // Check if user has enough USDC
    if (usdcBalance < totalCost) {
      onError(`Insufficient USDC balance. You have ${usdcBalance.toFixed(2)} USDC but need ${totalCost.toFixed(2)} USDC`);
      return;
    }

    setPaying(true);
    try {
      // Get USDC contract
      const usdcContract = getContract({
        client,
        chain: baseSepolia,
        address: USDC_ADDRESS
      });

      // Prepare USDC transfer transaction
      const transaction = prepareContractCall({
        contract: usdcContract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [SHOP_TREASURY, parseUnits(totalCost.toString(), 6)] // USDC has 6 decimals
      });

      // Send transaction
      const receipt = await sendTransaction({ 
        transaction, 
        account 
      });

      console.log('USDC payment successful:', receipt.transactionHash);

      // Complete purchase on backend
      await completePurchase(receipt.transactionHash);
      
    } catch (error) {
      console.error('USDC payment failed:', error);
      onError(error instanceof Error ? error.message : 'USDC payment failed');
    } finally {
      setPaying(false);
    }
  };

  const payWithETH = async () => {
    if (!account) {
      onError('Please connect your wallet');
      return;
    }

    // Calculate ETH amount needed based on current price
    const ethAmount = totalCost / 2000; // Assuming $2000 ETH for testnet
    console.log('ETH payment calculation:', {
      totalCost,
      ethAmount,
      currentBalance: ethBalance
    });

    // Check if user has enough ETH (including gas)
    const gasBuffer = 0.001; // Reserve for gas
    if (ethBalance < (ethAmount + gasBuffer)) {
      onError(`Insufficient ETH balance. You have ${ethBalance.toFixed(6)} ETH but need ${(ethAmount + gasBuffer).toFixed(6)} ETH (including gas)`);
      return;
    }

    setPaying(true);
    try {
      console.log('Preparing simple ETH transfer:', {
        to: SHOP_TREASURY,
        value: parseUnits(ethAmount.toString(), 18).toString(),
        ethAmount: ethAmount
      });

      // Use sendTransaction with a simple transfer object instead of prepareContractCall
      const receipt = await sendTransaction({
        transaction: {
          to: SHOP_TREASURY,
          value: parseUnits(ethAmount.toString(), 18),
          chain: baseSepolia,
          client
        },
        account
      });

      console.log('ETH payment successful:', receipt.transactionHash);
      await completePurchase(receipt.transactionHash);
      
    } catch (error) {
      console.error('ETH payment failed:', error);
      onError(error instanceof Error ? error.message : 'ETH payment failed');
    } finally {
      setPaying(false);
    }
  };

  const completePurchase = async (transactionHash: string) => {
    try {
      console.log('Completing purchase:', { purchaseId, transactionHash });
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/purchase/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId,
          paymentReference: transactionHash
        })
      });

      const data = await response.json();
      console.log('Complete purchase response:', { status: response.status, data });

      if (!response.ok) {
        console.error('Purchase completion failed:', {
          status: response.status,
          error: data.error,
          purchaseId,
          transactionHash
        });
        throw new Error(data.error || 'Failed to complete purchase');
      }

      console.log('Purchase completed successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error completing purchase:', error);
      console.error('Purchase details:', { purchaseId, transactionHash });
      
      // Show more detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError(`Payment sent but failed to update balance: ${errorMessage}. Purchase ID: ${purchaseId}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 relative">
      {/* Close Button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
          disabled={paying}
        >
          ×
        </button>
      )}
      
      <h3 className="text-xl font-bold text-gray-900 mb-4">Complete Payment</h3>
      
      <div className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h4 className="font-medium text-blue-900">Purchase Summary</h4>
          <p className="text-blue-700">{amount} RCN tokens</p>
          <p className="text-blue-700 font-bold">${totalCost.toFixed(2)} USD</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Balance Display */}
        {!loading && account && (
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Your Balances</h4>
              <button
                onClick={() => {
                  setLoading(true);
                  // Trigger balance refresh by re-running the effect
                  const refreshBalances = async () => {
                    if (!account) return;
                    
                    console.log('Manual balance refresh for:', account.address);
                    try {
                      // Create RPC client for Base Sepolia
                      const rpcRequest = getRpcClient({
                        client,
                        chain: baseSepolia,
                      });
                      
                      // Get balance using eth_getBalance RPC call
                      const balanceHex = await eth_getBalance(rpcRequest, {
                        address: account.address,
                        blockTag: "latest"
                      });
                      
                      // Convert hex to number and then to ETH
                      const balanceWei = BigInt(balanceHex);
                      const ethBalanceNum = Number(balanceWei) / 1e18;
                      
                      setEthBalance(ethBalanceNum);
                      setNetworkValid(true);
                      console.log('Refreshed ETH balance:', ethBalanceNum, 'ETH');
                      
                    } catch (error) {
                      console.error('Balance refresh failed:', error);
                      setNetworkValid(false);
                    } finally {
                      setLoading(false);
                    }
                  };
                  refreshBalances();
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
                disabled={loading}
              >
                🔄 Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">USDC:</span>
                <span className={`ml-2 font-medium ${usdcBalance >= totalCost ? 'text-green-600' : 'text-red-600'}`}>
                  ${usdcBalance.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">ETH:</span>
                <span className={`ml-2 font-medium ${ethBalance >= (totalCost/2000 + 0.001) ? 'text-green-600' : 'text-red-600'}`}>
                  {ethBalance.toFixed(6)}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Chain ID: {account.chainId || 'Unknown'} {
                networkValid
                  ? '✅ Base Sepolia' 
                  : '❌ Wrong Network'
              }
            </div>
          </div>
        )}

        {/* Payment Method Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose Payment Method
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPaymentMethod('usdc')}
              disabled={loading}
              className={`p-4 rounded-xl border-2 transition-colors relative ${
                paymentMethod === 'usdc' 
                  ? 'border-blue-500 bg-blue-50 text-blue-900' 
                  : 'border-gray-200 hover:border-gray-300'
              } ${loading ? 'opacity-50' : ''}`}
            >
              <div className="font-medium">USDC</div>
              <div className="text-sm text-gray-500">Stablecoin</div>
              {!loading && usdcBalance < totalCost && (
                <div className="absolute top-1 right-1 text-xs text-red-500">Low balance</div>
              )}
            </button>
            
            <button
              onClick={() => setPaymentMethod('eth')}
              disabled={loading}
              className={`p-4 rounded-xl border-2 transition-colors relative ${
                paymentMethod === 'eth' 
                  ? 'border-blue-500 bg-blue-50 text-blue-900' 
                  : 'border-gray-200 hover:border-gray-300'
              } ${loading ? 'opacity-50' : ''}`}
            >
              <div className="font-medium">ETH</div>
              <div className="text-sm text-gray-500">Ethereum</div>
              {!loading && ethBalance < (totalCost/2000 + 0.001) && (
                <div className="absolute top-1 right-1 text-xs text-red-500">Low balance</div>
              )}
            </button>
          </div>
        </div>

        {/* Payment Button */}
        <button
          onClick={paymentMethod === 'usdc' ? payWithUSDC : payWithETH}
          disabled={paying || !account}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
        >
          {paying ? (
            <>
              <span className="inline-block animate-spin mr-2">⏳</span>
              Processing Payment...
            </>
          ) : (
            `Pay $${totalCost.toFixed(2)} with ${paymentMethod.toUpperCase()}`
          )}
        </button>

        <div className="text-xs text-gray-500 text-center">
          <p>🔒 Payments are processed on-chain via Thirdweb</p>
          <p>Your wallet will prompt you to approve the transaction</p>
        </div>

        {/* Insufficient Balance Help */}
        {!loading && account && (
          (paymentMethod === 'usdc' && usdcBalance < totalCost) || 
          (paymentMethod === 'eth' && ethBalance < (totalCost/2000 + 0.001))
        ) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Insufficient Balance</h4>
            <p className="text-xs text-yellow-700 mb-2">
              You need {paymentMethod === 'usdc' ? 'USDC' : 'ETH'} on Base Sepolia testnet.
            </p>
            <div className="space-y-1">
              <p className="text-xs text-yellow-700">
                <strong>Get testnet USDC:</strong>
                <br />
                1. Get Base Sepolia ETH from <a href="https://www.coinbase.com/faucets/base-ethereum-goerli-faucet" target="_blank" rel="noopener noreferrer" className="underline">Coinbase Faucet</a>
                <br />
                2. Use a USDC faucet or contact support for test tokens
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}