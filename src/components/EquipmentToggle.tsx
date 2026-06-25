"use client";

import type { EquipmentOption } from "@/lib/actions";

type Props = {
  currentEquipment: string | null | undefined;
  options: EquipmentOption[];
  onChange: (option: EquipmentOption) => void;
  disabled?: boolean;
};

export default function EquipmentToggle({ currentEquipment, options, onChange, disabled }: Props) {
  if (options.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {options.map((opt) => {
        const isActive = opt.equipment_type === currentEquipment;
        return (
          <button
            key={opt.equipment_type}
            type="button"
            disabled={disabled || isActive}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
              isActive
                ? "bg-accent text-white"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700 active:bg-zinc-700 active:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
