
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Calendar, MessageSquare } from 'lucide-react';
import { getStudents } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import StudentWeeklySchedule from '@/components/student/StudentWeeklySchedule';
import SwapRequestForm from '@/components/student/SwapRequestForm';
import BackButton from '@/components/ui/back-button';

const StudentsSystem = () => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const students = getStudents();

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    const student = students.find(s => s.id === studentId);
    if (student) {
      toast({
        title: 'נבחרה תלמידה',
        description: `נכנסת לאיזור האישי של ${student.firstName} ${student.lastName}`,
      });
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="min-h-screen musical-gradient">
      <div className="max-h-screen overflow-y-auto">
        <div className="container mx-auto p-4 space-y-6">
          {/* Header */}
          <Card className="card-gradient card-shadow">
            <CardHeader>
              <div className="flex justify-between items-center">
                <BackButton to="/" label="חזור לדף הבית" />
                <h1 className="text-3xl font-bold text-primary crown-glow">
                  איזור התלמידות - מערכת שיעורי נגינה
                </h1>
                <div className="w-32"></div> {/* Spacer for alignment */}
              </div>
            </CardHeader>
          </Card>

          {/* Student Selection */}
          <Card className="card-gradient card-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                בחירת תלמידה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md">
                <Select value={selectedStudentId} onValueChange={handleStudentSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחרי את שמך מהרשימה" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Student Content */}
          {selectedStudent && (
            <Tabs defaultValue="schedule" className="space-y-6">
              <Card className="card-gradient card-shadow">
                <CardContent className="pt-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="schedule" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      המערכת שלי
                    </TabsTrigger>
                    <TabsTrigger value="swap" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      בקשת החלפה
                    </TabsTrigger>
                  </TabsList>
                </CardContent>
              </Card>

              <TabsContent value="schedule">
                <StudentWeeklySchedule studentId={selectedStudentId} />
              </TabsContent>

              <TabsContent value="swap">
                <SwapRequestForm studentId={selectedStudentId} />
              </TabsContent>
            </Tabs>
          )}

          {!selectedStudent && (
            <Card className="card-gradient card-shadow">
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                  בחרי את שמך כדי לגשת לאיזור האישי שלך
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentsSystem;
