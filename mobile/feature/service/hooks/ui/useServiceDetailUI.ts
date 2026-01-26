import { useState, useCallback } from "react";
import { Alert, Linking, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useQueryClient } from "@tanstack/react-query";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { ShopAvailability } from "@/shared/interfaces/appointment.interface";
import { queryKeys } from "@/shared/config/queryClient";
import { useUpdateServiceMutation } from "../mutations/useServiceMutations";
import { DAYS } from "../../constants/DAYS";
import { getCategoryLabel } from "@/shared/utilities/getCategoryLabel";

interface UseServiceDetailUIProps {
  serviceId: string;
  serviceData: ServiceData | undefined;
  shopId: string | undefined;
  availability: ShopAvailability[];
}

export function useServiceDetailUI({
  serviceId,
  serviceData,
  shopId,
  availability,
}: UseServiceDetailUIProps) {
  const queryClient = useQueryClient();
  const updateServiceMutation = useUpdateServiceMutation();

  // UI State
  const [isUpdating, setIsUpdating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);

  // Share Modal handlers
  const openShareModal = useCallback(() => setShowShareModal(true), []);
  const closeShareModal = useCallback(() => setShowShareModal(false), []);

  // Generate share URL and message
  const getShareUrl = useCallback(() => {
    return `https://repaircoin.app/service/${serviceId}`;
  }, [serviceId]);

  const getShareMessage = useCallback(() => {
    if (!serviceData) return "";
    return `Check out ${serviceData.serviceName} - $${serviceData.priceUsd}`;
  }, [serviceData]);

  // Share handlers
  const handleCopyLink = useCallback(async () => {
    await Clipboard.setStringAsync(getShareUrl());
    setCopySuccess(true);
    setTimeout(() => {
      setCopySuccess(false);
      setShowShareModal(false);
    }, 1500);
  }, [getShareUrl]);

  const handleShareWhatsApp = useCallback(async () => {
    const message = `${getShareMessage()}\n${getShareUrl()}`;
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
    setShowShareModal(false);
  }, [getShareMessage, getShareUrl]);

  const handleShareTwitter = useCallback(async () => {
    const message = getShareMessage();
    const shareUrl = getShareUrl();
    const url = `twitter://post?message=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;
    const webUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(webUrl);
    }
    setShowShareModal(false);
  }, [getShareMessage, getShareUrl]);

  const handleShareFacebook = useCallback(async () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
    await Linking.openURL(url);
    setShowShareModal(false);
  }, [getShareUrl]);

  const handleNativeShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${getShareMessage()}\n${getShareUrl()}`,
        url: getShareUrl(),
        title: serviceData?.serviceName || "Check out this service",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
    setShowShareModal(false);
  }, [getShareMessage, getShareUrl, serviceData]);

  // Toggle status handler
  const handleToggleStatus = useCallback(
    async (value: boolean) => {
      if (!isUpdating && serviceData) {
        setIsUpdating(true);
        try {
          await updateServiceMutation.mutateAsync({
            serviceId: serviceId,
            serviceData: { active: value },
          });

          await queryClient.invalidateQueries({
            queryKey: queryKeys.service(serviceId),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.shopServices({ shopId: shopId! }),
          });

          Alert.alert(
            "Success",
            `Service ${value ? "activated" : "deactivated"} successfully`
          );
        } catch (error) {
          console.error("Failed to update service status:", error);
        } finally {
          setIsUpdating(false);
        }
      }
    },
    [isUpdating, serviceData, serviceId, shopId, updateServiceMutation, queryClient]
  );

  // Format utilities
  const formatTime = useCallback((time: string | null) => {
    if (!time) return "--:--";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour);
    const period = h < 12 ? "AM" : "PM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minute} ${period}`;
  }, []);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  // Availability utilities
  const getTodayAvailability = useCallback(() => {
    const today = new Date().getDay();
    return availability.find((a) => a.dayOfWeek === today);
  }, [availability]);

  // Group consecutive days with same hours
  const getGroupedHours = useCallback(() => {
    if (availability.length === 0) return [];

    const groups: {
      days: number[];
      isOpen: boolean;
      openTime: string | null;
      closeTime: string | null;
    }[] = [];

    availability.forEach((day) => {
      const lastGroup = groups[groups.length - 1];
      const isSameSchedule =
        lastGroup &&
        lastGroup.isOpen === day.isOpen &&
        lastGroup.openTime === day.openTime &&
        lastGroup.closeTime === day.closeTime;

      if (isSameSchedule) {
        lastGroup.days.push(day.dayOfWeek);
      } else {
        groups.push({
          days: [day.dayOfWeek],
          isOpen: day.isOpen,
          openTime: day.openTime,
          closeTime: day.closeTime,
        });
      }
    });

    return groups;
  }, [availability]);

  // Format day range
  const formatDayRange = useCallback((days: number[]) => {
    if (days.length === 1) return DAYS[days[0]];
    if (days.length === 7) return "Every day";

    const isConsecutive = days.every(
      (d, i) => i === 0 || d === days[i - 1] + 1
    );
    if (isConsecutive && days.length > 2) {
      return `${DAYS[days[0]]} - ${DAYS[days[days.length - 1]]}`;
    }
    return days.map((d) => DAYS[d]).join(", ");
  }, []);

  // Count open days
  const openDaysCount = availability.filter((a) => a.isOpen).length;

  return {
    // UI State
    isUpdating,
    showShareModal,
    copySuccess,
    showAllHours,
    setShowAllHours,
    // Share modal
    openShareModal,
    closeShareModal,
    // Share handlers
    handleCopyLink,
    handleShareWhatsApp,
    handleShareTwitter,
    handleShareFacebook,
    handleNativeShare,
    // Status handler
    handleToggleStatus,
    // Format utilities
    formatTime,
    formatDate,
    getCategoryLabel,
    // Availability utilities
    getTodayAvailability,
    getGroupedHours,
    formatDayRange,
    openDaysCount,
  };
}
