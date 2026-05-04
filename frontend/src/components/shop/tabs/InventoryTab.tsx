"use client";

import React from 'react';
import { Package, Plus, Search } from 'lucide-react';

interface InventoryTabProps {
  shopId: string;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ shopId }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Inventory Management</h2>
          <p className="text-gray-400 mt-1">
            Manage your inventory items and track stock levels
          </p>
        </div>
        <button className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search inventory..."
            className="w-full pl-10 pr-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#FFCC00]"
          />
        </div>
        <select className="px-4 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]">
          <option value="all">All Categories</option>
          <option value="parts">Parts</option>
          <option value="tools">Tools</option>
          <option value="materials">Materials</option>
        </select>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Empty State */}
        <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-16 h-16 text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            No inventory items yet
          </h3>
          <p className="text-gray-400 mb-6">
            Start by adding your first inventory item
          </p>
          <button className="px-6 py-3 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Your First Item
          </button>
        </div>
      </div>
    </div>
  );
};
