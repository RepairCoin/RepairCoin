import { useState, useEffect } from 'react';

interface Transaction {
  id: number;
  shopId: string;
  shopName?: string;
  customerAddress: string;
  customerName?: string;
  type: 'mint' | 'redemption' | 'purchase';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  txHash?: string;
  details?: any;
}

interface TransactionsTabProps {
  generateAdminToken: () => Promise<string | null>;
  onError: (error: string) => void;
}

export function TransactionsTab({ generateAdminToken, onError }: TransactionsTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Authentication required');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      };

      // Fetch transactions - this endpoint may need to be created
      // For now, we'll load from treasury and other sources
      const transactionsData: Transaction[] = [];
      
      // Get treasury data for shop RCN purchases
      try {
        const treasuryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury`, { headers });
        if (treasuryResponse.ok) {
          const treasuryData = await treasuryResponse.json();
          if (treasuryData.data?.recentPurchases) {
            treasuryData.data.recentPurchases.forEach((purchase: any) => {
              transactionsData.push({
                id: purchase.id,
                shopId: purchase.shop_id,
                shopName: purchase.shop_name,
                customerAddress: '', // Not applicable for purchases
                type: 'purchase',
                amount: purchase.rcn_amount,
                status: 'completed',
                createdAt: purchase.purchase_date,
                details: {
                  paymentMethod: purchase.payment_method,
                  paymentReference: purchase.payment_reference,
                  usdAmount: purchase.total_cost
                }
              });
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load treasury data:', err);
      }

      // Sort by date descending
      transactionsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error loading transactions:', error);
      onError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Shop/Customer', 'Amount', 'Status', 'TX Hash'];
    const rows = filteredTransactions.map(tx => [
      new Date(tx.createdAt).toLocaleString(),
      tx.type,
      tx.shopName || tx.customerName || tx.shopId || tx.customerAddress,
      tx.amount,
      tx.status,
      tx.txHash || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Transactions Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Transactions</p>
              <p className="text-3xl font-bold text-gray-900">{transactions.length}</p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Volume</p>
              <p className="text-3xl font-bold text-green-600">
                {transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2)} RCN
              </p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Success Rate</p>
              <p className="text-3xl font-bold text-blue-600">
                {transactions.length > 0 
                  ? `${((transactions.filter(tx => tx.status === 'completed').length / transactions.length) * 100).toFixed(1)}%`
                  : '100%'}
              </p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Recent Transactions</h2>
            <p className="text-gray-600 mt-1">View all platform transactions</p>
          </div>
          <div className="flex gap-2">
            <select 
              className="px-3 py-2 border rounded-lg text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="purchase">RCN Purchases</option>
              <option value="mint">Token Mints</option>
              <option value="redemption">Redemptions</option>
            </select>
            <button 
              onClick={exportToCSV}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop/Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No transactions found. Transactions will appear here once shops start purchasing RCN.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        const date = new Date(transaction.createdAt);
                        if (isNaN(date.getTime())) {
                          return 'N/A';
                        }
                        return (
                          <>
                            {date.toLocaleDateString()}
                            <div className="text-xs text-gray-500">
                              {date.toLocaleTimeString()}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.type === 'purchase' ? 'bg-blue-100 text-blue-800' :
                        transaction.type === 'mint' ? 'bg-green-100 text-green-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.shopName || transaction.customerName || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.shopId || transaction.customerAddress?.slice(0, 6) + '...' + transaction.customerAddress?.slice(-4)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transaction.amount} RCN
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                        transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {transaction.txHash ? (
                        <a 
                          href={`https://sepolia.basescan.org/tx/${transaction.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View on Explorer
                        </a>
                      ) : (
                        <button className="text-gray-400 cursor-not-allowed">
                          No TX Hash
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <p className="text-sm text-gray-700">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}