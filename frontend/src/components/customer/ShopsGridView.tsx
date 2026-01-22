// frontend/src/components/customer/ShopsGridView.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Store, MapPin, Star, Loader2, Search, Verified, ShoppingBag, TrendingUp } from "lucide-react";
import { getShops } from "@/services/api/shop";
import { Shop } from "@/constants/types";
import { toast } from "react-hot-toast";

interface ShopsGridViewProps {
  searchTerm?: string;
  selectedCategory?: string;
}

export const ShopsGridView: React.FC<ShopsGridViewProps> = ({ searchTerm = "", selectedCategory = "" }) => {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredShops, setFilteredShops] = useState<Shop[]>([]);

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    filterShops();
  }, [searchTerm, selectedCategory, shops]);

  const loadShops = async () => {
    try {
      setLoading(true);
      // Load all verified and active shops
      const data = await getShops();

      // Handle both array and object responses
      const shopsArray = Array.isArray(data) ? data : (data as any)?.shops || (data as any)?.data || [];

      // Filter to only show verified and active shops
      // Note: API returns 'verified' and 'active', not 'isVerified' and 'isActive'
      const activeShops = shopsArray.filter((shop: any) => shop.verified && shop.active);

      setShops(activeShops);
    } catch (error) {
      console.error("Error loading shops:", error);
      toast.error("Failed to load shops");
    } finally {
      setLoading(false);
    }
  };

  const filterShops = () => {
    let filtered = [...shops];

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((shop: any) =>
        shop.name?.toLowerCase().includes(searchLower) ||
        shop.address?.toLowerCase().includes(searchLower) ||
        shop.city?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by category (if category field exists)
    if (selectedCategory && selectedCategory !== "all") {
      filtered = filtered.filter((shop: any) => shop.category === selectedCategory);
    }

    setFilteredShops(filtered);
  };

  const handleShopClick = (shopId: string) => {
    router.push(`/customer/shop/${shopId}`);
  };

  // Get unique categories from shops (assuming category might be added later)
  const categories = Array.from(new Set(shops.map((s: any) => s.category).filter(Boolean)));

  // Generate avatar color based on shop name
  const getShopColor = (shopName: string) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-green-500 to-green-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
      "from-indigo-500 to-indigo-600",
      "from-red-500 to-red-600",
      "from-yellow-500 to-yellow-600",
      "from-teal-500 to-teal-600",
    ];
    const index = shopName.charCodeAt(0) % colors.length;
    return colors[index];
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
      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] rounded-full flex items-center justify-center">
              <Store className="w-6 h-6 text-black" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{filteredShops.length}</p>
              <p className="text-sm text-gray-400">Active Shops</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{categories.length}</p>
              <p className="text-sm text-gray-400">Categories</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
              <Verified className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {shops.filter((s: any) => s.verified).length}
              </p>
              <p className="text-sm text-gray-400">Verified Shops</p>
            </div>
          </div>
        </div>
      </div>

      {/* Shops Grid */}
      {filteredShops.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
          <Store className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold text-white mb-2">No shops found</h3>
          <p className="text-gray-400">
            {searchTerm || selectedCategory
              ? "Try adjusting your filters"
              : "Check back later for new shops"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredShops.map((shop: any) => (
            <div
              key={shop.shopId}
              onClick={() => handleShopClick(shop.shopId)}
              className="bg-[#1A1A1A] border border-gray-800 rounded-2xl overflow-hidden hover:border-[#FFCC00] transition-all duration-200 hover:shadow-lg hover:shadow-[#FFCC00]/10 cursor-pointer group"
            >
              {/* Shop Banner or Logo */}
              <div className="relative h-32 bg-gradient-to-br from-gray-800 to-gray-900">
                {shop.bannerUrl ? (
                  <img
                    src={shop.bannerUrl}
                    alt={shop.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${getShopColor(shop.name)} opacity-20`} />
                )}

                {/* Logo Overlay */}
                <div className="absolute -bottom-10 left-6">
                  {shop.logoUrl ? (
                    <div className="w-20 h-20 bg-white rounded-full border-4 border-[#1A1A1A] overflow-hidden shadow-lg">
                      <img
                        src={shop.logoUrl}
                        alt={shop.name}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                  ) : (
                    <div className={`w-20 h-20 bg-gradient-to-br ${getShopColor(shop.name)} rounded-full border-4 border-[#1A1A1A] flex items-center justify-center shadow-lg`}>
                      <span className="text-white text-2xl font-bold">
                        {shop.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Verified Badge */}
                {shop.verified && (
                  <div className="absolute top-3 right-3 bg-green-900 bg-opacity-90 text-green-400 text-xs font-semibold px-2 py-1 rounded-full border border-green-700 flex items-center gap-1">
                    <Verified className="w-3 h-3 fill-current" />
                    Verified
                  </div>
                )}
              </div>

              {/* Shop Content */}
              <div className="p-6 pt-14">
                {/* Shop Name */}
                <h3 className="text-lg font-bold text-white mb-1 truncate group-hover:text-[#FFCC00] transition-colors">
                  {shop.name}
                </h3>

                {/* Category Badge */}
                {shop.category && (
                  <span className="inline-block px-3 py-1 bg-[#2A2A2A] text-[#FFCC00] text-xs font-semibold rounded-full mb-3">
                    {shop.category}
                  </span>
                )}

                {/* Location */}
                {shop.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-400 mb-3">
                    <MapPin className="w-4 h-4 text-[#FFCC00] flex-shrink-0 mt-0.5" />
                    <p className="line-clamp-2">
                      {shop.address}{shop.city ? `, ${shop.city}` : ''}
                    </p>
                  </div>
                )}

                {/* Shop Stats */}
                <div className="flex items-center gap-4 pt-3 border-t border-gray-800 text-sm">
                  <div className="flex items-center gap-1 text-gray-400">
                    <ShoppingBag className="w-4 h-4" />
                    <span className="text-white font-semibold">
                      {shop.totalTokensIssued ? `${shop.totalTokensIssued.toFixed(0)} RCN` : "New"}
                    </span>
                  </div>
                  {shop.crossShopEnabled && (
                    <div className="flex items-center gap-1 text-blue-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-semibold">Cross-Shop</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShopsGridView;
