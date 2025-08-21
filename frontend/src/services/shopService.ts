import { ShopRegistrationFormData, ExistingApplication } from '@/types/shop';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export class ShopService {
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
            shopId: shop.shop_id,
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
      walletAddress,
      shopId: formData.shopId,
      name: formData.name,
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      country: formData.country,
      location: formData.location,
      companySize: formData.companySize,
      monthlyRevenue: formData.monthlyRevenue,
      website: formData.website || undefined,
      referral: formData.referral || undefined,
      reimbursementAddress: formData.reimbursementAddress || walletAddress,
      fixflowShopId: formData.fixflowShopId || formData.shopId,
      acceptTerms: formData.acceptTerms,  // Added acceptTerms field
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
        data = { error: text || "Server error" };
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
        
        // Provide more specific error messages
        if (response.status === 500) {
          throw new Error("Server error: Please check that all required fields are filled correctly");
        }
        throw new Error(data.error || data.message || "Failed to register shop");
      }

      return data;
    } catch (error) {
      console.error("Network or parsing error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error: Unable to connect to the server");
    }
  }
}