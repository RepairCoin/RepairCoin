"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Clock,
  Tag,
  Image as ImageIcon,
} from "lucide-react";
import {
  getAllServices,
  getShopServices,
  createService,
  updateService,
  deleteService,
  ShopService,
  CreateServiceData,
  UpdateServiceData,
  SERVICE_CATEGORIES,
} from "@/services/api/services";
import { CreateServiceModal } from "@/components/shop/modals/CreateServiceModal";
import { ShopServiceDetailsModal } from "@/components/shop/modals/ShopServiceDetailsModal";

interface ServicesTabProps {
  shopId: string;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({ shopId }) => {
  const [services, setServices] = useState<ShopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingService, setEditingService] = useState<ShopService | null>(null);
  const [deletingService, setDeletingService] = useState<string | null>(null);
  const [viewingService, setViewingService] = useState<ShopService | null>(null);

  useEffect(() => {
    loadServices();
  }, [shopId]);

  const loadServices = async () => {
    setLoading(true);
    console.log('🛍️ [ServicesTab] Loading services for shopId:', shopId);

    try {
      const response = await getShopServices(shopId, { limit: 100 });
      console.log('🛍️ [ServicesTab] API Response:', {
        response,
        hasData: !!response?.data,
        dataLength: response?.data?.length,
        rawData: response?.data
      });

      if (response?.data) {
        setServices(response.data);
        console.log('✅ [ServicesTab] Services set in state:', response.data.length, 'services');
      } else {
        console.warn('⚠️ [ServicesTab] No data in response');
      }
    } catch (error) {
      console.error("❌ [ServicesTab] Error loading services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
      console.log('🏁 [ServicesTab] Loading complete. Total services:', services.length);
    }
  };

  const handleCreateService = async (data: CreateServiceData) => {
    try {
      await createService(data);
      toast.success("Service created successfully!");
      setShowCreateModal(false);
      loadServices();
    } catch (error) {
      console.error("Error creating service:", error);
      toast.error("Failed to create service");
      throw error;
    }
  };

  const handleEditService = async (serviceId: string, data: UpdateServiceData) => {
    try {
      await updateService(serviceId, data);
      toast.success("Service updated successfully!");
      setEditingService(null);
      loadServices();
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error("Failed to update service");
      throw error;
    }
  };

  const handleToggleActive = async (service: ShopService) => {
    try {
      const updatedService = await updateService(service.serviceId, { active: !service.active });
      toast.success(`Service ${service.active ? "deactivated" : "activated"} successfully!`);

      // Update only the specific service in state instead of reloading all services
      if (updatedService) {
        setServices(prevServices =>
          prevServices.map(s =>
            s.serviceId === service.serviceId ? updatedService : s
          )
        );
      }
    } catch (error) {
      console.error("Error toggling service:", error);
      toast.error("Failed to update service status");
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service? This action cannot be undone.")) {
      return;
    }

    setDeletingService(serviceId);
    try {
      await deleteService(serviceId);
      toast.success("Service deleted successfully!");
      loadServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Failed to delete service");
    } finally {
      setDeletingService(null);
    }
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find(c => c.value === category);
    return cat?.label || category;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
          <p className="mt-4 text-white">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Service Marketplace</h1>
          <p className="text-gray-400">
            Manage your service offerings and bookings
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Create Service
        </button>
      </div>

      {/* Services Grid */}
      {services.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">🛠️</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Services Yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first service to start accepting bookings from customers
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Create Your First Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.serviceId}
              className={`bg-[#1A1A1A] border ${
                service.active ? "border-gray-800" : "border-gray-700 opacity-60"
              } rounded-2xl p-6 hover:border-[#FFCC00]/30 transition-all duration-200 cursor-pointer`}
              onClick={() => setViewingService(service)}
            >
              {/* Service Image */}
              {service.imageUrl ? (
                <div className="w-full h-48 rounded-xl mb-4 overflow-hidden bg-gray-800">
                  <img
                    src={service.imageUrl}
                    alt={service.serviceName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-48 rounded-xl mb-4 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <ImageIcon className="w-16 h-16 text-gray-600" />
                </div>
              )}

              {/* Service Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {service.serviceName}
                  </h3>
                  {service.category && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Tag className="w-3 h-3" />
                      {getCategoryLabel(service.category)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleToggleActive(service)}
                  className="ml-2"
                  title={service.active ? "Deactivate service" : "Activate service"}
                >
                  {service.active ? (
                    <ToggleRight className="w-8 h-8 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Description */}
              {service.description && (
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                  {service.description}
                </p>
              )}

              {/* Service Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className="text-white font-semibold">
                    ${service.priceUsd.toFixed(2)}
                  </span>
                </div>
                {service.durationMinutes && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    {service.durationMinutes} minutes
                  </div>
                )}
              </div>

              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {service.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="text-xs bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Status Badge */}
              <div className="mb-4">
                {service.active ? (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                    Active
                  </span>
                ) : (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                    Inactive
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-800">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingService(service);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 px-4 py-2 rounded-lg hover:bg-blue-600/30 transition-colors duration-200"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteService(service.serviceId);
                  }}
                  disabled={deletingService === service.serviceId}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 text-red-400 border border-red-600/30 px-4 py-2 rounded-lg hover:bg-red-600/30 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingService === service.serviceId ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Service Modal */}
      {showCreateModal && (
        <CreateServiceModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateService}
        />
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <CreateServiceModal
          onClose={() => setEditingService(null)}
          onSubmit={(data) => handleEditService(editingService.serviceId, data)}
          initialData={editingService}
          isEditing
        />
      )}

      {/* View Service Details Modal */}
      {viewingService && (
        <ShopServiceDetailsModal
          service={viewingService}
          onClose={() => setViewingService(null)}
        />
      )}
    </div>
  );
};
