"use client";

import React, { useState, useEffect } from "react";
import { Save, RefreshCw, User, Mail, Phone, Info } from "lucide-react";
import { adminApi } from "@/services/api/admin";
import { toast } from "react-hot-toast";

interface AdminProfile {
  address: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * The logged-in admin's own contact details (name/email/phone). This is the same record a shop
 * sees under "Your Dedicated Account Manager" when this admin is assigned to them, so keeping it
 * filled in is what makes the shop-side contact card show an email and phone.
 */
export const MyProfileContent: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [hasChanges, setHasChanges] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getMyProfile();
      const p = (res?.data ?? null) as AdminProfile | null;
      if (p) {
        setAddress(p.address);
        setForm({ name: p.name ?? "", email: p.email ?? "", phone: p.phone ?? "" });
      }
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to load admin profile:", error);
      toast.error("Failed to load your profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.updateMyProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      const p = (res?.data ?? null) as AdminProfile | null;
      if (p) {
        setForm({ name: p.name ?? "", email: p.email ?? "", phone: p.phone ?? "" });
      }
      setHasChanges(false);
      toast.success("Profile updated");
    } catch (error) {
      console.error("Failed to update admin profile:", error);
      toast.error("Failed to update your profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-[#FFCC00] animate-spin" />
        <span className="ml-3 text-gray-400">Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#FFCC00]">My Profile</h2>
          <p className="text-sm text-gray-400 mt-1">
            Your contact details as an account manager
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 bg-[#FFCC00] hover:bg-[#FFD633] text-black rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Why this matters */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-300">
            When you're assigned as a shop's account manager, these details are shown to that shop
            under <span className="font-medium">"Your Dedicated Account Manager"</span>. Add an
            email and phone so shops can reach you.
          </p>
        </div>
      </div>

      {/* Contact Details */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#303236]">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-lg font-semibold text-white">Contact Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-400 mb-2">
              <Mail className="w-3.5 h-3.5" />
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="you@repaircoin.ai"
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-400 mb-2">
              <Phone className="w-3.5 h-3.5" />
              Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-2 bg-[#101010] border border-[#303236] rounded-lg text-white focus:outline-none focus:border-[#FFCC00] transition-all duration-200"
            />
          </div>
        </div>

        {address && (
          <p className="text-xs text-gray-500 mt-4 break-all">
            Wallet: <span className="text-gray-400">{address}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default MyProfileContent;
