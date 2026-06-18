"use client";

import React, { useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Wrench,
  Sparkles,
  HeartPulse,
  Dumbbell,
  Car,
  Home,
  PawPrint,
  Briefcase,
  GraduationCap,
  Laptop,
  UtensilsCrossed,
  Store,
  LucideIcon,
} from "lucide-react";
import { SERVICE_CATEGORIES } from "@/services/api/services";

interface TrustedProfessionalsCardProps {
  onSelectCategory?: (category: string) => void;
  onSeeMore?: () => void;
}

const CATEGORY_META: Record<string, { icon: LucideIcon; gradient: string }> = {
  repairs: { icon: Wrench, gradient: "from-amber-500/30 to-amber-700/30" },
  beauty_personal_care: { icon: Sparkles, gradient: "from-pink-500/30 to-rose-700/30" },
  health_wellness: { icon: HeartPulse, gradient: "from-emerald-500/30 to-teal-700/30" },
  fitness_gyms: { icon: Dumbbell, gradient: "from-orange-500/30 to-red-700/30" },
  automotive_services: { icon: Car, gradient: "from-blue-500/30 to-indigo-700/30" },
  home_cleaning_services: { icon: Home, gradient: "from-cyan-500/30 to-sky-700/30" },
  pets_animal_care: { icon: PawPrint, gradient: "from-yellow-500/30 to-amber-700/30" },
  professional_services: { icon: Briefcase, gradient: "from-slate-500/30 to-gray-700/30" },
  education_classes: { icon: GraduationCap, gradient: "from-violet-500/30 to-purple-700/30" },
  tech_it_services: { icon: Laptop, gradient: "from-fuchsia-500/30 to-pink-700/30" },
  food_beverage: { icon: UtensilsCrossed, gradient: "from-lime-500/30 to-green-700/30" },
  other_local_services: { icon: Store, gradient: "from-stone-500/30 to-neutral-700/30" },
};

export const TrustedProfessionalsCard: React.FC<TrustedProfessionalsCardProps> = ({
  onSelectCategory,
  onSeeMore,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div className="relative rounded-xl bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Trusted Professionals in Every Service
        </h3>
        <button
          onClick={onSeeMore}
          className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          See more
        </button>
      </div>

      <button
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
        className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white p-1.5 text-gray-600 shadow-md transition-colors hover:bg-gray-50 sm:flex"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
        className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white p-1.5 text-gray-600 shadow-md transition-colors hover:bg-gray-50 sm:flex"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SERVICE_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat.value] ?? { icon: Store, gradient: "from-gray-500/30 to-gray-700/30" };
          const Icon = meta.icon;
          return (
            <button
              key={cat.value}
              onClick={() => onSelectCategory?.(cat.value)}
              className="group flex w-28 flex-shrink-0 flex-col items-center text-center"
            >
              <div
                className={`flex h-32 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${meta.gradient}`}
              >
                <Icon className="h-10 w-10 text-gray-700 transition-transform duration-200 group-hover:scale-110" />
              </div>
              <span className="mt-2 text-xs font-medium text-gray-700 group-hover:text-gray-900">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TrustedProfessionalsCard;
