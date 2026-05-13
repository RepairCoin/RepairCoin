"use client";

import { useState, useEffect } from "react";
import { inventoryApi } from "@/services/api/inventory";
import type {
  InventoryItemWithDetails,
  ServiceInventoryItem,
  LinkItemsToServiceData,
} from "@/types/inventory";
import { toast } from "react-hot-toast";
import { X, Package, Plus, Trash2, CheckCircle, AlertCircle, Search } from "lucide-react";

interface ServiceInventoryPickerModalProps {
  shopId: string;
  serviceId: string;
  serviceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedItem {
  inventoryItemId: string;
  itemName: string;
  itemSku?: string;
  quantityRequired: number;
  isOptional: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  status: string;
}

export function ServiceInventoryPickerModal({
  shopId,
  serviceId,
  serviceName,
  onClose,
  onSuccess,
}: ServiceInventoryPickerModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableItems, setAvailableItems] = useState<InventoryItemWithDetails[]>([]);
  const [currentLinks, setCurrentLinks] = useState<ServiceInventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, [serviceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsResponse, linksResponse] = await Promise.all([
        inventoryApi.getItems({}, 1, 1000),
        inventoryApi.getServiceInventoryItems(serviceId),
      ]);

      setAvailableItems(itemsResponse.items);
      setCurrentLinks(linksResponse.items);

      // Initialize selected items with current links
      const selected: SelectedItem[] = linksResponse.items.map((link) => ({
        inventoryItemId: link.inventoryItemId,
        itemName: link.itemName,
        itemSku: link.sku,
        quantityRequired: link.quantityRequired,
        isOptional: link.isOptional,
        stockQuantity: link.stockQuantity,
        lowStockThreshold: link.lowStockThreshold,
        status: link.status,
      }));
      setSelectedItems(selected);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load inventory items");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (item: InventoryItemWithDetails) => {
    if (selectedItems.some((si) => si.inventoryItemId === item.id)) {
      toast.error("This item is already added");
      return;
    }

    setSelectedItems([
      ...selectedItems,
      {
        inventoryItemId: item.id,
        itemName: item.name,
        itemSku: item.sku,
        quantityRequired: 1,
        isOptional: false,
        stockQuantity: item.stockQuantity,
        lowStockThreshold: item.lowStockThreshold,
        status: item.status,
      },
    ]);
  };

  const handleRemoveItem = (inventoryItemId: string) => {
    setSelectedItems(selectedItems.filter((item) => item.inventoryItemId !== inventoryItemId));
  };

  const updateItem = (inventoryItemId: string, field: keyof SelectedItem, value: any) => {
    setSelectedItems(
      selectedItems.map((item) =>
        item.inventoryItemId === inventoryItemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSave = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (selectedItems.some((item) => item.quantityRequired <= 0)) {
      toast.error("Quantity required must be greater than 0");
      return;
    }

    try {
      setSaving(true);
      const data: LinkItemsToServiceData = {
        shopId,
        items: selectedItems.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          quantityRequired: item.quantityRequired,
          isOptional: item.isOptional,
        })),
      };

      await inventoryApi.linkItemsToService(serviceId, data);
      toast.success("Inventory items linked successfully");
      onSuccess();
    } catch (error) {
      console.error("Error linking items:", error);
      toast.error("Failed to link inventory items");
    } finally {
      setSaving(false);
    }
  };

  const filteredAvailableItems = availableItems.filter(
    (item) =>
      !selectedItems.some((si) => si.inventoryItemId === item.id) &&
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Link Inventory Items</h2>
            <p className="text-sm text-gray-600 mt-1">Service: {serviceName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How It Works</p>
              <p>
                Link inventory items to this service. When a customer completes an order for this service,
                the required quantities will be automatically deducted from your inventory.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Items */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Items</h3>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                />
              </div>

              <div className="border border-gray-200 rounded-lg max-h-[400px] overflow-y-auto">
                {filteredAvailableItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No items available</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredAvailableItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                        onClick={() => handleAddItem(item)}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-600">Stock: {item.stockQuantity}</span>
                            {item.status === "low_stock" && (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                                Low Stock
                              </span>
                            )}
                            {item.status === "out_of_stock" && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddItem(item);
                          }}
                          className="p-2 text-[#FFCC00] hover:bg-[#FFCC00] hover:bg-opacity-10 rounded-lg transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Items */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Selected Items ({selectedItems.length})
              </h3>

              <div className="border border-gray-200 rounded-lg max-h-[460px] overflow-y-auto">
                {selectedItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No items selected</p>
                    <p className="text-xs mt-1">Click items on the left to add them</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {selectedItems.map((item) => (
                      <div key={item.inventoryItemId} className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            {item.itemSku && <p className="text-xs text-gray-500">SKU: {item.itemSku}</p>}
                            {(item.status === "low_stock" || item.status === "out_of_stock") && (
                              <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                                <AlertCircle className="w-3 h-3" />
                                {item.status === "out_of_stock" ? "Out of Stock" : "Low Stock"}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.inventoryItemId)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Quantity Required
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantityRequired}
                              onChange={(e) =>
                                updateItem(
                                  item.inventoryItemId,
                                  "quantityRequired",
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                            />
                          </div>

                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.isOptional}
                                onChange={(e) =>
                                  updateItem(item.inventoryItemId, "isOptional", e.target.checked)
                                }
                                className="w-4 h-4 text-[#FFCC00] rounded focus:ring-[#FFCC00]"
                              />
                              <span className="text-xs text-gray-700">Optional</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedItems.length === 0}
              className="flex-1 px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {saving ? "Saving..." : `Link ${selectedItems.length} ${selectedItems.length === 1 ? "Item" : "Items"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
