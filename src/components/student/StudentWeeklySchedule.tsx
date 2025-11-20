import { Lesson } from "@/lib/types";
import { getStudents } from "@/lib/storage";

interface Props {
  lessons: Lesson[];
  onLessonClick?: (lesson: Lesson) => void;
}

export default function StudentWeeklySchedule({ lessons, onLessonClick }: Props) {
  const students = getStudents();
  const sorted = [...lessons].sort((a, b) => (a.date > b.date ? 1 : -1));

  return (
    <div className="p-4 bg-card border rounded-lg shadow mt-4">
      <h2 className="text-lg font-bold mb-4 text-foreground">השיעורים שלך</h2>

      <div className="grid grid-cols-1 gap-3">
        {sorted.map((lesson) => {
          const student = students.find(s => s.id === lesson.studentId);
          const studentName = student ? `${student.firstName} ${student.lastName}` : 'לא ידוע';
          
          return (
            <div
              key={lesson.id}
              className="p-3 border rounded cursor-pointer hover:bg-accent/10 bg-card text-card-foreground"
              onClick={() => onLessonClick?.(lesson)}
            >
              <div className="font-semibold">{lesson.date} – {lesson.startTime}</div>
              <div className="text-sm text-muted-foreground">
                {studentName} • {lesson.status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
