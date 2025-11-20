import { Lesson } from "@/lib/types";

interface Props {
  lessons: Lesson[];
  onLessonClick?: (lesson: Lesson) => void;
}

export default function StudentWeeklySchedule({ lessons, onLessonClick }: Props) {
  const sorted = [...lessons].sort((a, b) => (a.date > b.date ? 1 : -1));

  return (
    <div className="p-4 bg-white border rounded-lg shadow mt-4">
      <h2 className="text-lg font-bold mb-4">השיעורים שלך</h2>

      <div className="grid grid-cols-1 gap-3">
        {sorted.map((lesson) => (
          <div
            key={lesson.id}
            className="p-3 border rounded cursor-pointer hover:bg-blue-50"
            onClick={() => onLessonClick?.(lesson)}
          >
            <div className="font-semibold">{lesson.date} – {lesson.time}</div>
            <div className="text-sm text-gray-600">
              {lesson.studentName} • {lesson.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
