"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { WorkoutDay } from "@/lib/types";

// Lazy-load the modal so it doesn't inflate the today page bundle
const DeloadSetupModal = dynamic(() => import("@/components/DeloadSetupModal"), { ssr: false });

type Props = {
  programId: string;
  allDays: WorkoutDay[];
  /** The scheduled day id for today (if any). Falls back to first day. */
  primaryDayId: string | null;
  small?: boolean;
};

export default function EasyWeekButton({ programId, allDays, primaryDayId, small }: Props) {
  const [showModal, setShowModal] = useState(false);

  // Require at least one day and a valid primaryDayId
  const effectivePrimaryId = primaryDayId ?? allDays[0]?.id;
  if (!effectivePrimaryId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={
          small
            ? "mt-1.5 w-full py-1.5 rounded-lg border border-amber-500/40 text-amber-400 text-xs font-semibold active:bg-amber-500/10"
            : "w-full py-3.5 rounded-xl border border-amber-500/40 text-amber-400 text-sm font-semibold active:bg-amber-500/10"
        }
      >
        🔄 Easy Week
      </button>

      {showModal && (
        <DeloadSetupModal
          programId={programId}
          allDays={allDays}
          primaryDayId={effectivePrimaryId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
