"use client";

import { useEasyWeekMode } from "./useEasyWeekMode";

type Props = {
  programId: string;
};

export default function EasyWeekButton({ programId }: Props) {
  const { active, toggle } = useEasyWeekMode(programId);

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        active
          ? "w-full py-3.5 rounded-xl bg-amber-500/20 border border-amber-500 text-amber-300 text-sm font-semibold active:bg-amber-500/30"
          : "w-full py-3.5 rounded-xl border border-amber-500/40 text-amber-400 text-sm font-semibold active:bg-amber-500/10"
      }
    >
      {active ? "🔄 Easy Week ON · tap to cancel" : "🔄 Easy Week"}
    </button>
  );
}
