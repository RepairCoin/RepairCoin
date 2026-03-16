"use client";

import React, { useState, useEffect } from "react";
import { Shield, Wallet, Key, Clock, CheckCircle2, Info, AlertTriangle, Monitor, Smartphone, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";
import { getActiveSessions, revokeSession, revokeAllSessions, getSecurityStats, UserSession, SecurityStats } from "@/services/api/security";

export const PasswordAuthSettings: React.FC = () => {
  const { userProfile, logout } = useAuthStore();
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch sessions and stats on mount
  useEffect(() => {
    fetchSessionData();
  }, []);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const [sessionsData, statsData] = await Promise.all([
        getActiveSessions(),
        getSecurityStats()
      ]);
      setSessions(sessionsData);
      setStats(statsData);
    } catch (error: any) {
      console.error('Error fetching security data:', error);
      toast.error(error.message || 'Failed to load security information');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectWallet = () => {
    toast.success("Wallet disconnected successfully");
    logout();
    setShowConfirmDisconnect(false);
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setActionLoading(sessionId);
      await revokeSession(sessionId);
      toast.success("Session revoked successfully");
      await fetchSessionData(); // Refresh the list
    } catch (error: any) {
      console.error('Error revoking session:', error);
      toast.error(error.message || 'Failed to revoke session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      setActionLoading('all');
      const result = await revokeAllSessions();
      toast.success(`${result.revokedCount} session(s) revoked successfully`);
      await fetchSessionData(); // Refresh the list
    } catch (error: any) {
      console.error('Error revoking all sessions:', error);
      toast.error(error.message || 'Failed to revoke sessions');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="space-y-6">
      {/* Security Overview Card */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-900/20 rounded-lg">
            <Shield className="w-6 h-6 text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              Your Account is Protected
            </h3>
            <p className="text-sm text-gray-400">
              RepairCoin uses blockchain wallet authentication for maximum security.
              Your wallet serves as your login credentials, eliminating the need for
              traditional passwords.
            </p>
          </div>
        </div>
      </div>

      {/* Current Wallet Information */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#303236] overflow-hidden">
        <div className="p-6 border-b border-[#303236]">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#FFCC00]" />
            Connected Wallet
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            This is your primary authentication method
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Wallet Address */}
          <div className="flex items-center justify-between p-4 bg-[#101010] rounded-lg border border-[#303236]">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Wallet Address
              </label>
              <p className="font-mono text-sm text-white break-all">
                {userProfile?.address || "Not connected"}
              </p>
            </div>
            <button
              onClick={() =>
                copyToClipboard(
                  userProfile?.address || "",
                  "Wallet address"
                )
              }
              className="ml-4 px-3 py-2 bg-[#F6F8FA] text-[#24292F] rounded-lg border border-[#3F3F3F] hover:bg-[#E8EAED] transition-colors flex-shrink-0"
              title="Copy wallet address"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-3 p-4 bg-green-900/10 rounded-lg border border-green-700/30">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400">
                Active Connection
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Your wallet is securely connected to RepairCoin
              </p>
            </div>
          </div>

          {/* Disconnect Button */}
          {!showConfirmDisconnect ? (
            <button
              onClick={() => setShowConfirmDisconnect(true)}
              className="w-full px-4 py-3 bg-red-900/20 text-red-400 rounded-lg border border-red-700/30 hover:bg-red-900/30 transition-colors text-sm font-medium"
            >
              Disconnect Wallet
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-yellow-900/10 rounded-lg border border-yellow-700/30">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-400">
                    Are you sure?
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Disconnecting will log you out and you'll need to reconnect
                    your wallet to access your account.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDisconnect(false)}
                  className="flex-1 px-4 py-2 bg-[#303236] text-white rounded-lg hover:bg-[#3a3a3e] transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnectWallet}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Yes, Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Features */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#303236] overflow-hidden">
        <div className="p-6 border-b border-[#303236]">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-[#FFCC00]" />
            Security Features
          </h3>
        </div>

        <div className="divide-y divide-[#303236]">
          {/* Blockchain Authentication */}
          <div className="p-6 flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#FFCC00]/10 rounded-lg">
                <Shield className="w-5 h-5 text-[#FFCC00]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  Blockchain Authentication
                </h4>
                <p className="text-sm text-gray-400">
                  Cryptographically secure login using your wallet's private keys
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-900/20 text-green-400 rounded-full text-xs font-medium flex-shrink-0">
              Enabled
            </span>
          </div>

          {/* No Password Storage */}
          <div className="p-6 flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#FFCC00]/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-[#FFCC00]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  No Password Storage
                </h4>
                <p className="text-sm text-gray-400">
                  We don't store passwords, eliminating the risk of database breaches
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-900/20 text-green-400 rounded-full text-xs font-medium flex-shrink-0">
              Enabled
            </span>
          </div>

          {/* Session Management */}
          <div className="p-6 flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#FFCC00]/10 rounded-lg">
                <Clock className="w-5 h-5 text-[#FFCC00]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  Secure Session Management
                </h4>
                <p className="text-sm text-gray-400">
                  JWT-based sessions with automatic expiration for enhanced security
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-900/20 text-green-400 rounded-full text-xs font-medium flex-shrink-0">
              Enabled
            </span>
          </div>

          {/* Two-Factor Authentication */}
          <div className="p-6 flex items-start justify-between opacity-50">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-gray-700/20 rounded-lg">
                <Shield className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-1">
                  Two-Factor Authentication (2FA)
                </h4>
                <p className="text-sm text-gray-500">
                  Additional layer of security with authenticator apps
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-gray-700/20 text-gray-400 rounded-full text-xs font-medium flex-shrink-0">
              Coming Soon
            </span>
          </div>

          {/* Biometric Authentication */}
          <div className="p-6 flex items-start justify-between opacity-50">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-gray-700/20 rounded-lg">
                <Shield className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-1">
                  Biometric Authentication
                </h4>
                <p className="text-sm text-gray-500">
                  Login using fingerprint or face recognition on supported devices
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-gray-700/20 text-gray-400 rounded-full text-xs font-medium flex-shrink-0">
              Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* Security Best Practices */}
      <div className="bg-blue-900/10 rounded-xl p-6 border border-blue-700/30">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-400 mb-2">
              Security Best Practices
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>Never share your wallet's private key or seed phrase with anyone</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>Always verify you're on the official RepairCoin domain before connecting</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>Use a hardware wallet for maximum security of large balances</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>Keep your wallet software and browser extensions up to date</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>Log out of RepairCoin when using shared or public computers</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#303236] overflow-hidden">
        <div className="p-6 border-b border-[#303236]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Monitor className="w-5 h-5 text-[#FFCC00]" />
                Active Sessions
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Manage devices where you're currently logged in
              </p>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={handleRevokeAllSessions}
                disabled={actionLoading === 'all'}
                className="px-4 py-2 bg-red-900/20 text-red-400 rounded-lg border border-red-700/30 hover:bg-red-900/30 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {actionLoading === 'all' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Revoking...
                  </>
                ) : (
                  'Logout All Other Devices'
                )}
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No active sessions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 rounded-lg border transition-all ${
                    session.isCurrentSession
                      ? 'border-green-700/30 bg-green-900/10'
                      : 'border-[#303236] bg-[#101010]'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Device Icon */}
                    <div className={`p-2 rounded-lg ${
                      session.isCurrentSession ? 'bg-green-900/20' : 'bg-[#303236]'
                    }`}>
                      {session.isMobile ? (
                        <Smartphone className={`w-5 h-5 ${
                          session.isCurrentSession ? 'text-green-400' : 'text-gray-400'
                        }`} />
                      ) : (
                        <Monitor className={`w-5 h-5 ${
                          session.isCurrentSession ? 'text-green-400' : 'text-gray-400'
                        }`} />
                      )}
                    </div>

                    {/* Session Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-semibold ${
                          session.isCurrentSession ? 'text-green-400' : 'text-white'
                        }`}>
                          {session.browser} on {session.os}
                        </h4>
                        {session.isCurrentSession && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-900/30 text-green-400 rounded-full">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>{session.device}</p>
                        <p>
                          IP: {session.ipAddress} • {session.location}
                        </p>
                        <p>
                          Last active:{' '}
                          {new Date(session.lastUsedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Revoke Button */}
                    {!session.isCurrentSession && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={actionLoading === session.id}
                        className="px-3 py-2 bg-[#303236] text-gray-400 rounded-lg hover:bg-[#3a3a3e] hover:text-white transition-colors text-sm font-medium disabled:opacity-50 flex-shrink-0"
                      >
                        {actionLoading === session.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Revoke'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
