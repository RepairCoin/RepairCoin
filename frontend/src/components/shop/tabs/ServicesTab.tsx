"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Calendar,
  Settings,
  Users,
} from "lucide-react";
import { sanitizeDescription } from "@/utils/sanitize";
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

interface ShopData {
  subscriptionActive?: boolean;
  rcg_balance?: number;
  rcg_tier?: string;
}

interface ServicesTabProps {
  shopId: string;
  shopData?: ShopData | null;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({ shopId, shopData }) => {
  const router = useRouter();
  const [services, setServices] = useState<ShopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingService, setDeletingService] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ShopService | null>(null);

  useEffect(() => {
    loadServices();
  }, [shopId]);

  const loadServices = async () => {
    setLoading(true);

    try {
      const response = await getShopServices(shopId, { limit: 100 });

      if (response?.data) {
        setServices(response.data);
      }
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
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

  // Check if shop meets requirements to create services
  const hasSubscription = shopData?.subscriptionActive === true;
  const hasRCG = (shopData?.rcg_balance ?? 0) >= 10000;
  const canCreateServices = hasSubscription || hasRCG;

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
      {/* Requirement Warning Banner */}
      {!canCreateServices && (
        <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl text-red-400">⚠️</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1 text-red-400">
                Subscription or RCG Holdings Required
              </h3>
              <p className="text-gray-300 text-sm mb-3">
                To create and manage services in the marketplace, you need either:
              </p>
              <ul className="text-gray-300 text-sm space-y-1 mb-3 ml-4">
                <li>• An active RepairCoin subscription ($500/month), OR</li>
                <li>• Hold at least 10,000 RCG tokens</li>
              </ul>
              <p className="text-gray-400 text-xs">
                Current Status: {hasSubscription ? '✅ Active Subscription' : '❌ No Subscription'} | {hasRCG ? `✅ ${shopData?.rcg_balance?.toFixed(2)} RCG` : `❌ ${shopData?.rcg_balance?.toFixed(2) || 0} RCG (need 10,000)`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Service Marketplace</h1>
          <p className="text-gray-400">
            Manage your service offerings and bookings
          </p>
        </div>
        <button
          onClick={() => {
            if (!canCreateServices) {
              toast.error("You need an active subscription or 10,000+ RCG to create services", {
                duration: 5000,
                position: 'top-right'
              });
              return;
            }
            setShowCreateModal(true);
          }}
          disabled={!canCreateServices}
          className={`flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-all duration-200 transform shadow-lg ${
            canCreateServices
              ? "bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black hover:from-[#FFD700] hover:to-[#FFCC00] hover:scale-105 cursor-pointer"
              : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
          }`}
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
            {canCreateServices
              ? "Create your first service to start accepting bookings from customers"
              : "You need an active subscription or 10,000+ RCG to create services"}
          </p>
          <button
            onClick={() => {
              if (!canCreateServices) {
                toast.error("You need an active subscription or 10,000+ RCG to create services", {
                  duration: 5000,
                  position: 'top-right'
                });
                return;
              }
              setShowCreateModal(true);
            }}
            disabled={!canCreateServices}
            className={`inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-all duration-200 ${
              canCreateServices
                ? "bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black hover:from-[#FFD700] hover:to-[#FFCC00]"
                : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
            }`}
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
              onClick={() => setSelectedService(service)}
              className={`bg-[#1A1A1A] border ${
                service.active ? "border-gray-800" : "border-gray-700 opacity-60"
              } rounded-2xl p-6 hover:border-[#FFCC00]/30 transition-all duration-200 flex flex-col cursor-pointer`}
            >
              {/* Service Image */}
              <div className="relative mb-4">
                {service.imageUrl ? (
                  <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-800">
                    <img
                      src={service.imageUrl}
                      alt={service.serviceName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-600" />
                  </div>
                )}

                {/* Group Token Indicators - Overlay on image */}
                {service.groups && service.groups.length > 0 && (
                  <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
                    {service.groups.map((group) => (
                      <div
                        key={group.groupId}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-purple-600/95 to-purple-500/95 backdrop-blur-md border border-purple-300/50 text-white rounded-lg text-[11px] font-bold shadow-xl"
                        title={`Linked to ${group.groupName} (${group.customTokenSymbol})`}
                      >
                        <span className="text-sm">{group.icon || '🎁'}</span>
                        <span className="tracking-wide">{group.customTokenSymbol}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Service Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-1 truncate" title={service.serviceName}>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive(service);
                  }}
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
                <p className="text-sm text-gray-400 mb-4 line-clamp-2 whitespace-pre-line">
                  {sanitizeDescription(service.description)}
                </p>
              )}

              {/* Group Rewards Info */}
              {service.groups && service.groups.length > 0 && (
                <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Users className="w-4 h-4 text-purple-300" />
                    <span className="text-xs font-bold text-purple-300">GROUP REWARDS ACTIVE</span>
                  </div>
                  <p className="text-[11px] text-purple-200 leading-relaxed">
                    Customers earn <span className="font-bold text-purple-100">{service.groups.map(g => g.customTokenSymbol).join(', ')}</span> when booking
                  </p>
                </div>
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

              {/* Spacer to push actions to bottom */}
              <div className="flex-1"></div>

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-gray-800 mt-auto">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/shop/services/${service.serviceId}`);
                    }}
                    className="flex items-center justify-center gap-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 px-3 py-2 rounded-lg hover:bg-blue-600/30 transition-colors duration-200 text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/shop/services/${service.serviceId}?tab=availability`);
                    }}
                    className="flex items-center justify-center gap-2 bg-purple-600/20 text-purple-400 border border-purple-600/30 px-3 py-2 rounded-lg hover:bg-purple-600/30 transition-colors duration-200 text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Availability
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/shop/services/${service.serviceId}?tab=calendar`);
                    }}
                    className="flex items-center justify-center gap-2 bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/30 px-3 py-2 rounded-lg hover:bg-[#FFCC00]/30 transition-colors duration-200 text-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    Calendar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteService(service.serviceId);
                    }}
                    disabled={deletingService === service.serviceId}
                    className="flex items-center justify-center gap-2 bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-2 rounded-lg hover:bg-red-600/30 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingService === service.serviceId ? "Deleting..." : "Delete"}
                  </button>
                </div>
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

      {/* Service Details Modal */}
      {selectedService && (
        <ShopServiceDetailsModal
          service={selectedService}
          onClose={() => {
            setSelectedService(null);
            loadServices(); // Reload services in case groups were changed
          }}
        />
      )}
    </div>
  );
};
