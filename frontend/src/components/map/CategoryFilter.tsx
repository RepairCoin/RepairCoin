"use client";

const CATEGORY_LABELS: Record<string, string> = {
  repairs: "Repairs",
  beauty_personal_care: "Beauty & Care",
  health_wellness: "Health & Wellness",
  fitness_gyms: "Fitness & Gyms",
  automotive_services: "Automotive",
  home_cleaning_services: "Home & Cleaning",
  pets_animal_care: "Pets & Animals",
  professional_services: "Professional",
  education_classes: "Education",
  tech_it_services: "Tech & IT",
  food_beverage: "Food & Beverage",
  other_local_services: "Other",
};

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
          !selected
            ? "bg-[#FFCC00] text-black"
            : "bg-[#1a1a1a] text-gray-400 border border-gray-800 hover:border-gray-600"
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category === selected ? null : category)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            selected === category
              ? "bg-[#FFCC00] text-black"
              : "bg-[#1a1a1a] text-gray-400 border border-gray-800 hover:border-gray-600"
          }`}
        >
          {CATEGORY_LABELS[category] || category.replace(/_/g, " ")}
        </button>
      ))}
    </div>
  );
}
