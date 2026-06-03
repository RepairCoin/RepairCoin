"use client";

import { useState, useEffect } from "react";
import { inventoryApi } from "@/services/api/inventory";
import type {
  InventoryVendor,
  InventoryItemWithDetails,
  CreatePurchaseOrderData,
} from "@/types/inventory";
import { toast } from "react-hot-toast";
import { X, Plus, Trash2, Package, DollarSign, Calendar } from "lucide-react";

interface CreatePurchaseOrderModalProps {
  shopId: string;
  vendors: InventoryVendor[];
  onClose: () => void;
  onSuccess: () => void;
}

interface POItem {
  inventoryItemId: string;
  itemName: string;
  itemSku?: string;
  quantity: number;
  unitCost: number;
}

export function CreatePurchaseOrderModal({
  shopId,
  vendors,
  onClose,
  onSuccess,
}: CreatePurchaseOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InventoryItemWithDetails[]>([]);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [formData, setFormData] = useState({
    vendorId: "",
    vendorName: "",
    expectedDeliveryDate: "",
    notes: "",
  });

  useEffect(() => {
    loadInventoryItems();
  }, []);

  const loadInventoryItems = async () => {
    try {
      const response = await inventoryApi.getItems({}, 1, 1000);
      setItems(response.items);
    } catch (error) {
      console.error("Error loading inventory items:", error);
      toast.error("Failed to load inventory items");
    }
  };

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    setFormData({
      ...formData,
      vendorId,
      vendorName: vendor?.name || "",
    });
  };

  const addItem = () => {
    setPOItems([
      ...poItems,
      {
        inventoryItemId: "",
        itemName: "",
        itemSku: "",
        quantity: 1,
        unitCost: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setPOItems(poItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const updated = [...poItems];

    if (field === "inventoryItemId") {
      const item = items.find((i) => i.id === value);
      if (item) {
        updated[index] = {
          ...updated[index],
          inventoryItemId: value,
          itemName: item.name,
          itemSku: item.sku,
          unitCost: item.cost || 0,
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    setPOItems(updated);
  };

  const calculateTotal = () => {
    return poItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitCost || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vendorName) {
      toast.error("Please select or enter a vendor");
      return;
    }

    if (poItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (poItems.some((item) => !item.inventoryItemId || !(item.quantity > 0) || !(item.unitCost >= 0))) {
      toast.error("Please fill in all item details correctly");
      return;
    }

    try {
      setLoading(true);
      const data: CreatePurchaseOrderData = {
        vendorId: formData.vendorId || undefined,
        vendorName: formData.vendorName,
        expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
        notes: formData.notes || undefined,
        items: poItems.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          itemSku: item.itemSku,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      };

      await inventoryApi.createPurchaseOrder(shopId, data);
      onSuccess();
    } catch (error) {
      console.error("Error creating purchase order:", error);
      toast.error("Failed to create purchase order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Create Purchase Order</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Vendor Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Vendor
              </label>
              <select
                value={formData.vendorId}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              >
                <option value="">Select a vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or Enter Vendor Name
              </label>
              <input
                type="text"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="Vendor name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={1}
                placeholder="Optional notes"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Package className="w-4 h-4" />
                Order Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {poItems.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 text-sm">No items added yet</p>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 text-sm text-[#FFCC00] hover:text-[#FFD700] font-medium"
                >
                  Add your first item
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {poItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <label aria-hidden className="block text-xs font-medium text-gray-600 mb-1">&nbsp;</label>
                      <select
                        value={item.inventoryItemId}
                        onChange={(e) => updateItem(index, "inventoryItemId", e.target.value)}
                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent text-sm"
                        required
                      >
                        <option value="">Select item</option>
                        {items.map((invItem) => (
                          <option key={invItem.id} value={invItem.id}>
                            {invItem.name} {invItem.sku ? `(${invItem.sku})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value))}
                        placeholder="Qty"
                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent text-sm"
                        required
                      />
                    </div>

                    <div className="w-32">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => updateItem(index, "unitCost", parseFloat(e.target.value))}
                        placeholder="0.00"
                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent text-sm"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2 pb-0.5">
                      <div className="text-sm font-medium text-gray-700 min-w-[80px]">
                        ${((item.quantity || 0) * (item.unitCost || 0)).toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total */}
          {poItems.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-gray-700 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Order Total:
                </span>
                <span className="text-gray-900">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || poItems.length === 0}
              className="flex-1 px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Purchase Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
