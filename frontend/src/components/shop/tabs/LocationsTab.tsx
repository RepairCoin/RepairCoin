"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { MapPin, Plus, Trash2, Pencil, Star, X, Building2, Lock } from "lucide-react";
import {
  getLocations,
  createLocation,
  updateLocation,
  setPrimaryLocation,
  deleteLocation,
  type ShopLocation,
  type LocationInput,
} from "@/services/api/locations";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { TIER_LABELS } from "@/config/featureTiers";
import { LocationPickerWrapper } from "../../maps/LocationPickerWrapper";

interface LocationsTabProps {
  shopId: string;
}

export function LocationsTab({ shopId }: LocationsTabProps) {
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ShopLocation | null>(null);
  const { can } = useFeatureAccess();
  const canManageMultiple = can("multiLocation");

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getLocations();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading locations:", error);
      if (!silent) toast.error("Failed to load locations");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const sortPrimaryFirst = (ls: ShopLocation[]) =>
    [...ls].sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));

  const handleSetPrimary = async (location: ShopLocation) => {
    if (location.isPrimary) return;
    const previous = locations;
    setLocations((ls) => sortPrimaryFirst(ls.map((l) => ({ ...l, isPrimary: l.id === location.id }))));
    try {
      await setPrimaryLocation(location.id);
      toast.success(`${location.name} is now the primary location`);
      loadLocations(true);
    } catch (error: any) {
      setLocations(previous);
      toast.error(error?.message || "Failed to set primary location");
    }
  };

  const handleDelete = async (location: ShopLocation) => {
    if (!confirm(`Delete ${location.name}? This cannot be undone.`)) return;
    try {
      await deleteLocation(location.id);
      toast.success("Location deleted");
      loadLocations(true);
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete location");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (location: ShopLocation) => {
    setEditing(location);
    setShowModal(true);
  };

  const formatAddress = (l: ShopLocation) => {
    const parts = [l.address, l.city, l.state, l.zipCode].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#303236] pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#FFCC00]" /> Locations
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {canManageMultiple
                ? "Manage your business locations. One location is marked as primary."
                : `Edit your shop location below. Add more locations on the ${TIER_LABELS.business} plan.`}
            </p>
          </div>
          {canManageMultiple ? (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] transition-colors"
            >
              <Plus className="w-5 h-5" /> Add location
            </button>
          ) : (
            <a
              href="/shop?tab=settings"
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-[#303236] text-gray-300 hover:bg-[#303236] transition-colors"
              title={`Available on the ${TIER_LABELS.business} plan`}
            >
              <Lock className="w-4 h-4" /> Add location
            </a>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto" />
            <p className="mt-4 text-gray-400">Loading locations...</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-12 bg-[#101010] rounded-lg">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No locations yet</h3>
            <p className="text-gray-400">Your shop location will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#303236]">
            <table className="w-full text-left">
              <thead className="bg-[#1e1f22] text-gray-400 text-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303236]">
                {locations.map((l) => (
                  <tr key={l.id} className="text-white">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium flex items-center gap-2">
                        {l.name}
                        {l.isPrimary && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#FFCC00] text-black">
                            <Star className="w-3 h-3" /> Primary
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate" title={formatAddress(l)}>
                      {formatAddress(l)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{l.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          l.active ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-300"
                        }`}
                      >
                        {l.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canManageMultiple && !l.isPrimary && (
                          <button
                            onClick={() => handleSetPrimary(l)}
                            className="p-1.5 rounded hover:bg-[#303236] text-[#FFCC00]"
                            title="Set as primary"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(l)}
                          className="p-1.5 rounded hover:bg-[#303236] text-gray-300"
                          title="Edit location"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {canManageMultiple && !l.isPrimary && (
                          <button
                            onClick={() => handleDelete(l)}
                            className="p-1.5 rounded hover:bg-[#303236] text-red-300"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <LocationModal
          location={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            loadLocations(true);
          }}
        />
      )}
    </>
  );
}

interface LocationModalProps {
  location: ShopLocation | null;
  onClose: () => void;
  onSaved: () => void;
}

function LocationModal({ location, onClose, onSaved }: LocationModalProps) {
  const isEdit = !!location;
  const [form, setForm] = useState<LocationInput>({
    name: location?.name || "",
    address: location?.address || "",
    city: location?.city || "",
    state: location?.state || "",
    zipCode: location?.zipCode || "",
    phone: location?.phone || "",
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    active: location?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof LocationInput, value: string | boolean | number | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleMapSelect = (loc: { latitude: number; longitude: number; address?: string }) => {
    setForm((prev) => ({
      ...prev,
      lat: loc.latitude,
      lng: loc.longitude,
      ...(loc.address ? { address: loc.address } : {}),
    }));
    toast.success(loc.address ? "Location pinpointed — address updated" : "Coordinates updated");
  };

  const handleSubmit = async () => {
    if (!form.name || !form.name.trim()) {
      toast.error("Location name is required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateLocation(location!.id, form);
        toast.success("Location updated");
      } else {
        await createLocation(form);
        toast.success("Location added");
      }
      onSaved();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white focus:border-[#FFCC00] outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1a1b1e] border border-[#303236] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#303236]">
          <h3 className="text-lg font-bold text-white">{isEdit ? "Edit location" : "Add location"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Downtown branch"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Address</label>
            <input
              type="text"
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              placeholder="123 Main St"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">City</label>
              <input
                type="text"
                value={form.city ?? ""}
                onChange={(e) => set("city", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">State</label>
              <input
                type="text"
                value={form.state ?? ""}
                onChange={(e) => set("state", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">ZIP code</label>
              <input
                type="text"
                value={form.zipCode ?? ""}
                onChange={(e) => set("zipCode", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Pin on map</label>
            <LocationPickerWrapper
              initialLocation={
                form.lat != null && form.lng != null
                  ? { latitude: form.lat, longitude: form.lng, address: form.address ?? undefined }
                  : undefined
              }
              onLocationSelect={handleMapSelect}
              height="400px"
            />
            {form.lat != null && form.lng != null && (
              <p className="text-xs text-gray-500 mt-2">
                Coordinates: {form.lat.toFixed(6)}, {form.lng.toFixed(6)}
              </p>
            )}
          </div>

          <label className={`flex items-center gap-2 text-sm text-gray-300 ${location?.isPrimary ? "opacity-60" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={location?.isPrimary ? true : form.active ?? true}
              disabled={location?.isPrimary}
              onChange={(e) => set("active", e.target.checked)}
              className="accent-[#FFCC00]"
            />
            Active
            {location?.isPrimary && (
              <span className="text-xs text-gray-500">(primary location is always active)</span>
            )}
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#303236]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-[#303236] text-gray-300 hover:bg-[#303236]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add location"}
          </button>
        </div>
      </div>
    </div>
  );
}
