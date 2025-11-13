import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import toast from 'react-hot-toast';
import { ShopRegistrationFormData, ExistingApplication, initialShopFormData } from '@/types/shop';
import { ShopService } from '@/services/shopService';

export const useShopRegistration = () => {
  const account = useActiveAccount();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkingApplication, setCheckingApplication] = useState(false);
  const [existingApplication, setExistingApplication] = useState<ExistingApplication>({ 
    hasApplication: false, 
    status: null 
  });
  const [formData, setFormData] = useState<ShopRegistrationFormData>(initialShopFormData);

  // Check for existing application when wallet connects
  useEffect(() => {
    if (account?.address) {
      checkExistingApplication(account.address);
    }
  }, [account?.address]);

  const checkExistingApplication = useCallback(async (walletAddress: string) => {
    setCheckingApplication(true);
    try {
      const application = await ShopService.checkExistingApplication(walletAddress);
      setExistingApplication(application);
    } catch (error) {
      console.error("Error checking existing application:", error);
    } finally {
      setCheckingApplication(false);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith("location.")) {
      const locationField = name.split(".")[1];
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
      }));
    }
  }, []);

  const validateForm = useCallback((): string | null => {
    // Check required text fields
    if (!formData.shopId?.trim()) return "Shop ID is required";
    if (!formData.name?.trim()) return "Company name is required";
    if (!formData.firstName?.trim()) return "First name is required";
    if (!formData.lastName?.trim()) return "Last name is required";
    if (!formData.email?.trim()) return "Email is required";
    if (!formData.phone?.trim()) return "Phone number is required";
    if (!formData.address?.trim()) return "Street address is required";
    if (!formData.city?.trim()) return "City is required";
    if (!formData.country?.trim()) return "Country is required";
    if (!formData.category) return "Please select a business category";
    if (!formData.companySize) return "Please select a company size";
    if (!formData.monthlyRevenue) return "Please select your monthly revenue range";
    if (!formData.acceptTerms) return "You must accept the terms and conditions to register";

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "Please enter a valid email address (e.g., name@example.com)";
    }

    // Phone validation - basic check for reasonable length
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return "Please enter a valid phone number (minimum 10 digits)";
    }

    // Shop ID validation - no spaces or special characters
    const shopIdRegex = /^[a-zA-Z0-9_-]+$/;
    if (!shopIdRegex.test(formData.shopId)) {
      return "Shop ID can only contain letters, numbers, hyphens, and underscores";
    }

    // Website validation if provided
    if (formData.website?.trim()) {
      try {
        const url = new URL(formData.website);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return "Website URL must start with http:// or https://";
        }
      } catch {
        return "Please enter a valid website URL (e.g., https://example.com)";
      }
    }

    return null;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted");

    // Check wallet connection
    if (!account?.address) {
      console.log("No wallet connected");
      toast.error("Please connect your wallet to register", {
        icon: "🔗",
        duration: 4000,
      });
      return;
    }

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      console.log("Validation error:", validationError);
      toast.error(validationError, {
        icon: "⚠️",
        duration: 5000,
      });
      return;
    }

    console.log("Starting registration with data:", formData);
    setLoading(true);

    try {
      const result = await toast.promise(
        ShopService.registerShop(account.address, formData),
        {
          loading: 'Submitting your registration...',
          success: (data) => {
            console.log("Registration successful:", data);
            return 'Shop registration submitted successfully! 🎉';
          },
          error: (err) => {
            console.error("Registration failed:", err);

            // Extract error message
            let errorMessage = 'Failed to register shop. Please try again.';

            if (err instanceof Error) {
              errorMessage = err.message;
            } else if (typeof err === 'string') {
              errorMessage = err;
            } else if (err?.message) {
              errorMessage = err.message;
            }

            return errorMessage;
          },
        }
      );

      // Show success message with next steps
      toast.success("Your application is pending admin approval. You'll be redirected to your dashboard.", {
        duration: 4000,
        icon: "✅",
      });

      // Redirect after 2.5 seconds
      setTimeout(() => {
        router.push("/shop");
      }, 2500);
    } catch (err) {
      // Error is already handled by toast.promise
      console.error("Registration error caught:", err);

      // Additional error logging for debugging
      if (err instanceof Error) {
        console.error("Error details:", {
          message: err.message,
          stack: err.stack,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [account?.address, formData, validateForm, router]);

  const handleLocationSelect = useCallback((location: { latitude: number; longitude: number; address?: string }) => {
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        lat: location.latitude.toString(),
        lng: location.longitude.toString(),
      },
      // Optionally update address if provided and not already set
      ...(location.address && !prev.address ? { address: location.address } : {})
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialShopFormData);
    setError(null);
    setSuccess(null);
  }, []);

  return {
    // State
    formData,
    loading,
    error,
    success,
    checkingApplication,
    existingApplication,
    account,
    
    // Actions
    handleInputChange,
    handleLocationSelect,
    handleSubmit,
    resetForm,
    setError,
    setSuccess,
  };
};