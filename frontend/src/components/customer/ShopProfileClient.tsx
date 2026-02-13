"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Package,
  ArrowLeft,
  Loader2,
  Clock,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Plus,
  MessageCircle,
} from "lucide-react";
import { FaFacebook, FaTwitter, FaInstagram } from "react-icons/fa";
import { ShopService } from "@/services/shopService";
import { getAllServices, getShopServices, ShopServiceWithShopInfo } from "@/services/api/services";
import { getGalleryPhotos, getShopCustomers, type GalleryPhoto } from "@/services/api/shop";
import { ServiceCard } from "./ServiceCard";
import { ServiceDetailsModal } from "./ServiceDetailsModal";
import { ServiceCheckoutModal } from "./ServiceCheckoutModal";
import { CreateServiceModal } from "@/components/shop/modals/CreateServiceModal";
import { createService, CreateServiceData, UpdateServiceData } from "@/services/api/services";
import { useAuthStore } from "@/stores/authStore";
import * as messagingApi from "@/services/api/messaging";
import BookingAnalyticsTab from "@/components/shop/tabs/BookingAnalyticsTab";
import { AppointmentCalendar } from "@/components/shop/AppointmentCalendar";
import { CustomerGridView } from "@/components/shop/CustomerGridView";

interface ShopInfo {
  shopId: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  category?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  verified: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  aboutText?: string;
  totalCustomers?: number;
  location?: {
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

interface ShopProfileClientProps {
  shopId: string;
  isPreviewMode?: boolean; // Hide back button and messaging when in preview
}

export const ShopProfileClient: React.FC<ShopProfileClientProps> = ({ shopId, isPreviewMode = false }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);
  const [selectedService, setSelectedService] = useState<ShopServiceWithShopInfo | null>(null);
  const [checkoutService, setCheckoutService] = useState<ShopServiceWithShopInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "about" | "gallery" | "reviews" | "analytics" | "appointments" | "customers">("services");
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [operatingHours, setOperatingHours] = useState<any>(null);
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const { userProfile } = useAuthStore();

  useEffect(() => {
    loadShopData();
  }, [shopId]);

  const loadShopData = async () => {
    setLoading(true);
    try {
      console.log("🔍 [ShopProfile] Loading data for shopId:", shopId);

      // Fetch shop info, services, gallery, and customer count in parallel
      const [shopData, servicesData, gallery, customersData] = await Promise.all([
        ShopService.getShopById(shopId),
        getShopServices(shopId),
        getGalleryPhotos(shopId),
        isPreviewMode ? getShopCustomers(shopId) : Promise.resolve([]),
      ]);

      console.log("🔍 [ShopProfile] Shop data:", shopData);
      console.log("🔍 [ShopProfile] Services response:", servicesData);
      console.log("🔍 [ShopProfile] Gallery photos:", gallery?.length || 0);

      if (shopData) {
        setShopInfo(shopData);
      }

      if (servicesData && servicesData.data && shopData) {
        // Map services to include shop info for ServiceCard compatibility
        const servicesWithShopInfo = servicesData.data.map(service => ({
          ...service,
          companyName: shopData.name,
          shopName: shopData.name,
          shopAddress: shopData.address,
          shopPhone: shopData.phone,
          shopEmail: shopData.email,
          shopIsVerified: shopData.verified,
          shopLocation: shopData.location,
        }));
        setServices(servicesWithShopInfo);
      }

      // Set gallery photos
      if (gallery) {
        setGalleryPhotos(gallery);
      }

      // Set customer count
      if (customersData) {
        setCustomerCount(customersData.length);
      }

      // Note: Operating hours would need to be fetched from shop availability API
      // Currently not implemented - remove the undefined availability reference
    } catch (error) {
      console.error("Error loading shop data:", error);
      toast.error("Failed to load shop information");
    } finally {
      setLoading(false);
    }
  };

  const calculateIsOpen = (hours: any) => {
    if (!hours) return;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayHours = hours[dayNames[dayOfWeek]];

    if (!todayHours || !todayHours.isOpen) {
      setIsOpenNow(false);
      return;
    }

    // Parse start and end times
    const [startHour, startMin] = todayHours.startTime.split(':').map(Number);
    const [endHour, endMin] = todayHours.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    setIsOpenNow(currentTime >= startMinutes && currentTime <= endMinutes);
  };

  const handleViewDetails = (service: ShopServiceWithShopInfo) => {
    setSelectedService(service);
  };

  const handleBook = (service: ShopServiceWithShopInfo) => {
    setSelectedService(null);
    setCheckoutService(service);
  };

  const handleCheckoutSuccess = () => {
    toast.success("Booking confirmed! Redirecting to your orders...");
    setCheckoutService(null);
    setTimeout(() => {
      router.push("/customer?tab=orders");
    }, 1500);
  };

  const handleMessageShop = async () => {
    if (!userProfile?.address || !shopInfo) {
      toast.error("Please connect your wallet to send messages");
      return;
    }

    try {
      setIsMessaging(true);

      // Send initial general message (no service reference)
      const initialMessage = `Hi! I'd like to inquire about your services.`;

      await messagingApi.sendMessage({
        shopId: shopInfo.shopId,
        customerAddress: userProfile.address,
        messageText: initialMessage,
        messageType: "text",
      });

      // Navigate to messages tab
      router.push("/customer?tab=messages");
      toast.success("Conversation started!");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to start conversation. Please try again.");
    } finally {
      setIsMessaging(false);
    }
  };

  const handleFavoriteChange = (serviceId: string, isFavorited: boolean) => {
    // Update services array
    setServices(prev => prev.map(service =>
      service.serviceId === serviceId
        ? { ...service, isFavorited }
        : service
    ));
    // Also update selectedService if it's the same service
    if (selectedService?.serviceId === serviceId) {
      setSelectedService(prev => prev ? { ...prev, isFavorited } : prev);
    }
  };

  const handleCreateService = async (data: CreateServiceData | UpdateServiceData) => {
    try {
      await createService(data as CreateServiceData);
      toast.success("Service created successfully!");
      setShowCreateServiceModal(false);
      // Reload services list
      loadShopData();
    } catch (error) {
      console.error("Error creating service:", error);
      toast.error("Failed to create service");
    }
  };

  const calculateAverageRating = () => {
    if (services.length === 0) return 0;
    const totalRating = services.reduce((sum, service) => sum + (service.avgRating || 0), 0);
    return totalRating / services.length;
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextPhoto = () => {
    setLightboxIndex((prev) => (prev + 1) % galleryPhotos.length);
  };

  const prevPhoto = () => {
    setLightboxIndex((prev) => (prev - 1 + galleryPhotos.length) % galleryPhotos.length);
  };

  const getDirectionsUrl = () => {
    if (!shopInfo?.location?.lat || !shopInfo?.location?.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopInfo?.address || '')}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${shopInfo.location.lat},${shopInfo.location.lng}`;
  };

  const averageRating = calculateAverageRating();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mx-auto mb-4" />
          <p className="text-white">Loading shop...</p>
        </div>
      </div>
    );
  }

  if (!shopInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Shop Not Found</h2>
          <p className="text-gray-400 mb-6">The shop you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push("/customer?tab=marketplace")}
            className="bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto">
        {/* Back Button - Hidden in preview mode */}
        {!isPreviewMode && (
          <div className="p-6 pb-0">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-400 hover:text-[#FFCC00] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          </div>
        )}

        {/* Banner Image */}
        {shopInfo?.bannerUrl && (
          <div className="w-full h-64 md:h-80 relative overflow-hidden mt-6">
            <img
              src={shopInfo.bannerUrl}
              alt={`${shopInfo.name} banner`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
          </div>
        )}

        {/* Shop Header with Logo */}
        <div className="px-6">
          <div className={`bg-[#1A1A1A] border border-gray-800 rounded-2xl p-8 ${shopInfo?.bannerUrl ? '-mt-20 relative z-10' : 'mt-6'}`}>
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Shop Logo (if no banner) or overlapping logo */}
              {shopInfo?.logoUrl && (
                <div className={`${shopInfo?.bannerUrl ? 'absolute -top-16 left-8' : ''}`}>
                  <div className="w-32 h-32 bg-white rounded-full border-4 border-[#1A1A1A] overflow-hidden shadow-xl">
                    <img
                      src={shopInfo.logoUrl}
                      alt={`${shopInfo.name} logo`}
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                </div>
              )}

              {/* Shop Info */}
              <div className={`flex-1 ${shopInfo?.logoUrl && shopInfo?.bannerUrl ? 'pt-20' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">{shopInfo.name}</h1>
                  {shopInfo.category && (
                    <p className="text-gray-400 text-lg">{shopInfo.category}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!isPreviewMode && (
                    <button
                      onClick={handleMessageShop}
                      disabled={isMessaging}
                      className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="hidden sm:inline">Message Shop</span>
                    </button>
                  )}
                  {shopInfo.verified && (
                    <span className="px-4 py-2 bg-green-900 bg-opacity-30 text-green-400 text-sm font-medium rounded-full border border-green-700">
                      ✓ Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Rating */}
              {averageRating > 0 && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= Math.round(averageRating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-white font-semibold">{averageRating.toFixed(1)}</span>
                  <span className="text-gray-400">({services.length} services)</span>
                </div>
              )}

              {/* Contact Information */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#FFCC00] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-300">{shopInfo.address}</p>
                    {shopInfo.location?.city && (
                      <p className="text-sm text-gray-500">
                        {shopInfo.location.city}
                        {shopInfo.location.state && `, ${shopInfo.location.state}`}
                        {shopInfo.location.zipCode && ` ${shopInfo.location.zipCode}`}
                      </p>
                    )}
                  </div>
                </div>

                {shopInfo.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-[#FFCC00]" />
                    <a
                      href={`tel:${shopInfo.phone}`}
                      className="text-gray-300 hover:text-[#FFCC00] transition-colors"
                    >
                      {shopInfo.phone}
                    </a>
                  </div>
                )}

                {shopInfo.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-[#FFCC00]" />
                    <a
                      href={`mailto:${shopInfo.email}`}
                      className="text-gray-300 hover:text-[#FFCC00] transition-colors"
                    >
                      {shopInfo.email}
                    </a>
                  </div>
                )}

                {shopInfo.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[#FFCC00]" />
                    <a
                      href={shopInfo.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-[#FFCC00] transition-colors"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar: Operating Hours, Stats & Social Media */}
            <div className="lg:w-80 space-y-6">
              {/* Operating Hours */}
              {operatingHours && (
                <div className="bg-[#0A0A0A] rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-[#FFCC00]" />
                    <h3 className="text-sm font-semibold text-white">Operating Hours</h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(operatingHours).map(([day, hours]: [string, any]) => (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="text-gray-400 capitalize">{day}</span>
                        <span className={hours.isOpen ? "text-white" : "text-gray-600"}>
                          {hours.isOpen ? `${hours.startTime} - ${hours.endTime}` : "Closed"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <span className={`text-sm font-semibold ${isOpenNow ? 'text-green-400' : 'text-red-400'}`}>
                      {isOpenNow ? '🟢 Open Now' : '🔴 Closed'}
                    </span>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="bg-[#0A0A0A] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-6 h-6 text-[#FFCC00]" />
                  <div>
                    <p className="text-2xl font-bold text-white">{services.length}</p>
                    <p className="text-sm text-gray-400">Services Available</p>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Follow Us</h3>
                <div className="flex items-center gap-3">
                  {shopInfo.facebook ? (
                    <a
                      href={shopInfo.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full transition-all duration-200 group shadow hover:shadow-blue-600/25 hover:scale-105"
                    >
                      <FaFacebook className="w-5 h-5 text-white" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                      <FaFacebook className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  {shopInfo.twitter ? (
                    <a
                      href={shopInfo.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 bg-sky-500 hover:bg-sky-600 rounded-full transition-all duration-200 group shadow hover:shadow-sky-500/25 hover:scale-105"
                    >
                      <FaTwitter className="w-5 h-5 text-white" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                      <FaTwitter className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  {shopInfo.instagram ? (
                    <a
                      href={shopInfo.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 bg-gradient-to-tr from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full transition-all duration-200 group shadow hover:shadow-purple-500/25 hover:scale-105"
                    >
                      <FaInstagram className="w-5 h-5 text-white" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-600 opacity-50 rounded-full cursor-not-allowed">
                      <FaInstagram className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Google Maps Embed */}
        {shopInfo?.location?.lat && shopInfo?.location?.lng && (
          <div className="px-6 mb-8">
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#FFCC00]" />
                  <h3 className="text-lg font-semibold text-white">Location</h3>
                </div>
                <a
                  href={getDirectionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors text-sm"
                >
                  <Navigation className="w-4 h-4" />
                  Get Directions
                </a>
              </div>
              <div className="w-full h-96 rounded-lg overflow-hidden">
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0 }}
                  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${shopInfo.location.lat},${shopInfo.location.lng}`}
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 mt-12">
          <div className="border-b border-gray-800 mb-8">
            <div className="flex gap-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab("services")}
                className={`pb-4 px-2 font-semibold transition-colors relative whitespace-nowrap ${
                  activeTab === "services"
                    ? "text-[#FFCC00]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Services ({services.length})
                {activeTab === "services" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
                )}
              </button>
              {isPreviewMode && (
                <>
                  <button
                    onClick={() => setActiveTab("analytics")}
                    className={`pb-4 px-2 font-semibold transition-colors relative whitespace-nowrap ${
                      activeTab === "analytics"
                        ? "text-[#FFCC00]"
                        : "text-gray-400 hover:text-gray-300"
                    }`}
                  >
                    Booking Analytics
                    {activeTab === "analytics" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("appointments")}
                    className={`pb-4 px-2 font-semibold transition-colors relative whitespace-nowrap ${
                      activeTab === "appointments"
                        ? "text-[#FFCC00]"
                        : "text-gray-400 hover:text-gray-300"
                    }`}
                  >
                    Appointments
                    {activeTab === "appointments" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("customers")}
                    className={`pb-4 px-2 font-semibold transition-colors relative whitespace-nowrap ${
                      activeTab === "customers"
                        ? "text-[#FFCC00]"
                        : "text-gray-400 hover:text-gray-300"
                    }`}
                  >
                    Customers ({customerCount ?? 0})
                    {activeTab === "customers" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
                    )}
                  </button>
                </>
              )}
              {shopInfo?.aboutText && (
                <button
                  onClick={() => setActiveTab("about")}
                  className={`pb-4 px-2 font-semibold transition-colors relative whitespace-nowrap ${
                    activeTab === "about"
                      ? "text-[#FFCC00]"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  About
                  {activeTab === "about" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
                  )}
                </button>
              )}
              {galleryPhotos.length > 0 && (
                <button
                  onClick={() => setActiveTab("gallery")}
                  className={`pb-4 px-2 font-semibold transition-colors relative whitespace-nowrap ${
                    activeTab === "gallery"
                      ? "text-[#FFCC00]"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Gallery ({galleryPhotos.length})
                  {activeTab === "gallery" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
                  )}
                </button>
              )}
              <button
                onClick={() => setActiveTab("reviews")}
                className={`pb-4 px-2 font-semibold transition-colors relative whitespace-nowrap ${
                  activeTab === "reviews"
                    ? "text-[#FFCC00]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Reviews
                {activeTab === "reviews" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
                )}
              </button>
            </div>
          </div>

        {/* Tab Content */}
        {activeTab === "services" && (
          <div>
            {/* Header with Add Service Button */}
            {isPreviewMode && (
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white">My Services</h3>
                <button
                  onClick={() => setShowCreateServiceModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD700] text-black rounded-lg font-semibold transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Service
                </button>
              </div>
            )}

            {services.length === 0 ? (
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  No Services Available
                </h3>
                <p className="text-gray-400">This shop hasn't added any services yet.</p>
                {isPreviewMode && (
                  <button
                    onClick={() => setShowCreateServiceModal(true)}
                    className="mt-6 px-6 py-3 bg-[#FFCC00] hover:bg-[#FFD700] text-black rounded-lg font-semibold transition-colors"
                  >
                    Create Your First Service
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service) => (
                  <ServiceCard
                    key={service.serviceId}
                    service={service}
                    onBook={handleBook}
                    onViewDetails={handleViewDetails}
                    onFavoriteChange={handleFavoriteChange}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* About Tab */}
        {activeTab === "about" && shopInfo?.aboutText && (
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">About {shopInfo.name}</h2>
            <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
              {shopInfo.aboutText}
            </div>
          </div>
        )}

        {/* Gallery Tab */}
        {activeTab === "gallery" && galleryPhotos.length > 0 && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  onClick={() => openLightbox(index)}
                  className="relative aspect-square bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden cursor-pointer group"
                >
                  <img
                    src={photo.photoUrl}
                    alt={photo.caption || `Gallery photo ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-sm truncate">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-12 text-center">
            <Star className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-xl font-semibold text-white mb-2">Reviews Coming Soon</h3>
            <p className="text-gray-400">
              Shop reviews will be available in a future update.
            </p>
          </div>
        )}

        {/* Booking Analytics Tab */}
        {activeTab === "analytics" && isPreviewMode && (
          <div>
            <BookingAnalyticsTab />
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === "appointments" && isPreviewMode && (
          <div>
            <AppointmentCalendar />
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === "customers" && isPreviewMode && (
          <div>
            <CustomerGridView shopId={shopId} onCustomersLoaded={setCustomerCount} />
          </div>
        )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && galleryPhotos.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Previous Button */}
          {galleryPhotos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevPhoto();
              }}
              className="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-7xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={galleryPhotos[lightboxIndex].photoUrl}
              alt={galleryPhotos[lightboxIndex].caption || `Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            {galleryPhotos[lightboxIndex].caption && (
              <div className="mt-4 text-center">
                <p className="text-white text-lg">{galleryPhotos[lightboxIndex].caption}</p>
              </div>
            )}
            <div className="mt-2 text-center">
              <p className="text-gray-400 text-sm">
                {`${lightboxIndex + 1} / ${galleryPhotos.length}`}
              </p>
            </div>
          </div>

          {/* Next Button */}
          {galleryPhotos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextPhoto();
              }}
              className="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}
        </div>
      )}

      {/* Service Details Modal */}
      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onBook={handleBook}
          onFavoriteChange={handleFavoriteChange}
        />
      )}

      {/* Checkout Modal */}
      {checkoutService && (
        <ServiceCheckoutModal
          service={checkoutService}
          onClose={() => setCheckoutService(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Create Service Modal */}
      {showCreateServiceModal && isPreviewMode && (
        <CreateServiceModal
          onClose={() => setShowCreateServiceModal(false)}
          onSubmit={handleCreateService}
        />
      )}
    </div>
  );
};

export default ShopProfileClient;
