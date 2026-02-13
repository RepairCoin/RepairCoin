// frontend/src/components/shop/CustomerGridView.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Users, Search, TrendingUp, Package, DollarSign } from "lucide-react";
import { getShopCustomers } from "@/services/api/shop";
import { Customer } from "@/constants/types";
import { toast } from "react-hot-toast";

interface CustomerGridViewProps {
  shopId: string;
  onCustomersLoaded?: (count: number) => void;
}

export const CustomerGridView: React.FC<CustomerGridViewProps> = ({ shopId, onCustomersLoaded }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCustomers();
  }, [shopId]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getShopCustomers(shopId);

      setCustomers(data);
      onCustomersLoaded?.(data.length);
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  // Filter customers by search term
  const filteredCustomers = customers.filter((customer) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.address?.toLowerCase().includes(searchLower) ||
      customer.name?.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower)
    );
  });

  // Generate avatar background color based on address
  const getAvatarColor = (address: string) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-green-500 to-green-600",
      "from-yellow-500 to-yellow-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
      "from-indigo-500 to-indigo-600",
      "from-red-500 to-red-600",
      "from-teal-500 to-teal-600",
    ];
    const index = parseInt(address.slice(-2), 16) % colors.length;
    return colors[index];
  };

  // Get initials from name or address
  const getInitials = (customer: Customer) => {
    if (customer.name) {
      const names = customer.name.trim().split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return names[0].substring(0, 2).toUpperCase();
    }
    return customer.address.substring(2, 4).toUpperCase();
  };

  // Format display name
  const getDisplayName = (customer: Customer) => {
    if (customer.name) return customer.name;
    return `${customer.address.substring(0, 6)}...${customer.address.substring(38)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-black" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{customers.length}</p>
              <p className="text-sm text-gray-400">Total Customers</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {customers.reduce((sum, c) => sum + (c.total_transactions || 0), 0)}
              </p>
              <p className="text-sm text-gray-400">Total Transactions</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {customers.reduce((sum, c) => sum + (c.lifetime_earnings || c.lifetimeEarnings || 0), 0).toFixed(0)} RCN
              </p>
              <p className="text-sm text-gray-400">Total Lifetime Earnings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search customers by name, email, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-[#1A1A1A] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
        />
      </div>

      {/* Customers Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold text-white mb-2">
            {searchTerm ? "No customers found" : "No customers yet"}
          </h3>
          <p className="text-gray-400">
            {searchTerm
              ? "Try a different search term"
              : "Customers will appear here once they make purchases at your shop"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.address}
              className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 hover:border-[#FFCC00] transition-all duration-200 hover:shadow-lg hover:shadow-[#FFCC00]/10 group"
            >
              {/* Circular Avatar */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-24 h-24 rounded-full ${customer.profile_image_url ? '' : `bg-gradient-to-br ${getAvatarColor(customer.address)}`} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200 overflow-hidden`}
                >
                  {customer.profile_image_url ? (
                    <img
                      src={customer.profile_image_url}
                      alt={getDisplayName(customer)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white">
                      {getInitials(customer)}
                    </span>
                  )}
                </div>

                {/* Customer Name */}
                <h4 className="text-white font-semibold text-center mb-1 truncate w-full">
                  {getDisplayName(customer)}
                </h4>

                {/* Tier Badge */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                    customer.tier === "GOLD"
                      ? "bg-yellow-900 bg-opacity-30 text-yellow-400 border border-yellow-700"
                      : customer.tier === "SILVER"
                      ? "bg-gray-600 bg-opacity-30 text-gray-300 border border-gray-500"
                      : "bg-orange-900 bg-opacity-30 text-orange-400 border border-orange-700"
                  }`}
                >
                  {customer.tier}
                </div>

                {/* Customer Stats */}
                <div className="w-full space-y-2 text-sm">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Transactions
                    </span>
                    <span className="text-white font-semibold">
                      {customer.total_transactions || 0}
                    </span>
                  </div>
                  {customer.last_transaction_date && (
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-xs">Last Visit</span>
                      <span className="text-white text-xs font-semibold">
                        {new Date(customer.last_transaction_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Lifetime
                    </span>
                    <span className="text-green-500 font-semibold">
                      {(customer.lifetime_earnings || customer.lifetimeEarnings || 0).toFixed(0)} RCN
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerGridView;
