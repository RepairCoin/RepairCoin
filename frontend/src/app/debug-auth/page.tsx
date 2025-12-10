"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';

export default function DebugAuthPage() {
  const { account, isAuthenticated, userRole } = useAuthStore();
  const [cookies, setCookies] = useState('');
  const router = useRouter();

  useEffect(() => {
    setCookies(document.cookie);
  }, []);

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Auth Debug Information</h1>

        <div className="space-y-6">
          {/* Authentication Status */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Authentication Status</h2>
            <div className="space-y-2 text-gray-300">
              <div className="flex gap-2">
                <span className="font-semibold">Authenticated:</span>
                <span className={isAuthenticated ? 'text-green-400' : 'text-red-400'}>
                  {isAuthenticated ? '✅ YES' : '❌ NO'}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold">User Role:</span>
                <span className={userRole === 'shop' ? 'text-green-400' : 'text-yellow-400'}>
                  {userRole || 'None'}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold">Account Address:</span>
                <span className="text-blue-400">{account?.address || 'Not connected'}</span>
              </div>
            </div>
          </div>

          {/* Cookies */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Cookies</h2>
            <div className="bg-[#0D0D0D] p-4 rounded-lg overflow-x-auto">
              <pre className="text-gray-300 text-sm">
                {cookies || 'No cookies found'}
              </pre>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex gap-2 items-center">
                <span className="font-semibold text-gray-400">Has auth_token:</span>
                <span className={cookies.includes('auth_token') ? 'text-green-400' : 'text-red-400'}>
                  {cookies.includes('auth_token') ? '✅ YES' : '❌ NO'}
                </span>
              </div>
            </div>
          </div>

          {/* Required for Shop Access */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Requirements for Shop Pages</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {isAuthenticated ? (
                  <span className="text-green-400">✅</span>
                ) : (
                  <span className="text-red-400">❌</span>
                )}
                <span className="text-gray-300">Must be authenticated</span>
              </div>
              <div className="flex items-center gap-3">
                {userRole === 'shop' ? (
                  <span className="text-green-400">✅</span>
                ) : (
                  <span className="text-red-400">❌</span>
                )}
                <span className="text-gray-300">Must have role = 'shop'</span>
              </div>
              <div className="flex items-center gap-3">
                {cookies.includes('auth_token') ? (
                  <span className="text-green-400">✅</span>
                ) : (
                  <span className="text-red-400">❌</span>
                )}
                <span className="text-gray-300">Must have auth_token cookie</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Actions</h2>
            <div className="space-y-3">
              {!isAuthenticated && (
                <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
                  <p className="text-yellow-400 font-semibold mb-2">⚠️ Not Authenticated</p>
                  <p className="text-gray-300 text-sm mb-3">
                    You need to log in to access shop features.
                  </p>
                  <button
                    onClick={() => router.push('/auth/shop/register')}
                    className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700]"
                  >
                    Go to Shop Login
                  </button>
                </div>
              )}

              {isAuthenticated && userRole !== 'shop' && (
                <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
                  <p className="text-yellow-400 font-semibold mb-2">⚠️ Wrong Role</p>
                  <p className="text-gray-300 text-sm mb-3">
                    You're logged in as a <span className="text-[#FFCC00]">{userRole}</span>, but shop pages require a shop account.
                  </p>
                  <button
                    onClick={() => {
                      // Clear auth and redirect to shop login
                      document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                      router.push('/auth/shop/register');
                    }}
                    className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700]"
                  >
                    Switch to Shop Account
                  </button>
                </div>
              )}

              {isAuthenticated && userRole === 'shop' && (
                <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
                  <p className="text-green-400 font-semibold mb-2">✅ All Good!</p>
                  <p className="text-gray-300 text-sm mb-3">
                    You're authenticated as a shop owner. You should be able to access shop features.
                  </p>
                  <button
                    onClick={() => router.push('/shop')}
                    className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700]"
                  >
                    Go to Shop Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
