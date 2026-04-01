import { getExerciseList } from "@/lib/actions";
import ProgressClient from "./ProgressClient";

export default async function ProgressPage() {
  const exercises = await getExerciseList();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Progress</h1>
      <ProgressClient exercises={exercises} />
    </div>
  );
}
