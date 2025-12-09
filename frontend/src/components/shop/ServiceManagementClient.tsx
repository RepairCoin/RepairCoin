"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Edit, Settings, Calendar, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { getServiceById, updateService, ShopService, UpdateServiceData } from "@/services/api/services";
import { CreateServiceModal } from "@/components/shop/modals/CreateServiceModal";

// Import the per-service components (we'll create these)
import { ServiceAvailabilitySettings } from "@/components/shop/service/ServiceAvailabilitySettings";
import { ServiceCalendarView } from "@/components/shop/service/ServiceCalendarView";

interface ServiceManagementClientProps {
  serviceId: string;
}

type TabType = 'overview' | 'availability' | 'calendar';

export default function ServiceManagementClient({ serviceId }: ServiceManagementClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [service, setService] = useState<ShopService | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    // Check URL params for tab
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['overview', 'availability', 'calendar'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    try {
      setLoading(true);
      const data = await getServiceById(serviceId);
      if (data) {
        setService(data);
      } else {
        toast.error("Service not found");
        router.push("/shop?tab=services");
      }
    } catch (error) {
      console.error("Error loading service:", error);
      toast.error("Failed to load service");
      router.push("/shop?tab=services");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateService = async (data: UpdateServiceData) => {
    if (!service) return;

    try {
      await updateService(service.serviceId, data);
      toast.success("Service updated successfully!");
      setShowEditModal(false);
      loadService();
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error("Failed to update service");
      throw error;
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Update URL without navigation
    const newUrl = `/shop/services/${serviceId}${tab !== 'overview' ? `?tab=${tab}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#FFCC00] mx-auto" />
          <p className="mt-4 text-white">Loading service...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/shop?tab=services")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Services
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{service.serviceName}</h1>
              <p className="text-gray-400">
                Manage service details, availability, and bookings
              </p>
            </div>

            {activeTab === 'overview' && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 px-6 py-3 rounded-lg hover:bg-blue-600/30 transition-colors duration-200"
              >
                <Edit className="w-5 h-5" />
                Edit Service
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              activeTab === 'overview'
                ? 'text-[#FFCC00]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Overview
            </div>
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
            )}
          </button>

          <button
            onClick={() => handleTabChange('availability')}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              activeTab === 'availability'
                ? 'text-[#FFCC00]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Availability
            </div>
            {activeTab === 'availability' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
            )}
          </button>

          <button
            onClick={() => handleTabChange('calendar')}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              activeTab === 'calendar'
                ? 'text-[#FFCC00]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Calendar
            </div>
            {activeTab === 'calendar' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && (
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Service Image */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Service Image</h3>
                  {service.imageUrl ? (
                    <img
                      src={service.imageUrl}
                      alt={service.serviceName}
                      className="w-full h-64 object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-64 bg-gray-800 rounded-xl flex items-center justify-center">
                      <span className="text-gray-500">No image</span>
                    </div>
                  )}
                </div>

                {/* Service Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Service Name</label>
                    <p className="text-white text-lg">{service.serviceName}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                    <p className="text-white">{service.description || 'No description'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Price</label>
                      <p className="text-white text-xl font-semibold">${service.priceUsd.toFixed(2)}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Duration</label>
                      <p className="text-white text-xl font-semibold">
                        {service.durationMinutes ? `${service.durationMinutes} min` : 'Not set'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                    <p className="text-white">{service.category || 'Other'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                    {service.active ? (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                        Inactive
                      </span>
                    )}
                  </div>

                  {service.tags && service.tags.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {service.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-[#FFCC00]/10 border border-[#FFCC00]/30 text-[#FFCC00] rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'availability' && (
            <ServiceAvailabilitySettings serviceId={serviceId} service={service} />
          )}

          {activeTab === 'calendar' && (
            <ServiceCalendarView serviceId={serviceId} service={service} />
          )}
        </div>

        {/* Edit Service Modal */}
        {showEditModal && (
          <CreateServiceModal
            onClose={() => setShowEditModal(false)}
            onSubmit={handleUpdateService}
            initialData={service}
            isEditing
          />
        )}
      </div>
    </div>
  );
}
