'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { SimpleUnsuspendModal } from '../../components/SimpleUnsuspendModal';
import CommunityBanner from '@/components/CommunityBanner';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const contract = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
});

interface CustomerData {
  address: string;
  name?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  currentBalance: number;
  totalRedemptions: number;
  dailyEarnings: number;
  monthlyEarnings: number;
  isActive: boolean;
  suspensionReason?: string;
  lastEarnedDate?: string;
  joinDate: string;
}

interface EarnedBalanceData {
  earnedBalance: number;
  marketBalance: number;
  totalBalance: number;
}

interface TransactionHistory {
  id: string;
  type: 'earned' | 'redeemed' | 'bonus' | 'referral';
  amount: number;
  shopId?: string;
  shopName?: string;
  description: string;
  createdAt: string;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { account, userProfile, isLoading, isAuthenticated } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [earnedBalanceData, setEarnedBalanceData] = useState<EarnedBalanceData | null>(null);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnsuspendModal, setShowUnsuspendModal] = useState(false);

  // Read token balance from contract
  const { data: tokenBalance, isLoading: balanceLoading } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: account?.address ? [account.address] : undefined,
  });

  const fetchCustomerData = async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch customer data
      const customerResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}`);
      if (customerResponse.ok) {
        const customerResult = await customerResponse.json();
        console.log('Customer data from API:', customerResult.data);
        // Extract the customer object from the response
        const customerData = customerResult.data.customer || customerResult.data;
        setCustomerData(customerData);
      } else if (customerResponse.status === 404) {
        // Customer not found - they need to register
        router.push('/customer/register');
        return;
      }

      // Fetch earned balance data
      const balanceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/earned-balance/${account.address}`);
      if (balanceResponse.ok) {
        const balanceResult = await balanceResponse.json();
        setEarnedBalanceData(balanceResult.data);
      }

      // Fetch recent transactions
      const transactionsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}/transactions?limit=10`);
      if (transactionsResponse.ok) {
        const transactionsResult = await transactionsResponse.json();
        setTransactions(transactionsResult.data?.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching customer data:', err);
      setError('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return '0';
    return (Number(balance) / 1e18).toFixed(2);
  };

  const getTierColor = (tier: string): string => {
    switch (tier.toUpperCase()) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierEmoji = (tier: string): string => {
    switch (tier.toUpperCase()) {
      case 'BRONZE': return '🥉';
      case 'SILVER': return '🥈';
      case 'GOLD': return '🥇';
      default: return '🏆';
    }
  };

  const getNextTier = (currentTier: string): { tier: string; requirement: number } => {
    switch (currentTier.toUpperCase()) {
      case 'BRONZE':
        return { tier: 'SILVER', requirement: 200 };
      case 'SILVER':
        return { tier: 'GOLD', requirement: 1000 };
      case 'GOLD':
        return { tier: 'GOLD', requirement: 0 };
      default:
        return { tier: 'SILVER', requirement: 200 };
    }
  };

  // Fetch customer data
  useEffect(() => {
    if (account?.address) {
      fetchCustomerData();
    }
  }, [account?.address]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // if (!customerData && !loading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
  //       <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
  //         <div className="text-6xl mb-6">⚠️</div>
  //         <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading Customer Data</h1>
  //         <p className="text-gray-600">Please wait while we load your information...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // Check if customer is suspended
  if (customerData && !customerData.isActive) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-6">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Suspended</h1>
            <p className="text-gray-600 mb-6">
              Your account has been suspended. You cannot perform any token transactions while suspended.
            </p>
            {customerData.suspensionReason && (
              <div className="bg-red-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800 font-medium">Reason:</p>
                <p className="text-sm text-red-700">{customerData.suspensionReason}</p>
              </div>
            )}
            <button
              onClick={() => setShowUnsuspendModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Request Unsuspend
            </button>
          </div>
        </div>

        {/* Unsuspend Request Modal */}
        <SimpleUnsuspendModal
          isOpen={showUnsuspendModal}
          onClose={() => setShowUnsuspendModal(false)}
          customerAddress={account?.address || ''}
          onSuccess={() => {
            setShowUnsuspendModal(false);
            // Optionally refresh customer data
            fetchCustomerData();
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen py-8 bg-[#0D0D0D]" style={{ backgroundImage: `url('/cus-dash-chain.png')` }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className='flex items-center gap-4'>
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-400">
                <img
                  src="/avatar1.png"
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/default-avatar.png';
                  }}
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Welcome back, {customerData?.name?.split(' ')[0] || 'Customer'}</h1>
                <p className="text-gray-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  {customerData?.email || account?.address || 'user@example.com'}
                </p>
              </div>
            </div>
            <div className="mt-4 sm:mt-0">
              <ConnectButton
                client={client}
                connectModal={{ size: "compact" }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* RCN Balance Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg flex justify-between items-center">
            <div>
              <p className="text-yellow-400 text-sm font-medium mb-1">RCN Balance</p>
              <p className="text-white text-2xl font-bold">{earnedBalanceData?.totalBalance || customerData?.currentBalance || 0} RCN</p>
              {earnedBalanceData && earnedBalanceData.marketBalance > 0 && (
                <p className="text-gray-400 text-xs mt-1">
                  {earnedBalanceData.earnedBalance} earned, {earnedBalanceData.marketBalance} bought
                </p>
              )}
            </div>
            <div className="w-20 rounded-lg">
              <svg viewBox="0 0 57 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g filter="url(#filter0_d_2775_3789)">
                  <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
                </g>
                <path d="M21.4464 17.8185H35.5089C35.6732 17.8185 35.8373 17.8289 36.0002 17.8497C35.945 17.462 35.8118 17.0895 35.6088 16.7547C35.4057 16.4199 35.1369 16.1296 34.8186 15.9015C34.5003 15.6733 34.1391 15.512 33.7568 15.4272C33.3745 15.3424 32.9789 15.3359 32.594 15.4081L21.029 17.3826H21.0158C20.2898 17.5214 19.6443 17.9321 19.2109 18.5309C19.8638 18.0665 20.6453 17.8175 21.4464 17.8185Z" fill="#000510" />
                <path d="M35.5098 18.875H21.4473C20.7016 18.8758 19.9867 19.1724 19.4594 19.6997C18.9322 20.2269 18.6356 20.9418 18.6348 21.6875V30.125C18.6356 30.8707 18.9322 31.5856 19.4594 32.1128C19.9867 32.6401 20.7016 32.9367 21.4473 32.9375H35.5098C36.2554 32.9367 36.9703 32.6401 37.4976 32.1128C38.0249 31.5856 38.3214 30.8707 38.3223 30.125V21.6875C38.3214 20.9418 38.0249 20.2269 37.4976 19.6997C36.9703 19.1724 36.2554 18.8758 35.5098 18.875ZM33.4224 27.3125C33.1442 27.3125 32.8723 27.23 32.6411 27.0755C32.4098 26.921 32.2296 26.7014 32.1232 26.4444C32.0167 26.1874 31.9889 25.9047 32.0431 25.6319C32.0974 25.3591 32.2313 25.1085 32.428 24.9119C32.6247 24.7152 32.8752 24.5813 33.148 24.527C33.4208 24.4728 33.7035 24.5006 33.9605 24.607C34.2175 24.7135 34.4371 24.8937 34.5916 25.125C34.7461 25.3562 34.8286 25.6281 34.8286 25.9062C34.8286 26.2792 34.6804 26.6369 34.4167 26.9006C34.153 27.1643 33.7953 27.3125 33.4224 27.3125Z" fill="#000510" />
                <path d="M18.6562 24.6514V20.2788C18.6562 19.3265 19.1836 17.73 21.0139 17.3841C22.5674 17.0928 24.1055 17.0928 24.1055 17.0928C24.1055 17.0928 25.1162 17.7959 24.2812 17.7959C23.4463 17.7959 23.4683 18.8726 24.2812 18.8726C25.0942 18.8726 24.2812 19.9053 24.2812 19.9053L21.0073 23.6187L18.6562 24.6514Z" fill="#000510" />
                <defs>
                  <filter id="filter0_d_2775_3789" x="0.5" y="-2.38419e-07" width="56" height="56" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                    <feFlood flood-opacity="0" result="BackgroundImageFix" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="3.5" />
                    <feGaussianBlur stdDeviation="2.75" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.02 0" />
                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2775_3789" />
                    <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2775_3789" result="shape" />
                  </filter>
                </defs>
              </svg>
            </div>
          </div>

          {/* Customer Tier Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg flex justify-between items-center">
            <div>
              <p className="text-yellow-400 text-sm font-medium mb-1">Your Tier Level</p>
              <p className="text-white text-2xl font-bold">{customerData?.tier || 'SILVER'}</p>
              {customerData && customerData.tier !== 'GOLD' && (
                <p className="text-gray-400 text-xs mt-1">
                  {getNextTier(customerData.tier).requirement - customerData.lifetimeEarnings} RCN to {getNextTier(customerData.tier).tier}
                </p>
              )}
            </div>
            <div className="w-20 rounded-lg">
              <svg viewBox="0 0 57 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g filter="url(#filter0_d_2775_3811)">
                  <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
                </g>
                <path d="M35.5268 16.1562V14H22.5938V16.1562H19V17.8633C19 19.3008 19.4268 20.6839 20.2021 21.754C20.8009 22.5805 21.7371 23.151 22.5789 23.4255C22.8233 24.7413 23.4863 25.9919 24.8336 27.0116C25.8218 27.76 27.01 28.3085 28.0742 28.5327V32.1484H24.75V34.125H33.375V32.1484H30.0508V28.5327C31.115 28.3081 32.3027 27.76 33.2914 27.0116C34.6391 25.9919 35.3017 24.7413 35.5461 23.4255C36.3879 23.151 37.3241 22.5805 37.9229 21.754C38.6982 20.6839 39.125 19.3008 39.125 17.8633V16.1562H35.5268ZM21.8031 20.5945C21.3234 19.9351 21.0318 19.0492 20.9838 18.1328H22.5938V21.1592C22.4168 21.108 22.0134 20.8843 21.8031 20.5945ZM36.3219 20.5945C36.1152 20.8915 35.8008 21.1596 35.5312 21.1596C35.5312 20.1534 35.5313 19.0802 35.529 18.1328H37.1417C37.0932 19.0492 36.7891 19.9252 36.3219 20.5945Z" fill="black" />
                <defs>
                  <filter id="filter0_d_2775_3811" x="0.5" y="-2.38419e-07" width="56" height="56" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                    <feFlood flood-opacity="0" result="BackgroundImageFix" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="3.5" />
                    <feGaussianBlur stdDeviation="2.75" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.02 0" />
                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2775_3811" />
                    <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2775_3811" result="shape" />
                  </filter>
                </defs>
              </svg>
            </div>
          </div>

          {/* Total Repairs Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg flex justify-between items-center">
            <div>
              <p className="text-yellow-400 text-sm font-medium mb-1">Total Repairs</p>
              <p className="text-white text-2xl font-bold">{customerData?.lifetimeEarnings || 0}</p>
            </div>
            <div className="w-20 rounded-lg">
              <svg viewBox="0 0 57 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g filter="url(#filter0_d_2775_3834)">
                  <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
                </g>
                <path d="M42.8125 23.5971C42.8036 23.4314 42.7362 23.2742 42.6225 23.1534C42.5087 23.0326 42.3558 22.9559 42.191 22.937L40.4883 22.6615C40.4117 22.6489 40.3412 22.6119 40.2874 22.556C40.2335 22.5001 40.1992 22.4283 40.1895 22.3513C40.1569 22.1422 40.1231 21.925 40.0766 21.7192C40.0616 21.6443 40.0704 21.5666 40.1017 21.4969C40.133 21.4273 40.1853 21.3692 40.2512 21.3307L41.764 20.4906C41.9142 20.4141 42.031 20.285 42.0922 20.1279C42.1534 19.9708 42.1548 19.7967 42.096 19.6386L41.8337 18.9148C41.7762 18.7563 41.6622 18.6245 41.5135 18.5447C41.3649 18.465 41.1921 18.4428 41.0282 18.4825L39.3315 18.8145C39.2556 18.8282 39.1774 18.8175 39.108 18.784C39.0385 18.7505 38.9815 18.6959 38.945 18.6279C38.8461 18.4427 38.7385 18.2541 38.6263 18.0688C38.5855 18.0028 38.5664 17.9257 38.5716 17.8483C38.5769 17.7709 38.6062 17.6971 38.6555 17.6372L39.7844 16.3336C39.899 16.2103 39.9648 16.0495 39.9696 15.8813C39.9743 15.713 39.9177 15.5488 39.8103 15.4192L39.3176 14.8275C39.2104 14.6976 39.0588 14.6122 38.8922 14.5876C38.7256 14.5631 38.5558 14.6013 38.4158 14.6947L36.9302 15.5865C36.8644 15.626 36.7876 15.6432 36.7112 15.6357C36.6348 15.6282 36.5628 15.5963 36.5059 15.5447C36.3419 15.4006 36.1772 15.2618 36.0165 15.1336C35.9561 15.086 35.9125 15.0203 35.8919 14.9461C35.8714 14.872 35.875 14.7932 35.9023 14.7213L36.5172 13.101C36.5842 12.9463 36.592 12.7725 36.5392 12.6125C36.4865 12.4525 36.3768 12.3175 36.231 12.233L35.5616 11.8445C35.4156 11.7604 35.2437 11.733 35.0788 11.7677C34.9139 11.8024 34.7675 11.8966 34.6678 12.0325L33.582 13.3938C33.5432 13.4533 33.4847 13.4973 33.4168 13.5181C33.3488 13.539 33.2757 13.5354 33.2102 13.508C33.169 13.4914 32.827 13.3513 32.5607 13.2623C32.4877 13.2385 32.4242 13.192 32.3795 13.1295C32.3348 13.067 32.3113 12.9918 32.3124 12.915L32.3383 11.1838C32.3475 11.0148 32.2948 10.8481 32.1901 10.7151C32.0853 10.5822 31.9357 10.4919 31.7692 10.4613L31.0088 10.3285C30.8431 10.2999 30.6727 10.3324 30.5292 10.4199C30.3857 10.5075 30.2788 10.6442 30.2285 10.8046L29.6641 12.4522C29.6388 12.5255 29.5905 12.5888 29.5264 12.6325C29.4622 12.6761 29.3857 12.6979 29.3081 12.6945H28.6607C28.5839 12.6958 28.5086 12.673 28.4455 12.6293C28.3824 12.5856 28.3345 12.5232 28.3087 12.4508L27.7469 10.8126C27.6975 10.651 27.5909 10.513 27.447 10.4244C27.3031 10.3357 27.1319 10.3026 26.9653 10.3311L26.2043 10.464C26.0387 10.4942 25.8898 10.5835 25.7851 10.7153C25.6804 10.8471 25.6272 11.0124 25.6352 11.1805L25.6618 12.9177C25.6623 12.9956 25.6376 13.0717 25.5914 13.1345C25.5453 13.1973 25.48 13.2436 25.4054 13.2663C25.254 13.3254 24.9233 13.4509 24.7739 13.5074C24.6411 13.5552 24.4957 13.5027 24.3755 13.3679L23.2957 12.0398C23.1968 11.904 23.0513 11.8094 22.8871 11.774C22.7228 11.7386 22.5513 11.7649 22.4052 11.8479L21.7372 12.235C21.5898 12.3196 21.4789 12.4558 21.4259 12.6173C21.373 12.7787 21.3816 12.9541 21.4503 13.1096L22.0645 14.7259C22.0913 14.798 22.0949 14.8767 22.0746 14.9509C22.0544 15.0251 22.0114 15.0911 21.9517 15.1396C21.7903 15.2724 21.6249 15.4052 21.4602 15.5527C21.4037 15.6038 21.3323 15.6356 21.2564 15.6432C21.1805 15.6508 21.1042 15.634 21.0386 15.5952L19.5703 14.6861C19.4294 14.5942 19.2597 14.557 19.0933 14.5815C18.9269 14.6059 18.7751 14.6904 18.6665 14.8189L18.1751 15.4099C18.0661 15.5385 18.0083 15.7029 18.0128 15.8715C18.0174 16.0401 18.0839 16.201 18.1997 16.3236L19.3346 17.6252C19.3849 17.6839 19.415 17.7573 19.4204 17.8344C19.4258 17.9116 19.4062 17.9884 19.3645 18.0535C19.2509 18.2342 19.1427 18.4241 19.0444 18.614C19.0076 18.6823 18.9502 18.7372 18.8803 18.7709C18.8103 18.8045 18.7316 18.8152 18.6552 18.8013L16.9612 18.4739C16.7972 18.4343 16.6244 18.4565 16.4757 18.5362C16.327 18.616 16.2128 18.7477 16.1551 18.9062L15.8894 19.6287C15.8306 19.7869 15.8319 19.9612 15.8931 20.1185C15.9543 20.2758 16.0711 20.4052 16.2215 20.482L17.7342 21.322C17.8022 21.3596 17.8562 21.4183 17.8879 21.4892C17.9197 21.5601 17.9275 21.6394 17.9102 21.7152L17.8949 21.7975C17.8597 21.9835 17.8285 22.1594 17.7973 22.3467C17.7867 22.4227 17.7524 22.4935 17.6992 22.5488C17.646 22.6042 17.5767 22.6413 17.5011 22.6548L15.7945 22.9304C15.6277 22.951 15.4742 23.0316 15.3626 23.1571C15.2509 23.2826 15.1887 23.4444 15.1875 23.6124V24.3814C15.1865 24.5501 15.2482 24.7132 15.3606 24.8391C15.473 24.9649 15.628 25.0446 15.7958 25.0627L17.5011 25.3376C17.5777 25.3501 17.6483 25.387 17.7021 25.443C17.756 25.4989 17.7903 25.5707 17.7999 25.6477C17.8325 25.8576 17.8663 26.0741 17.9128 26.2799C17.9278 26.3548 17.919 26.4325 17.8877 26.5021C17.8564 26.5718 17.8041 26.6299 17.7382 26.6684L16.2261 27.5098C16.0759 27.5863 15.9591 27.7155 15.8978 27.8725C15.8366 28.0296 15.8353 28.2038 15.8941 28.3618L16.1597 29.0856C16.2174 29.2441 16.3314 29.3757 16.4799 29.4555C16.6285 29.5352 16.8013 29.5575 16.9652 29.5179L18.6619 29.1892C18.7378 29.1755 18.816 29.1862 18.8854 29.2197C18.9549 29.2533 19.0119 29.3079 19.0484 29.3758C19.148 29.5617 19.2556 29.7503 19.3671 29.9349C19.4081 30.0009 19.4273 30.078 19.422 30.1555C19.4168 30.2329 19.3874 30.3068 19.3379 30.3666L18.209 31.6708C18.0932 31.7929 18.0259 31.9532 18.0197 32.1214C18.0136 32.2896 18.0691 32.4543 18.1758 32.5845L18.6679 33.1762C18.7751 33.3061 18.9266 33.3916 19.0932 33.4161C19.2598 33.4406 19.4296 33.4025 19.5697 33.309L21.0552 32.4172C21.121 32.3777 21.1978 32.3605 21.2742 32.368C21.3507 32.3756 21.4226 32.4075 21.4795 32.459C21.6442 32.6031 21.8115 32.7419 21.9689 32.8701C22.0293 32.9178 22.073 32.9834 22.0935 33.0576C22.114 33.1318 22.1104 33.2105 22.0831 33.2825L21.4682 34.9028C21.4012 35.0574 21.3934 35.2312 21.4462 35.3912C21.4989 35.5512 21.6086 35.6863 21.7544 35.7707L22.4258 36.1585C22.5716 36.2427 22.7434 36.2702 22.9082 36.2356C23.073 36.2011 23.2192 36.1069 23.319 35.9713L24.418 34.6199C24.5103 34.505 24.657 34.4539 24.7659 34.4977C24.9964 34.5933 25.1511 34.6471 25.4254 34.7388C25.4984 34.7626 25.562 34.8092 25.6067 34.8716C25.6515 34.9341 25.6752 35.0092 25.6744 35.0861L25.6478 36.816C25.6389 36.9849 25.6917 37.1514 25.7964 37.2843C25.9011 37.4173 26.0505 37.5076 26.2169 37.5385L26.9773 37.6713C27.143 37.7 27.3134 37.6676 27.457 37.58C27.6005 37.4924 27.7074 37.3556 27.7575 37.1951L28.322 35.5502C28.3478 35.4772 28.3963 35.4144 28.4603 35.3708C28.5243 35.3272 28.6005 35.3051 28.6779 35.3079H29.3254C29.4022 35.3065 29.4775 35.3293 29.5407 35.373C29.6038 35.4167 29.6516 35.4792 29.6774 35.5516L30.2398 37.1898C30.2834 37.332 30.3714 37.4566 30.4909 37.5451C30.6104 37.6337 30.7551 37.6816 30.9039 37.6819C30.9435 37.682 30.9831 37.6784 31.0221 37.6713L31.7838 37.5385C31.9492 37.5081 32.098 37.4187 32.2026 37.287C32.3071 37.1552 32.3603 36.9899 32.3522 36.8219L32.3256 35.0847C32.3251 35.0082 32.349 34.9335 32.3937 34.8714C32.4385 34.8093 32.5019 34.7631 32.5747 34.7394C32.8297 34.6538 33.0083 34.5847 33.1663 34.5243L33.2062 34.5083C33.4094 34.4379 33.507 34.5176 33.5694 34.5953L34.6817 35.9653C34.7814 36.1008 34.9276 36.1948 35.0922 36.2294C35.2569 36.2639 35.4285 36.2366 35.5742 36.1526L36.2429 35.7654C36.3892 35.6809 36.4992 35.5455 36.552 35.3851C36.6048 35.2246 36.5967 35.0503 36.5292 34.8955L35.9156 33.2792C35.8885 33.2071 35.8848 33.1284 35.9049 33.0542C35.925 32.9799 35.968 32.9139 36.0278 32.8654C36.1892 32.7326 36.3545 32.5998 36.5192 32.4524C36.5761 32.4011 36.648 32.3694 36.7242 32.362C36.8005 32.3546 36.8771 32.3718 36.9429 32.4112L38.4297 33.3011C38.5706 33.3929 38.7403 33.4301 38.9067 33.4057C39.0732 33.3812 39.2249 33.2968 39.3335 33.1683L39.8249 32.5772C39.9339 32.4487 39.9917 32.2845 39.9871 32.116C39.9826 31.9475 39.9161 31.7866 39.8003 31.6642L38.6674 30.3579C38.6171 30.2992 38.587 30.2259 38.5816 30.1487C38.5762 30.0716 38.5959 29.9948 38.6376 29.9296C38.7511 29.7497 38.8593 29.5597 38.9576 29.3692C38.9946 29.301 39.0521 29.2463 39.122 29.2127C39.1918 29.1791 39.2705 29.1683 39.3468 29.1819L41.0388 29.5119C41.2028 29.5515 41.3757 29.5293 41.5244 29.4496C41.6731 29.3698 41.7872 29.2381 41.845 29.0796L42.1073 28.3571C42.1661 28.199 42.1648 28.0248 42.1036 27.8676C42.0423 27.7104 41.9255 27.5812 41.7752 27.5045L40.2612 26.6631C40.1941 26.6252 40.141 26.5667 40.1098 26.4962C40.0786 26.4258 40.0709 26.3471 40.0879 26.272L40.1031 26.189C40.1383 26.003 40.1695 25.8277 40.2008 25.6404C40.2113 25.5644 40.2456 25.4937 40.2988 25.4383C40.352 25.383 40.4214 25.3459 40.4969 25.3323L42.2036 25.0574C42.3707 25.0371 42.5247 24.9565 42.6368 24.8309C42.7488 24.7053 42.8113 24.5431 42.8125 24.3747V23.5971ZM23.3947 30.9908C22.3468 30.1476 21.502 29.0797 20.9225 27.866C20.3431 26.6523 20.0439 25.3239 20.0471 23.979C20.0503 22.634 20.3558 21.307 20.941 20.0961C21.5261 18.8851 22.3761 17.8212 23.4279 16.9831L27.4122 23.9962L23.3947 30.9908ZM29 32.9724C27.8987 32.9734 26.8068 32.7696 25.78 32.3714L29.7969 25.3808H37.8467C37.1819 29.6746 33.4685 32.9724 29 32.9724ZM29.8009 22.6196L25.8198 15.6138C26.8352 15.2258 27.9131 15.0272 29 15.0281C33.4685 15.0281 37.1819 18.3258 37.8467 22.6196H29.8009Z" fill="black" />
                <defs>
                  <filter id="filter0_d_2775_3834" x="0.5" y="-2.38419e-07" width="56" height="56" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                    <feFlood flood-opacity="0" result="BackgroundImageFix" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="3.5" />
                    <feGaussianBlur stdDeviation="2.75" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.02 0" />
                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2775_3834" />
                    <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2775_3834" result="shape" />
                  </filter>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        {/* Earnings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Token Summary Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-yellow-400 text-lg font-bold">Token Summary</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Tokens Earned:</span>
                <span className="font-bold text-green-500">
                  {customerData?.lifetimeEarnings || 0} RCN
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Tokens Redeemed:</span>
                <span className="font-bold text-red-500">
                  -{customerData?.totalRedemptions || 0} RCN
                </span>
              </div>
              <div className="h-px bg-gray-700 my-3"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">Current Balance:</span>
                <span className="font-bold text-yellow-400">
                  {earnedBalanceData?.totalBalance || customerData?.currentBalance || 0} RCN
                </span>
              </div>
            </div>
          </div>

          {/* Tier Benefits Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-yellow-400 text-lg font-bold">Tier Benefits</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.3917 5.43751C23.3807 5.26299 23.3114 5.09722 23.195 4.96673C23.0786 4.83624 22.9218 4.74858 22.7496 4.71778C18.526 3.95997 16.7628 3.41212 12.8214 1.63184C12.7203 1.58614 12.6106 1.5625 12.4996 1.5625C12.3887 1.5625 12.279 1.58614 12.1779 1.63184C8.23646 3.41212 6.47327 3.95997 2.24964 4.71778C2.0775 4.74858 1.92068 4.83624 1.80427 4.96673C1.68786 5.09722 1.61859 5.26299 1.60755 5.43751C1.41956 8.42139 1.82044 11.2017 2.80042 13.7012C3.60292 15.74 4.79056 17.6052 6.29847 19.1948C8.90931 21.9649 11.6813 23.168 12.2101 23.3809C12.398 23.4569 12.6081 23.4569 12.796 23.3809C13.3248 23.168 16.0968 21.9649 18.7076 19.1948C20.2131 17.6046 21.3984 15.7394 22.1989 13.7012C23.1788 11.2017 23.5797 8.42139 23.3917 5.43751ZM16.9952 9.10499L11.5851 15.355C11.5155 15.4356 11.4302 15.5011 11.3344 15.5475C11.2386 15.594 11.1343 15.6203 11.028 15.625H10.9957C10.7913 15.6251 10.5949 15.5449 10.4489 15.4019L8.04651 13.0483C7.97322 12.9765 7.91479 12.891 7.87456 12.7966C7.83434 12.7022 7.81309 12.6008 7.81205 12.4982C7.80994 12.291 7.89024 12.0914 8.03528 11.9434C8.18032 11.7953 8.37822 11.711 8.58545 11.7089C8.79267 11.7068 8.99225 11.7871 9.14026 11.9321L10.9469 13.7041L15.8151 8.08253C15.8822 8.00494 15.964 7.94134 16.0557 7.89535C16.1474 7.84936 16.2473 7.82188 16.3496 7.81449C16.4519 7.8071 16.5547 7.81994 16.6521 7.85227C16.7495 7.8846 16.8395 7.9358 16.9171 8.00294C16.9947 8.07007 17.0583 8.15183 17.1043 8.24355C17.1503 8.33527 17.1778 8.43514 17.1852 8.53748C17.1925 8.63981 17.1797 8.7426 17.1474 8.83998C17.115 8.93735 17.0638 9.0274 16.9967 9.10499H16.9952Z" fill="#FFCC00" />
                </svg>

                <span className="text-gray-300">All {customerData?.tier || 'Bronze'} Benefits</span>
              </div>
              <div className="flex items-center gap-3">
                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.3917 5.43751C23.3807 5.26299 23.3114 5.09722 23.195 4.96673C23.0786 4.83624 22.9218 4.74858 22.7496 4.71778C18.526 3.95997 16.7628 3.41212 12.8214 1.63184C12.7203 1.58614 12.6106 1.5625 12.4996 1.5625C12.3887 1.5625 12.279 1.58614 12.1779 1.63184C8.23646 3.41212 6.47327 3.95997 2.24964 4.71778C2.0775 4.74858 1.92068 4.83624 1.80427 4.96673C1.68786 5.09722 1.61859 5.26299 1.60755 5.43751C1.41956 8.42139 1.82044 11.2017 2.80042 13.7012C3.60292 15.74 4.79056 17.6052 6.29847 19.1948C8.90931 21.9649 11.6813 23.168 12.2101 23.3809C12.398 23.4569 12.6081 23.4569 12.796 23.3809C13.3248 23.168 16.0968 21.9649 18.7076 19.1948C20.2131 17.6046 21.3984 15.7394 22.1989 13.7012C23.1788 11.2017 23.5797 8.42139 23.3917 5.43751ZM16.9952 9.10499L11.5851 15.355C11.5155 15.4356 11.4302 15.5011 11.3344 15.5475C11.2386 15.594 11.1343 15.6203 11.028 15.625H10.9957C10.7913 15.6251 10.5949 15.5449 10.4489 15.4019L8.04651 13.0483C7.97322 12.9765 7.91479 12.891 7.87456 12.7966C7.83434 12.7022 7.81309 12.6008 7.81205 12.4982C7.80994 12.291 7.89024 12.0914 8.03528 11.9434C8.18032 11.7953 8.37822 11.711 8.58545 11.7089C8.79267 11.7068 8.99225 11.7871 9.14026 11.9321L10.9469 13.7041L15.8151 8.08253C15.8822 8.00494 15.964 7.94134 16.0557 7.89535C16.1474 7.84936 16.2473 7.82188 16.3496 7.81449C16.4519 7.8071 16.5547 7.81994 16.6521 7.85227C16.7495 7.8846 16.8395 7.9358 16.9171 8.00294C16.9947 8.07007 17.0583 8.15183 17.1043 8.24355C17.1503 8.33527 17.1778 8.43514 17.1852 8.53748C17.1925 8.63981 17.1797 8.7426 17.1474 8.83998C17.115 8.93735 17.0638 9.0274 16.9967 9.10499H16.9952Z" fill="#FFCC00" />
                </svg>

                <span className="text-gray-300">Cross Shop Redemption</span>
              </div>
              <div className="flex items-center gap-3">
                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.3917 5.43751C23.3807 5.26299 23.3114 5.09722 23.195 4.96673C23.0786 4.83624 22.9218 4.74858 22.7496 4.71778C18.526 3.95997 16.7628 3.41212 12.8214 1.63184C12.7203 1.58614 12.6106 1.5625 12.4996 1.5625C12.3887 1.5625 12.279 1.58614 12.1779 1.63184C8.23646 3.41212 6.47327 3.95997 2.24964 4.71778C2.0775 4.74858 1.92068 4.83624 1.80427 4.96673C1.68786 5.09722 1.61859 5.26299 1.60755 5.43751C1.41956 8.42139 1.82044 11.2017 2.80042 13.7012C3.60292 15.74 4.79056 17.6052 6.29847 19.1948C8.90931 21.9649 11.6813 23.168 12.2101 23.3809C12.398 23.4569 12.6081 23.4569 12.796 23.3809C13.3248 23.168 16.0968 21.9649 18.7076 19.1948C20.2131 17.6046 21.3984 15.7394 22.1989 13.7012C23.1788 11.2017 23.5797 8.42139 23.3917 5.43751ZM16.9952 9.10499L11.5851 15.355C11.5155 15.4356 11.4302 15.5011 11.3344 15.5475C11.2386 15.594 11.1343 15.6203 11.028 15.625H10.9957C10.7913 15.6251 10.5949 15.5449 10.4489 15.4019L8.04651 13.0483C7.97322 12.9765 7.91479 12.891 7.87456 12.7966C7.83434 12.7022 7.81309 12.6008 7.81205 12.4982C7.80994 12.291 7.89024 12.0914 8.03528 11.9434C8.18032 11.7953 8.37822 11.711 8.58545 11.7089C8.79267 11.7068 8.99225 11.7871 9.14026 11.9321L10.9469 13.7041L15.8151 8.08253C15.8822 8.00494 15.964 7.94134 16.0557 7.89535C16.1474 7.84936 16.2473 7.82188 16.3496 7.81449C16.4519 7.8071 16.5547 7.81994 16.6521 7.85227C16.7495 7.8846 16.8395 7.9358 16.9171 8.00294C16.9947 8.07007 17.0583 8.15183 17.1043 8.24355C17.1503 8.33527 17.1778 8.43514 17.1852 8.53748C17.1925 8.63981 17.1797 8.7426 17.1474 8.83998C17.115 8.93735 17.0638 9.0274 16.9967 9.10499H16.9952Z" fill="#FFCC00" />
                </svg>

                <span className="text-gray-300">Referral Bonus Available</span>
              </div>
              <div className="flex items-center gap-3">
                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.3917 5.43751C23.3807 5.26299 23.3114 5.09722 23.195 4.96673C23.0786 4.83624 22.9218 4.74858 22.7496 4.71778C18.526 3.95997 16.7628 3.41212 12.8214 1.63184C12.7203 1.58614 12.6106 1.5625 12.4996 1.5625C12.3887 1.5625 12.279 1.58614 12.1779 1.63184C8.23646 3.41212 6.47327 3.95997 2.24964 4.71778C2.0775 4.74858 1.92068 4.83624 1.80427 4.96673C1.68786 5.09722 1.61859 5.26299 1.60755 5.43751C1.41956 8.42139 1.82044 11.2017 2.80042 13.7012C3.60292 15.74 4.79056 17.6052 6.29847 19.1948C8.90931 21.9649 11.6813 23.168 12.2101 23.3809C12.398 23.4569 12.6081 23.4569 12.796 23.3809C13.3248 23.168 16.0968 21.9649 18.7076 19.1948C20.2131 17.6046 21.3984 15.7394 22.1989 13.7012C23.1788 11.2017 23.5797 8.42139 23.3917 5.43751ZM16.9952 9.10499L11.5851 15.355C11.5155 15.4356 11.4302 15.5011 11.3344 15.5475C11.2386 15.594 11.1343 15.6203 11.028 15.625H10.9957C10.7913 15.6251 10.5949 15.5449 10.4489 15.4019L8.04651 13.0483C7.97322 12.9765 7.91479 12.891 7.87456 12.7966C7.83434 12.7022 7.81309 12.6008 7.81205 12.4982C7.80994 12.291 7.89024 12.0914 8.03528 11.9434C8.18032 11.7953 8.37822 11.711 8.58545 11.7089C8.79267 11.7068 8.99225 11.7871 9.14026 11.9321L10.9469 13.7041L15.8151 8.08253C15.8822 8.00494 15.964 7.94134 16.0557 7.89535C16.1474 7.84936 16.2473 7.82188 16.3496 7.81449C16.4519 7.8071 16.5547 7.81994 16.6521 7.85227C16.7495 7.8846 16.8395 7.9358 16.9171 8.00294C16.9947 8.07007 17.0583 8.15183 17.1043 8.24355C17.1503 8.33527 17.1778 8.43514 17.1852 8.53748C17.1925 8.63981 17.1797 8.7426 17.1474 8.83998C17.115 8.93735 17.0638 9.0274 16.9967 9.10499H16.9952Z" fill="#FFCC00" />
                </svg>

                <span className="text-gray-300">Early Access to Promos</span>
              </div>
              <div className="flex items-center gap-3">
                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.3917 5.43751C23.3807 5.26299 23.3114 5.09722 23.195 4.96673C23.0786 4.83624 22.9218 4.74858 22.7496 4.71778C18.526 3.95997 16.7628 3.41212 12.8214 1.63184C12.7203 1.58614 12.6106 1.5625 12.4996 1.5625C12.3887 1.5625 12.279 1.58614 12.1779 1.63184C8.23646 3.41212 6.47327 3.95997 2.24964 4.71778C2.0775 4.74858 1.92068 4.83624 1.80427 4.96673C1.68786 5.09722 1.61859 5.26299 1.60755 5.43751C1.41956 8.42139 1.82044 11.2017 2.80042 13.7012C3.60292 15.74 4.79056 17.6052 6.29847 19.1948C8.90931 21.9649 11.6813 23.168 12.2101 23.3809C12.398 23.4569 12.6081 23.4569 12.796 23.3809C13.3248 23.168 16.0968 21.9649 18.7076 19.1948C20.2131 17.6046 21.3984 15.7394 22.1989 13.7012C23.1788 11.2017 23.5797 8.42139 23.3917 5.43751ZM16.9952 9.10499L11.5851 15.355C11.5155 15.4356 11.4302 15.5011 11.3344 15.5475C11.2386 15.594 11.1343 15.6203 11.028 15.625H10.9957C10.7913 15.6251 10.5949 15.5449 10.4489 15.4019L8.04651 13.0483C7.97322 12.9765 7.91479 12.891 7.87456 12.7966C7.83434 12.7022 7.81309 12.6008 7.81205 12.4982C7.80994 12.291 7.89024 12.0914 8.03528 11.9434C8.18032 11.7953 8.37822 11.711 8.58545 11.7089C8.79267 11.7068 8.99225 11.7871 9.14026 11.9321L10.9469 13.7041L15.8151 8.08253C15.8822 8.00494 15.964 7.94134 16.0557 7.89535C16.1474 7.84936 16.2473 7.82188 16.3496 7.81449C16.4519 7.8071 16.5547 7.81994 16.6521 7.85227C16.7495 7.8846 16.8395 7.9358 16.9171 8.00294C16.9947 8.07007 17.0583 8.15183 17.1043 8.24355C17.1503 8.33527 17.1778 8.43514 17.1852 8.53748C17.1925 8.63981 17.1797 8.7426 17.1474 8.83998C17.115 8.93735 17.0638 9.0274 16.9967 9.10499H16.9952Z" fill="#FFCC00" />
                </svg>

                <span className="text-gray-300">Priority Support Access</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Transactions</h2>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    {transaction.shopName && (
                      <p className="text-sm text-gray-500">at {transaction.shopName}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`font-bold ${transaction.type === 'redeemed' ? 'text-red-600' : 'text-green-600'
                    }`}>
                    {transaction.type === 'redeemed' ? '-' : '+'}{transaction.amount} RCN
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner */}
        <div
          className="w-full mx-auto bg-black/70 rounded-2xl overflow-hidden my-40"
          style={{ backgroundImage: `url('/banner-chain.png')` }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-8 pt-12">
            {/* Left Column - Content */}
            <div className="flex flex-col justify-between pb-12">
              {/* Logo and Tagline */}
              <div className="flex flex-col space-x-3 mb-8">
                <div>
                  <img
                    src="/community-logo.png"
                    alt="RepairCoin Logo"
                    className="h-10 w-auto"
                  />
                </div>
                <span className="text-[#FFCC00] text-sm font-medium">
                  The Repair Industry's Loyalty Coin
                </span>
              </div>

              {/* Main Heading */}
              <p className="text-xl md:text-3xl font-bold text-white leading-tight">
                Join the Growing Community!{" "}
                <span className="text-[#FFCC00]">Earning</span> while
                repairing.
              </p>

              {/* CTA Button */}
              <button className="bg-[#FFCC00] hover:bg-yellow-400 text-gray-900 font-semibold px-8 py-3 rounded-full transition-all duration-300 transform hover:scale-105 w-max">
                Sign Up Now <span className="ml-2 text-sm md:text-lg">→</span>
              </button>
            </div>

            {/* Right Column - Placeholder for Image/Illustration */}
            <div className="flex items-center justify-center">
              <div className="relative w-full h-64 md:h-80 rounded-xl flex items-center justify-center">
                <img src="/people.png" alt="Community Banner" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}