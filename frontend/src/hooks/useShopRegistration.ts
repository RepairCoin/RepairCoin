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
    if (!formData.shopId) return "Shop ID is required";
    if (!formData.name) return "Company name is required";
    if (!formData.firstName) return "First name is required";
    if (!formData.lastName) return "Last name is required";
    if (!formData.email) return "Email is required";
    if (!formData.phone) return "Phone number is required";
    if (!formData.address) return "Address is required";
    if (!formData.city) return "City is required";
    if (!formData.country) return "Country is required";
    if (!formData.companySize) return "Company size is required";
    if (!formData.monthlyRevenue) return "Monthly revenue is required";
    if (!formData.acceptTerms) return "You must accept the terms and conditions";
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "Please enter a valid email address";
    }
    
    return null;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted");
    
    if (!account?.address) {
      console.log("No wallet connected");
      toast.error("Please connect your wallet to register");
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      console.log("Validation error:", validationError);
      toast.error(validationError);
      return;
    }

    console.log("Starting registration with data:", formData);
    setLoading(true);

    try {
      const result = await toast.promise(
        ShopService.registerShop(account.address, formData),
        {
          loading: 'Registering your shop...',
          success: 'Shop registration submitted successfully! 🎉',
          error: (err) => {
            console.error("Registration failed:", err);
            return err?.message || 'Failed to register shop';
          },
        }
      );
      
      console.log("Registration successful:", result);
      
      // Show additional success message
      toast.success("Your application is pending approval. Redirecting to dashboard...", {
        duration: 3000,
      });
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/shop");
      }, 2000);
    } catch (err) {
      // Error is already handled by toast.promise
      console.error("Registration error caught:", err);
    } finally {
      setLoading(false);
    }
  }, [account?.address, formData, validateForm, router]);

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
    handleSubmit,
    resetForm,
    setError,
    setSuccess,
  };
};