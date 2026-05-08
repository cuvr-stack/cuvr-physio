import type { Exercise } from '@physio-vr/shared-types';
import { NavBar } from '@/components/NavBar';

async function getExercises(): Promise<Exercise[]> {
  try {
    const res = await fetch(
      `${process.env.API_URL ?? 'http://localhost:3001'}/api/exercises`,
      { cache: 'no-store' }
    );
    return res.json();
  } catch {
    return [];
  }
}

export default async function ExercisesPage() {
  const exercises = await getExercises();

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar crumbs={[{ label: 'Exercise Library' }]} />
    <main className="max-w-5xl mx-auto px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Exercise Library</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exercises.map((ex) => (
          <div key={ex.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex justify-between items-start mb-2">
              <h2 className="font-semibold">{ex.name}</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                {ex.category}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-3">{ex.description}</p>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>{ex.targetReps} reps × {ex.targetSets} sets</span>
              <span>Target ROM: {ex.targetROM}°</span>
              <span>Difficulty: {'★'.repeat(ex.difficulty)}</span>
            </div>
          </div>
        ))}
      </div>
    </main>
    </div>
  );
}
