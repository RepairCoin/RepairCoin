'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/services/api/client';

function SubscriptionSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      if (!sessionId) {
        setError('No session information found');
        setLoading(false);
        return;
      }

      try {
        // Wait a bit for webhook to process
        await new Promise(resolve => setTimeout(resolve, 3000));

        // First, sync the subscription to ensure we have the latest data from Stripe
        console.log('Syncing subscription after payment...');
        try {
          const syncResult = await apiClient.post('/shops/subscription/sync');
          console.log('✅ Subscription sync completed:', syncResult);
        } catch (syncError) {
          console.error('Sync error (non-critical):', syncError);
        }

        // Now check subscription status
        const result = await apiClient.get('/shops/subscription/status');
        console.log('Subscription status result:', result);

        if (result.data?.hasActiveSubscription || result.data?.currentSubscription) {
          console.log('✅ Subscription verified after payment');

          // Get updated shop profile to cache operational status
          try {
            const profileData = await apiClient.get('/shops/profile');
            if (profileData.success && profileData.data) {
              // Store updated shop data for caching
              localStorage.setItem('shopData', JSON.stringify(profileData.data));
              console.log('✅ Shop operational status updated:', {
                operational_status: profileData.data.operational_status,
                subscription_active: profileData.data.subscription_active
              });

              // Set a flag to force reload on dashboard
              sessionStorage.setItem('subscriptionActivated', 'true');
            }
          } catch (profileError) {
            console.error('Error updating shop profile:', profileError);
          }
        } else {
          console.log('⏳ Subscription not yet active, webhook may still be processing');
          // Try again in a few seconds
          setTimeout(async () => {
            try {
              await apiClient.post('/shops/subscription/sync');
              console.log('✅ Retry sync completed');
              window.location.reload();
            } catch (error) {
              console.error('Retry sync failed:', error);
            }
          }, 5000);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error verifying session:', error);
        setError('Failed to verify subscription. Please check your dashboard.');
        setLoading(false);
      }
    };

    verifySession();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#000000] to-[#111111] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00] mx-auto mb-4" />
          <p className="text-gray-400">Confirming your subscription...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#000000] to-[#111111] flex items-center justify-center">
        <div className="bg-[#212121] rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button
            onClick={() => router.push('/shop?tab=subscription')}
            className="bg-[#FFCC00] hover:bg-[#FFD700] text-black"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#000000] to-[#111111] flex items-center justify-center">
      <div className="bg-[#212121] rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Subscription Activated!</h1>
          <p className="text-gray-400 mb-6">
            Your monthly subscription has been successfully set up. You can now start issuing RCN rewards to your customers.
          </p>
          
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">What's Next?</h2>
            <ul className="text-left space-y-2 text-sm text-gray-300">
              <li>✓ Purchase RCN tokens to reward customers</li>
              <li>✓ Issue rewards for repair services</li>
              <li>✓ Process customer redemptions</li>
              <li>✓ Track your shop's performance</li>
            </ul>
          </div>

          <Button
            onClick={() => {
              // Clear cached shop data to force reload
              localStorage.removeItem('shopData');
              // Set flag to force reload on dashboard
              sessionStorage.setItem('forceReloadShopData', 'true');
              router.push('/shop?tab=subscription&reload=true');
            }}
            className="w-full bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-[#000000] to-[#111111] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00] mx-auto mb-4" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <SubscriptionSuccessContent />
    </Suspense>
  );
}