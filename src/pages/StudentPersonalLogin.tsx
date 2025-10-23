
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, ArrowRight } from 'lucide-react';
import { getStudents, setCurrentUser } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';

const StudentPersonalLogin = () => {
  const [personalCode, setPersonalCode] = useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    if (!personalCode.trim()) {
      toast({
        title: 'שגיאה',
        description: 'אנא הקישי את הקוד האישי שלך',
        variant: 'destructive',
      });
      return;
    }

    const students = getStudents();
    console.log('All students:', students.map(s => ({ 
      name: `${s.firstName} ${s.lastName}`, 
      personalCode: s.personalCode,
      phone: s.phone 
    })));
    console.log('Looking for personalCode:', personalCode.trim());
    
    // Try to find by personalCode first
    let student = students.find(s => s.personalCode === personalCode.trim());
    
    // Fallback: if personalCode is empty or not found, try phone (backward compatibility)
    if (!student) {
      student = students.find(s => s.phone === personalCode.trim());
      if (student) {
        console.log('Found student by phone (backward compatibility)');
      }
    }
    
    if (student) {
      setCurrentUser({ type: 'student', studentId: student.id });
      navigate(`/student/${student.id}`);
      toast({
        title: 'ברוכה הבאה לאזור האישי!',
        description: `שלום ${student.firstName} ${student.lastName}`,
      });
    } else {
      toast({
        title: 'שגיאה',
        description: 'קוד אישי שגוי. אנא פני למנהלת לקבלת הקוד הנכון',
        variant: 'destructive',
      });
    }
  };

  const handleBackToStudentsView = () => {
    navigate('/students-view');
  };

  return (
    <div className="min-h-screen musical-gradient flex items-center justify-center">
      <div className="container mx-auto p-4 max-w-md">
        <Card className="card-gradient card-shadow">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <User className="h-6 w-6" />
              כניסה לאזור האישי
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="personalCode" className="text-base font-medium">
                  קוד אישי
                </Label>
                <Input
                  id="personalCode"
                  type="text"
                  value={personalCode}
                  onChange={(e) => setPersonalCode(e.target.value)}
                  placeholder="הקישי את הקוד האישי שלך"
                  className="mt-2 text-center text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <Button 
                onClick={handleLogin}
                className="w-full hero-gradient hover:scale-105 transition-musical"
                size="lg"
              >
                כניסה לאזור האישי
                <ArrowRight className="h-4 w-4 mr-2" />
              </Button>

              <Button 
                onClick={handleBackToStudentsView}
                variant="outline"
                className="w-full"
              >
                חזרה למערכת השיעורים
              </Button>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                הקוד האישי שלך ניתן על ידי המנהלת.
                <br />
                אם אינך זוכרת את הקוד, אנא פני אליה.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentPersonalLogin;
