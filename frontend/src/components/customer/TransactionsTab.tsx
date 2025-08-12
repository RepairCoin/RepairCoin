'use client';

import React from 'react';

interface TransactionHistory {
  id: string;
  type: "earned" | "redeemed" | "bonus" | "referral" | "tier_bonus";
  amount: number;
  shopId?: string;
  shopName?: string;
  description: string;
  createdAt: string;
}

interface TransactionsTabProps {
  transactions: TransactionHistory[];
  loading: boolean;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  loading,
}) => {
  return (
    <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
      <div
        className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl"
        style={{
          backgroundImage: `url('/img/cust-ref-widget3.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <p className="text-lg md:text-xl text-gray-900 font-semibold">
          Transaction History
        </p>
      </div>
      <div className="bg-[#212121]">
        {/* Transaction History Table - Responsive */}
        {loading ? (
          <div className="animate-pulse p-4 sm:p-6 space-y-3 sm:space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 sm:h-12 bg-gray-200 rounded"
              ></div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📋</div>
            <p className="text-gray-500 text-sm sm:text-base">No transactions yet</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-2 px-4">
              Start earning RCN by visiting participating repair shops!
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="block sm:hidden p-4 space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {transaction.description}
                      </p>
                      {transaction.shopName && (
                        <p className="text-xs text-gray-500 mt-1">
                          {transaction.shopName}
                        </p>
                      )}
                    </div>
                    <span className={`text-sm font-bold ${
                      transaction.type === 'redeemed' 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`}>
                      {transaction.type === 'redeemed' ? '-' : '+'}
                      {transaction.amount} RCN
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      transaction.type === 'redeemed' 
                        ? 'bg-red-100 text-red-800' 
                        : transaction.type === 'tier_bonus'
                        ? 'bg-purple-100 text-purple-800'
                        : transaction.type === 'referral'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {transaction.type === 'earned' ? 'Repair' : 
                       transaction.type === 'tier_bonus' ? 'Bonus' :
                       transaction.type === 'referral' ? 'Referral' :
                       transaction.type === 'redeemed' ? 'Redeemed' : 
                       transaction.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tablet/Desktop View - Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Shop
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                      <div>
                        <div className="font-medium">{new Date(transaction.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400 hidden lg:block">
                          {new Date(transaction.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                      <div className="font-medium line-clamp-2">
                        {transaction.description}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                      {transaction.shopName || 
                        <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.type === 'redeemed' 
                          ? 'bg-red-100 text-red-800' 
                          : transaction.type === 'tier_bonus'
                          ? 'bg-purple-100 text-purple-800'
                          : transaction.type === 'referral'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {transaction.type === 'earned' ? 'Repair' : 
                         transaction.type === 'tier_bonus' ? 'Bonus' :
                         transaction.type === 'referral' ? 'Referral' :
                         transaction.type === 'redeemed' ? 'Redeemed' : 
                         transaction.type}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                      <span className={`text-xs sm:text-sm font-bold ${
                        transaction.type === 'redeemed' 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {transaction.type === 'redeemed' ? '-' : '+'}
                        {transaction.amount} RCN
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
};