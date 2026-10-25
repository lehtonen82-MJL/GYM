"use client";

import type { EquipmentOption } from "@/lib/actions";

type Props = {
  currentEquipment: string | null | undefined;
  options: EquipmentOption[];
  onChange: (option: EquipmentOption) => void;
  disabled?: boolean;
};

export default function EquipmentToggle({ currentEquipment, options, onChange, disabled }: Props) {
  if (options.length === 0) return null;

  // An untagged entry was performed with the definition's default tool
  const value = currentEquipment ?? options.find((o) => o.is_default)?.equipment_type ?? "";

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const opt = options.find((o) => o.equipment_type === e.target.value);
        if (opt) onChange(opt);
      }}
      className="bg-surface text-white text-xs font-semibold rounded-lg px-2 py-1.5 border border-border-strong focus:outline-none focus:border-accent disabled:opacity-50 max-w-[140px]"
    >
      {options.map((opt) => (
        <option key={opt.equipment_type} value={opt.equipment_type}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
