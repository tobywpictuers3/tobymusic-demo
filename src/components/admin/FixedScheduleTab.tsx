import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Button } from '@/components/safe-ui/button';
import { Input } from '@/components/safe-ui/input';
import { Label } from '@/components/safe-ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/safe-ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/safe-ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/safe-ui/table';
import { Calendar, Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { getStudents, getScheduleTemplates, addScheduleTemplate, updateScheduleTemplate, deleteScheduleTemplate, activateScheduleTemplate } from '@/lib/storage';
import { Student, ScheduleTemplate, WeeklyScheduleData } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

const FixedScheduleTab = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleData, setScheduleData] = useState<WeeklyScheduleData>({});

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setStudents(getStudents());
    setTemplates(getScheduleTemplates().sort((a, b) => 
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    ));
  };

  const handleOpenDialog = (template?: ScheduleTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateName(template.name);
      setEffectiveDate(template.effectiveDate);
      setScheduleData(template.schedule);
    } else {
      setEditingTemplate(null);
      setTemplateName('');
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setScheduleData({});
    }
    setShowDialog(true);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם למערכת',
        variant: 'destructive'
      });
      return;
    }

    if (editingTemplate) {
      updateScheduleTemplate(editingTemplate.id, {
        name: templateName,
        effectiveDate,
        schedule: scheduleData
      });
      toast({ description: 'המערכת עודכנה בהצלחה' });
    } else {
      addScheduleTemplate({
        name: templateName,
        effectiveDate,
        isActive: false,
        schedule: scheduleData
      });
      toast({ description: 'המערכת נוספה בהצלחה' });
    }

    loadData();
    setShowDialog(false);
  };

  const handleActivateTemplate = (templateId: string) => {
    activateScheduleTemplate(templateId);
    toast({ description: 'המערכת הופעלה בהצלחה' });
    loadData();
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm('האם את בטוחה שברצונך למחוק את המערכת?')) {
      deleteScheduleTemplate(templateId);
      toast({ description: 'המערכת נמחקה בהצלחה' });
      loadData();
    }
  };

  const addLessonToSchedule = (dayOfWeek: number, studentId: string, startTime: string) => {
    const newSchedule = { ...scheduleData };
    const dayKey = dayOfWeek.toString();
    
    if (!newSchedule[dayKey]) {
      newSchedule[dayKey] = {};
    }
    
    newSchedule[dayKey][startTime] = {
      studentId,
      duration: 30
    };
    
    setScheduleData(newSchedule);
  };

  const removeLessonFromSchedule = (dayOfWeek: number, startTime: string) => {
    const newSchedule = { ...scheduleData };
    const dayKey = dayOfWeek.toString();
    
    if (newSchedule[dayKey] && newSchedule[dayKey][startTime]) {
      delete newSchedule[dayKey][startTime];
      if (Object.keys(newSchedule[dayKey]).length === 0) {
        delete newSchedule[dayKey];
      }
    }
    
    setScheduleData(newSchedule);
  };

  const getNextAvailableTime = (dayOfWeek: number): string => {
    const dayKey = dayOfWeek.toString();
    const daySchedule = scheduleData[dayKey] || {};
    const times = Object.keys(daySchedule).sort();
    
    if (times.length === 0) {
      return '16:00';
    }
    
    const lastTime = times[times.length - 1];
    const [hours, minutes] = lastTime.split(':').map(Number);
    const nextMinutes = minutes + 30;
    
    if (nextMinutes >= 60) {
      return `${String(hours + 1).padStart(2, '0')}:${String(nextMinutes - 60).padStart(2, '0')}`;
    }
    
    return `${String(hours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
  };

  const getLessonsForDay = (dayOfWeek: number) => {
    const dayKey = dayOfWeek.toString();
    const daySchedule = scheduleData[dayKey] || {};
    
    return Object.entries(daySchedule)
      .map(([time, data]) => ({
        time,
        studentId: data.studentId,
        student: students.find(s => s.id === data.studentId)
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  return (
    <div className="space-y-6">
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              מערכות קבועות
            </CardTitle>
            <Button onClick={() => handleOpenDialog()} className="hero-gradient">
              <Plus className="h-4 w-4 mr-2" />
              הוספת מערכת חדשה
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם המערכת</TableHead>
                <TableHead>תאריך תחילת תוקף</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך יצירה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(template => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{new Date(template.effectiveDate).toLocaleDateString('he-IL')}</TableCell>
                  <TableCell>
                    {template.isActive ? (
                      <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                        <Check className="h-4 w-4" />
                        פעילה
                      </span>
                    ) : (
                      <span className="text-muted-foreground">לא פעילה</span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(template.createdAt).toLocaleDateString('he-IL')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {!template.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivateTemplate(template.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          הפעל
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {templates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              אין מערכות קבועות. לחצי על "הוספת מערכת חדשה" כדי להתחיל.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Add/Edit Template */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'עריכת מערכת קבועה' : 'הוספת מערכת קבועה חדשה'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Template Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="templateName">שם המערכת *</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="לדוגמה: מערכת חורף 2024"
                />
              </div>
              <div>
                <Label htmlFor="effectiveDate">תאריך תחילת תוקף *</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
            </div>

            {/* Weekly Schedule Editor */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">מערכת שבועית</h3>
              
              {dayNames.map((dayName, dayIndex) => (
                <Card key={dayIndex}>
                  <CardHeader>
                    <CardTitle className="text-base">{dayName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Existing Lessons */}
                      {getLessonsForDay(dayIndex).map((lesson) => (
                        <div key={lesson.time} className="flex items-center gap-4 p-3 bg-secondary/20 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{lesson.time}</div>
                            <div className="text-sm text-muted-foreground">
                              {lesson.student ? `${lesson.student.firstName} ${lesson.student.lastName}` : 'תלמידה לא נמצאה'}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeLessonFromSchedule(dayIndex, lesson.time)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                      {/* Add New Lesson */}
                      <AddLessonForm
                        dayOfWeek={dayIndex}
                        students={students}
                        suggestedTime={getNextAvailableTime(dayIndex)}
                        onAdd={addLessonToSchedule}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                ביטול
              </Button>
              <Button onClick={handleSaveTemplate} className="hero-gradient">
                {editingTemplate ? 'עדכן מערכת' : 'שמור מערכת'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Component for adding a lesson
const AddLessonForm = ({ 
  dayOfWeek, 
  students, 
  suggestedTime, 
  onAdd 
}: { 
  dayOfWeek: number; 
  students: Student[]; 
  suggestedTime: string;
  onAdd: (dayOfWeek: number, studentId: string, time: string) => void;
}) => {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [lessonTime, setLessonTime] = useState(suggestedTime);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setLessonTime(suggestedTime);
  }, [suggestedTime]);

  const handleAdd = () => {
    if (!selectedStudent || !lessonTime) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור תלמידה ושעה',
        variant: 'destructive'
      });
      return;
    }

    onAdd(dayOfWeek, selectedStudent, lessonTime);
    setSelectedStudent('');
    setLessonTime(suggestedTime);
    setIsAdding(false);
    toast({ description: 'השיעור נוסף למערכת' });
  };

  if (!isAdding) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsAdding(true)}
        className="w-full"
      >
        <Plus className="h-3 w-3 mr-2" />
        הוסף שיעור
      </Button>
    );
  }

  return (
    <div className="flex items-end gap-2 p-3 bg-muted/50 rounded-lg">
      <div className="flex-1">
        <Label className="text-xs">תלמידה</Label>
        <Select value={selectedStudent} onValueChange={setSelectedStudent}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="בחרי תלמידה" />
          </SelectTrigger>
          <SelectContent>
            {students.map(student => (
              <SelectItem key={student.id} value={student.id}>
                {student.firstName} {student.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-32">
        <Label className="text-xs">שעה</Label>
        <Input
          type="time"
          value={lessonTime}
          onChange={(e) => setLessonTime(e.target.value)}
          className="h-9"
        />
      </div>
      <Button size="sm" onClick={handleAdd} className="hero-gradient">
        <Check className="h-3 w-3" />
      </Button>
      <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default FixedScheduleTab;
