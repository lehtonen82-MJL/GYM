import { getWorkoutHistory } from "@/lib/actions";
import HistoryList from "./HistoryList";

export default async function HistoryPage() {
  const workouts = await getWorkoutHistory();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">History</h1>

      {workouts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-muted text-center">No workouts yet. Start one from Today!</p>
        </div>
      ) : (
        <HistoryList workouts={workouts} />
      )}
    </div>
  );
}
