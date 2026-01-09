"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Clock,
  Tag,
  Image as ImageIcon,
  Calendar,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Star,
  HeartHandshake,
  Flag,
} from "lucide-react";
import { sanitizeDescription } from "@/utils/sanitize";
import {
  getShopServices,
  createService,
  updateService,
  deleteService,
  ShopService,
  CreateServiceData,
  SERVICE_CATEGORIES,
} from "@/services/api/services";
import { CreateServiceModal } from "@/components/shop/modals/CreateServiceModal";
import { ShopServiceDetailsModal } from "@/components/shop/modals/ShopServiceDetailsModal";

interface ShopData {
  subscriptionActive?: boolean;
  subscriptionStatus?: string | null;
  subscriptionCancelledAt?: string | null;
  subscriptionEndsAt?: string | null;
  rcg_balance?: number;
  rcg_tier?: string;
}

interface ServicesTabProps {
  shopId: string;
  shopData?: ShopData | null;
}

const ITEMS_PER_PAGE = 12;

// Star Rating Display Component
const StarRatingDisplay: React.FC<{ rating: number; reviewCount: number }> = ({
  rating,
  reviewCount,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= Math.round(rating)
                ? "text-[#FFCC00] fill-[#FFCC00]"
                : "text-gray-600"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400">
        ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
      </span>
    </div>
  );
};

// Custom Toggle Switch Component matching Figma design
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ checked, onChange, onClick }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        onClick?.(e);
        onChange();
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-green-500" : "bg-gray-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
};

export const ServicesTab: React.FC<ServicesTabProps> = ({
  shopId,
  shopData,
}) => {
  const router = useRouter();
  const [services, setServices] = useState<ShopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingService, setDeletingService] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ShopService | null>(
    null
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadServices();
  }, [shopId, currentPage]);

  const loadServices = async () => {
    setLoading(true);

    try {
      const response = await getShopServices(shopId, {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });

      if (response) {
        setServices(response.data || []);
        setTotalItems(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCreateService = async (data: CreateServiceData) => {
    try {
      await createService(data);
      toast.success("Service created successfully!");
      setShowCreateModal(false);
      setCurrentPage(1);
      loadServices();
    } catch (error) {
      console.error("Error creating service:", error);
      toast.error("Failed to create service");
      throw error;
    }
  };

  const handleToggleActive = async (service: ShopService) => {
    try {
      const updatedService = await updateService(service.serviceId, {
        active: !service.active,
      });
      toast.success(
        `Service ${service.active ? "deactivated" : "activated"} successfully!`
      );

      if (updatedService) {
        setServices((prevServices) =>
          prevServices.map((s) =>
            s.serviceId === service.serviceId ? { ...s, active: !s.active } : s
          )
        );
      }
    } catch (error) {
      console.error("Error toggling service:", error);
      toast.error("Failed to update service status");
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this service? This action cannot be undone."
      )
    ) {
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
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  // Check if shop meets requirements to create services
  // Check if subscription is active OR if it's cancelled but still within the billing period
  const isCancelledButActive =
    shopData?.subscriptionStatus === "cancelled" &&
    shopData?.subscriptionCancelledAt &&
    shopData?.subscriptionEndsAt &&
    new Date(shopData.subscriptionEndsAt) > new Date();
  const hasSubscription =
    shopData?.subscriptionActive === true || isCancelledButActive;
  const hasRCG = (shopData?.rcg_balance ?? 0) >= 10000;
  const canCreateServices = hasSubscription || hasRCG;

  if (loading) {
    return (
      <div className="bg-[#101010] min-h-[600px] rounded-xl p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
          <p className="mt-4 text-white">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101010] rounded-xl p-6 space-y-6">
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
                To create and manage services in the marketplace, you need
                either:
              </p>
              <ul className="text-gray-300 text-sm space-y-1 mb-3 ml-4">
                <li>• An active RepairCoin subscription ($500/month), OR</li>
                <li>• Hold at least 10,000 RCG tokens</li>
              </ul>
              <p className="text-gray-400 text-xs">
                Current Status:{" "}
                {hasSubscription
                  ? "✅ Active Subscription"
                  : "❌ No Subscription"}{" "}
                |{" "}
                {hasRCG
                  ? `✅ ${shopData?.rcg_balance?.toFixed(2)} RCG`
                  : `❌ ${
                      shopData?.rcg_balance?.toFixed(2) || 0
                    } RCG (need 10,000)`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Section - Figma Design */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white mb-2">
            Service Marketplace
          </h1>
          <p className="text-gray-400">
            Manage your service offerings and bookings
          </p>
        </div>
        <button
          onClick={() => {
            if (!canCreateServices) {
              toast.error(
                "You need an active subscription or 10,000+ RCG to create services",
                {
                  duration: 5000,
                  position: "top-right",
                }
              );
              return;
            }
            setShowCreateModal(true);
          }}
          disabled={!canCreateServices}
          className={`flex items-center gap-2 font-semibold px-5 py-2 rounded-lg transition-all duration-200 ${
            canCreateServices
              ? "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
              : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
          }`}
        >
          <Plus className="w-4 h-4" />
          Create Service
        </button>
      </div>

      {/* Services Grid */}
      {services.length === 0 ? (
        <div className="bg-[#111] border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">🛠️</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No Services Yet
          </h3>
          <p className="text-gray-400 mb-6">
            {canCreateServices
              ? "Create your first service to start accepting bookings from customers"
              : "You need an active subscription or 10,000+ RCG to create services"}
          </p>
          <button
            onClick={() => {
              if (!canCreateServices) {
                toast.error(
                  "You need an active subscription or 10,000+ RCG to create services",
                  {
                    duration: 5000,
                    position: "top-right",
                  }
                );
                return;
              }
              setShowCreateModal(true);
            }}
            disabled={!canCreateServices}
            className={`inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-all duration-200 ${
              canCreateServices
                ? "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
                : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
            }`}
          >
            <Plus className="w-5 h-5" />
            Create Your First Service
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div
                key={service.serviceId}
                onClick={() => setSelectedService(service)}
                className="bg-[#1A1A1A] p-2 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all duration-200 flex flex-col cursor-pointer group"
              >
                {/* Service Image with Status Badge */}
                <div className="relative">
                  {service.imageUrl ? (
                    <div className="w-full h-64 overflow-hidden">
                      <img
                        src={service.imageUrl}
                        alt={service.serviceName}
                        className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center rounded-xl">
                      <ImageIcon className="w-16 h-16 text-gray-600" />
                    </div>
                  )}

                  {/* Status Badge with Flag Icon - Bottom Right of Image */}
                  <div className="absolute bottom-3 right-3">
                    {service.active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-green-500 text-white shadow-lg">
                        <Flag className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-gray-600 text-white shadow-lg">
                        <Flag className="w-3 h-3" />
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Group Token Indicators - Top Left */}
                  {service.groups && service.groups.length > 0 && (
                    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
                      {service.groups.slice(0, 2).map((group) => (
                        <div
                          key={group.groupId}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-600/90 backdrop-blur-sm text-white rounded-md text-[10px] font-bold shadow-lg"
                          title={`Linked to ${group.groupName}`}
                        >
                          <span>{group.icon || "🎁"}</span>
                          <span>{group.customTokenSymbol}</span>
                        </div>
                      ))}
                      {service.groups.length > 2 && (
                        <div className="px-2 py-1 bg-purple-600/90 backdrop-blur-sm text-white rounded-md text-[10px] font-bold shadow-lg">
                          +{service.groups.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-4 flex flex-col flex-1">
                  {/* Title and Toggle Row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3
                      className="text-base font-bold text-white line-clamp-1 flex-1"
                      title={service.serviceName}
                    >
                      {service.serviceName}
                    </h3>
                    <ToggleSwitch
                      checked={service.active}
                      onChange={() => handleToggleActive(service)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Star Rating */}
                  <div className="mb-2">
                    <StarRatingDisplay
                      rating={service.avgRating || 0}
                      reviewCount={service.reviewCount || 0}
                    />
                  </div>

                  {/* Category Badge */}
                  {service.category && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-gray-600 rounded-full text-xs text-gray-300">
                        <Tag className="w-3 h-3" />
                        {getCategoryLabel(service.category)}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {service.description && (
                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                      {sanitizeDescription(service.description)}
                    </p>
                  )}

                  {/* Group Rewards Info */}
                  {service.groups && service.groups.length > 0 && (
                    <div className="mb-4 p-2.5 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-3.5 h-3.5 text-purple-300" />
                        <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wide">
                          Group Rewards
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-200">
                        Earn{" "}
                        <span className="font-bold">
                          {service.groups
                            .map((g) => g.customTokenSymbol)
                            .join(", ")}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Price and Duration */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="text-green-500 font-bold">
                        ${service.priceUsd.toFixed(2)}
                      </span>
                    </div>
                    {service.durationMinutes && (
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">
                          {service.durationMinutes} mins
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Spacer */}
                  <div className="flex-1"></div>

                  {/* Action Buttons - Figma Style (Outlined) */}
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/shop/services/${service.serviceId}`);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-[#FFCC00] hover:text-black hover:border-[#FFCC00] transition-colors duration-200 text-sm"
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
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-[#FFCC00] hover:text-black hover:border-[#FFCC00] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingService === service.serviceId ? "..." : "Delete"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/shop/services/${service.serviceId}?tab=availability`
                        );
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-[#FFCC00] hover:text-black hover:border-[#FFCC00] transition-colors duration-200 text-sm"
                    >
                      <Settings className="w-4 h-4" />
                      Availability
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/shop/services/${service.serviceId}?tab=calendar`
                        );
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-[#FFCC00] hover:text-black hover:border-[#FFCC00] transition-colors duration-200 text-sm"
                    >
                      <Calendar className="w-4 h-4" />
                      Calendar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="flex items-center gap-1 px-3 py-2 bg-[#111] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-[#FFCC00]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-800"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => handlePageChange(1)}
                        className="px-3 py-2 bg-[#111] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-[#FFCC00]/50 transition-colors"
                      >
                        1
                      </button>
                      {currentPage > 4 && (
                        <span className="px-2 text-gray-600">...</span>
                      )}
                    </>
                  )}

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return false;
                      return Math.abs(page - currentPage) <= 2;
                    })
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        disabled={loading}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          page === currentPage
                            ? "bg-[#FFCC00] text-black font-semibold"
                            : "bg-[#111] border border-gray-800 text-gray-400 hover:text-white hover:border-[#FFCC00]/50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                  {currentPage < totalPages - 2 && totalPages > 5 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <span className="px-2 text-gray-600">...</span>
                      )}
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className="px-3 py-2 bg-[#111] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-[#FFCC00]/50 transition-colors"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="flex items-center gap-1 px-3 py-2 bg-[#111] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-[#FFCC00]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-800"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
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
            loadServices();
          }}
        />
      )}
    </div>
  );
};
