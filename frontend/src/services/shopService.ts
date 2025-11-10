import { ShopRegistrationFormData, ExistingApplication } from '@/types/shop';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

export class ShopService {
  /**
   * Get all active shops (public endpoint for customers to find shops)
   */
  static async getAllShops(): Promise<any[]> {
    try {
      const response = await fetch(`${API_URL}/shops`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shops: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data?.shops || [];
    } catch (error) {
      console.error("Error fetching shops:", error);
      throw error;
    }
  }

  /**
   * Check if a wallet has an existing shop application
   */
  static async checkExistingApplication(walletAddress: string): Promise<ExistingApplication> {
    try {
      const response = await fetch(`${API_URL}/shops/wallet/${walletAddress}`);
      console.log("Registration check - API Response Status:", response.status);
      console.log("Registration check - Fetching for wallet:", walletAddress);

      if (response.ok) {
        const data = await response.json();
        console.log("Registration check - API Response:", data);
        const shop = data.data;
        
        if (shop) {
          return {
            hasApplication: true,
            status: shop.verified ? "verified" : "pending",
            shopName: shop.name,
            shopId: shop.shopId,
          };
        }
      }
      
      return { hasApplication: false, status: null };
    } catch (error) {
      console.error("Error checking existing application:", error);
      return { hasApplication: false, status: null };
    }
  }

  /**
   * Register a new shop
   */
  static async registerShop(walletAddress: string, formData: ShopRegistrationFormData) {
    const registrationData = {
      shopId: formData.shopId,
      name: formData.name,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      country: formData.country,
      category: formData.category,
      companySize: formData.companySize,
      monthlyRevenue: formData.monthlyRevenue,
      website: formData.website,
      referral: formData.referral,
      facebook: formData.facebook,
      twitter: formData.twitter,
      instagram: formData.instagram,
      reimbursementAddress: formData.reimbursementAddress,
      fixflowShopId: formData.fixflowShopId,
      location:{
         city: formData.location.city,
         state: formData.location.state,
         zipCode: formData.location.zipCode,
         lat: formData.location.lat,
         lng: formData.location.lng
      },
      acceptTerms: formData.acceptTerms,
      walletAddress: walletAddress
    };

    console.log("Submitting shop registration:", registrationData);
    console.log("API URL:", `${API_URL}/shops/register`);

    try {
      const response = await fetch(`${API_URL}/shops/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationData),
      });

      // Try to parse JSON response
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        // If not JSON, get text response
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server error: Invalid response format. Please try again.");
      }

      console.log("Registration response:", response.status, data);

      if (!response.ok) {
        // Log the full error for debugging
        console.error("Registration failed:", {
          status: response.status,
          error: data.error,
          details: data.details,
          body: registrationData
        });

        // Provide more specific error messages based on status code
        if (response.status === 400) {
          // Bad request - validation error
          const errorMsg = data.error || data.message || "Invalid input. Please check all required fields.";
          throw new Error(errorMsg);
        } else if (response.status === 409) {
          // Conflict - duplicate shop ID or wallet
          const errorMsg = data.error || "Shop ID or wallet address already exists.";
          throw new Error(errorMsg);
        } else if (response.status === 500) {
          // Server error
          throw new Error("Server error occurred. Please try again later.");
        } else if (response.status === 503) {
          // Service unavailable
          throw new Error("Service temporarily unavailable. Please try again in a few minutes.");
        } else {
          // Generic error
          const errorMsg = data.error || data.message || `Registration failed (Error ${response.status})`;
          throw new Error(errorMsg);
        }
      }

      return data;
    } catch (error) {
      console.error("Registration error:", error);

      // Re-throw if it's already an Error instance with a message
      if (error instanceof Error) {
        throw error;
      }

      // Network error or unknown error
      throw new Error("Unable to connect to server. Please check your internet connection and try again.");
    }
  }
}