"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Loader2, Edit } from "lucide-react";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { ServiceForm } from "@/components/shop/service/ServiceForm";
import { ServiceFormPreview } from "@/components/shop/service/ServiceFormPreview";
import { ServiceFormLayout } from "@/components/shop/service/ServiceFormLayout";
import { AISalesAssistantSection } from "@/components/shop/service/AISalesAssistantSection";
import {
  getServiceById,
  updateService,
  ShopService,
  CreateServiceData,
  UpdateServiceData,
} from "@/services/api/services";
import type { AITone } from "@/utils/aiPreviewMocks";

/**
 * Edit Service page (Task 5 of Phase 1).
 *
 * Page-based replacement for the edit flow that previously opened a modal
 * on top of the service detail page. Fetches the existing service by ID,
 * pre-fills the form, submits via updateService, and routes back to the
 * service detail page on success or cancel.
 *
 * AI Sales Assistant section ships as visual-only in Phase 1 — toggle
 * state lives in this page's local state and is dropped on save. Phase 2
 * will load + persist these from `shop_services` AI columns.
 */

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params.serviceId as string;

  const [service, setService] = useState<ShopService | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<CreateServiceData>({
    serviceName: "",
    category: undefined,
    description: "",
    durationMinutes: undefined,
    priceUsd: 0,
    imageUrl: "",
    tags: [],
    active: true,
  });

  // AI Sales Assistant state — local only in Phase 1, dropped on save.
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiTone, setAiTone] = useState<AITone>("professional");
  const [aiSuggestUpsells, setAiSuggestUpsells] = useState(false);
  const [aiBookingAssistance, setAiBookingAssistance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getServiceById(serviceId);
        if (cancelled) return;
        if (data) {
          setService(data);
          // Seed preview state with the loaded service so the right column
          // shows the existing values immediately, before any edits.
          setPreviewData({
            serviceName: data.serviceName || "",
            category: data.category || undefined,
            description: data.description || "",
            durationMinutes: data.durationMinutes || undefined,
            priceUsd: data.priceUsd || 0,
            imageUrl: data.imageUrl || "",
            tags: data.tags || [],
            active: data.active !== undefined ? data.active : true,
          });
          // Seed AI Sales Assistant state from the loaded service so the AI
          // section reflects what's actually persisted, not the defaults.
          // Falls back to defaults for legacy services from before migration 107.
          setAiEnabled(data.aiSalesEnabled ?? false);
          setAiTone(data.aiTone ?? "professional");
          setAiSuggestUpsells(data.aiSuggestUpsells ?? false);
          setAiBookingAssistance(data.aiBookingAssistance ?? false);
        } else {
          toast.error("Service not found");
          router.push("/shop?tab=services");
        }
      } catch (error) {
        console.error("Error loading service:", error);
        if (!cancelled) {
          toast.error("Failed to load service");
          router.push("/shop?tab=services");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [serviceId, router]);

  const handleSubmit = async (data: CreateServiceData | UpdateServiceData) => {
    // Merge AI Sales Assistant state into the update payload. Same pattern as
    // the create page — ServiceForm owns the standard fields, AI state lives
    // at this page level, stitched together at submit time.
    const payload: UpdateServiceData = {
      ...(data as UpdateServiceData),
      aiSalesEnabled: aiEnabled,
      aiTone,
      aiSuggestUpsells,
      aiBookingAssistance,
    };
    const updated = await updateService(serviceId, payload);
    if (!updated) {
      toast.error("Service could not be updated. Please try again.");
      return;
    }
    toast.success("Service updated successfully!");
    router.push(`/shop/services/${serviceId}`);
    // Force the detail page to re-fetch so the updated values appear immediately.
    router.refresh();
  };

  const handleCancel = () => {
    router.push(`/shop/services/${serviceId}`);
  };

  const handleTabChange = (tab: string) => {
    window.location.href = `/shop?tab=${tab}`;
  };

  return (
    <DashboardLayout
      userRole="shop"
      activeTab="services"
      onTabChange={handleTabChange}
    >
      {loading || !service ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#FFCC00] mx-auto animate-spin" />
            <p className="mt-4 text-white">Loading service...</p>
          </div>
        </div>
      ) : (
        <ServiceFormLayout
          pageLabel="Edit"
          pageIcon={<Edit className="w-4 h-4 sm:w-5 sm:h-5" />}
          parentLabel={service.serviceName}
          description="Update service details, pricing, and AI sales settings."
          form={
            <ServiceForm
              initialData={service}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              onFormDataChange={setPreviewData}
              isEditing={true}
            >
              <AISalesAssistantSection
                enabled={aiEnabled}
                tone={aiTone}
                suggestUpsells={aiSuggestUpsells}
                enableBookingAssistance={aiBookingAssistance}
                onChange={(changes) => {
                  if (changes.enabled !== undefined) setAiEnabled(changes.enabled);
                  if (changes.tone !== undefined) setAiTone(changes.tone);
                  if (changes.suggestUpsells !== undefined) setAiSuggestUpsells(changes.suggestUpsells);
                  if (changes.enableBookingAssistance !== undefined) setAiBookingAssistance(changes.enableBookingAssistance);
                }}
              />
            </ServiceForm>
          }
          preview={
            <ServiceFormPreview formData={previewData} aiEnabled={aiEnabled} />
          }
        />
      )}
    </DashboardLayout>
  );
}
