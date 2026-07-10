"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { getLocations, type ShopLocation } from "@/services/api/locations";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useLocationStore } from "@/stores/locationStore";

export function LocationSwitcher() {
  const { multiLocationActive } = useFeatureAccess();
  const { activeLocationId, setActiveLocation } = useLocationStore();
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!multiLocationActive) return;
    getLocations()
      .then((l) => setLocations(Array.isArray(l) ? l : []))
      .catch(() => setLocations([]));
  }, [multiLocationActive]);

  // Drop a stale selection (e.g. the active location was deleted) back to "All locations".
  useEffect(() => {
    if (activeLocationId && locations.length && !locations.some((l) => l.id === activeLocationId)) {
      setActiveLocation(null);
    }
  }, [locations, activeLocationId, setActiveLocation]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!multiLocationActive || locations.length < 2) return null;

  const active = locations.find((l) => l.id === activeLocationId);
  const label = active ? active.name : "All locations";

  const choose = (id: string | null) => {
    setActiveLocation(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#1a1b1e] border border-[#303236] text-white text-sm hover:border-[#FFCC00] transition-colors"
      >
        <MapPin className="w-4 h-4 text-[#FFCC00]" />
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 z-50 rounded-md bg-[#1a1b1e] border border-[#303236] shadow-lg py-1">
          <OptionRow label="All locations" selected={!activeLocationId} onClick={() => choose(null)} />
          <div className="border-t border-[#303236] my-1" />
          {locations.map((l) => (
            <OptionRow
              key={l.id}
              label={l.isPrimary ? `${l.name} (Primary)` : l.name}
              selected={activeLocationId === l.id}
              onClick={() => choose(l.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#303236]"
    >
      <span className="truncate">{label}</span>
      {selected && <Check className="w-4 h-4 text-[#FFCC00] shrink-0" />}
    </button>
  );
}
