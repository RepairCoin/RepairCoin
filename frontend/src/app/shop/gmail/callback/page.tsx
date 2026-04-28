'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function GmailCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      toast.error(error || 'Gmail connection failed');
      setTimeout(() => router.push('/shop'), 2000);
      return;
    }

    if (success === 'true') {
      setStatus('success');
      toast.success('Gmail connected successfully!');
      setTimeout(() => router.push('/shop'), 2000);
      return;
    }

    setStatus('error');
    toast.error('Unknown callback state');
    setTimeout(() => router.push('/shop'), 2000);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        {status === 'processing' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Connecting Gmail...</h2>
            <p className="text-gray-400">Please wait while we connect your Gmail account</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-bold text-white mb-2">Success!</h2>
            <p className="text-gray-400">Your Gmail account is now connected</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
            <p className="text-gray-400">Redirecting you back to settings...</p>
          </div>
        )}
      </div>
    </div>
  );
}
