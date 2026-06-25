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

  return (
    <select
      value={currentEquipment ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const opt = options.find((o) => o.equipment_type === e.target.value);
        if (opt) onChange(opt);
      }}
      className="bg-zinc-800 text-white text-xs font-semibold rounded-lg px-2 py-1.5 border border-zinc-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 max-w-[140px]"
    >
      {options.map((opt) => (
        <option key={opt.equipment_type} value={opt.equipment_type}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
