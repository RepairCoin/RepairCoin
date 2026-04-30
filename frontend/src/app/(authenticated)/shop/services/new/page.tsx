"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Plus } from "lucide-react";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { ServiceForm } from "@/components/shop/service/ServiceForm";
import { ServiceFormPreview } from "@/components/shop/service/ServiceFormPreview";
import { ServiceFormLayout } from "@/components/shop/service/ServiceFormLayout";
import { AISalesAssistantSection } from "@/components/shop/service/AISalesAssistantSection";
import {
  createService,
  CreateServiceData,
  UpdateServiceData,
} from "@/services/api/services";
import type { AITone } from "@/utils/aiPreviewMocks";

/**
 * Create New Service page (Task 4 of Phase 1).
 *
 * Page-based replacement for the create flow that previously used the
 * CreateServiceModal. The modal is still in the codebase as a fallback —
 * this page coexists with it until Tasks 6-7 flip the navigation.
 *
 * Layout matches `sc1.jpeg`: breadcrumb header + 2-column body with form
 * on the left and a sticky live-preview card on the right.
 *
 * AI Sales Assistant section ships as visual-only in Phase 1 — toggle
 * state lives in this page's local state and is dropped on save. Phase 2
 * adds DB columns and persists the AI state. Phase 3 wires it to Claude.
 */

const EMPTY_FORM_DATA: CreateServiceData = {
  serviceName: "",
  category: undefined,
  description: "",
  durationMinutes: undefined,
  priceUsd: 0,
  imageUrl: "",
  tags: [],
  active: true,
};

export default function NewServicePage() {
  const router = useRouter();

  // Mirror of ServiceForm's internal formData so ServiceFormPreview can render the same state.
  // ServiceForm owns the source of truth; this updates via its onFormDataChange callback.
  const [previewData, setPreviewData] = useState<CreateServiceData>(EMPTY_FORM_DATA);

  // AI Sales Assistant state — local only in Phase 1, dropped on save.
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiTone, setAiTone] = useState<AITone>("professional");
  const [aiSuggestUpsells, setAiSuggestUpsells] = useState(false);
  const [aiBookingAssistance, setAiBookingAssistance] = useState(false);

  const handleSubmit = async (data: CreateServiceData | UpdateServiceData) => {
    const created = await createService(data as CreateServiceData);
    if (!created) {
      toast.error("Service could not be created. Please try again.");
      return;
    }
    toast.success("Service created successfully!");
    router.push("/shop?tab=services");
    // Force the services list to refetch so the new service appears immediately
    // without the user needing to hard-refresh.
    router.refresh();
  };

  const handleCancel = () => {
    router.push("/shop?tab=services");
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
      <ServiceFormLayout
        pageLabel="Add Service"
        pageIcon={<Plus className="w-4 h-4 sm:w-5 sm:h-5" />}
        description="Add a new service to your catalog and start accepting bookings."
        form={
          <ServiceForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onFormDataChange={setPreviewData}
            isEditing={false}
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
    </DashboardLayout>
  );
}
