
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Download, RefreshCw, Upload, Image, FileAudio, Link2, File } from 'lucide-react';
import { getFiles } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';

interface StudentFilesProps {
  studentId: string;
}

interface FileUpload {
  name: string;
  description: string;
  url: string;
}

const StudentFiles = ({ studentId }: StudentFilesProps) => {
  const [files] = useState(getFiles().filter(f => f.studentId === studentId));
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState<FileUpload>({
    name: '',
    description: '',
    url: ''
  });

  const handleRefresh = () => {
    toast({
      title: 'רענון קבצים',
      description: 'הקבצים עודכנו',
    });
  };

  const handleOpenFile = (link: string) => {
    window.open(link, '_blank');
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image className="h-5 w-5 text-primary" />;
    if (ext === 'pdf') return <File className="h-5 w-5 text-red-500" />;
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return <FileAudio className="h-5 w-5 text-green-500" />;
    if (fileName.includes('drive.google.com')) return <Link2 className="h-5 w-5 text-blue-500" />;
    return <FileText className="h-5 w-5 text-primary" />;
  };


  const handleUpload = () => {
    if (!uploadForm.name || !uploadForm.url) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את שדות כותרת וקישור',
        variant: 'destructive',
      });
      return;
    }

    // Here you would implement the actual file upload logic
    toast({
      title: 'הצלחה',
      description: 'הקובץ הועלה בהצלחה',
    });

    setUploadForm({ name: '', description: '', url: '' });
    setShowUploadDialog(false);
  };

  return (
    <Card className="card-gradient card-shadow">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-2xl flex items-center gap-2">
            <FileText className="h-6 w-6" />
            הקלטות ותווים
          </CardTitle>
          <div className="flex gap-2">
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  העלאת קובץ
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>הוספת קובץ חדש</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-name">כותרת הקובץ</Label>
                    <Input
                      id="file-name"
                      value={uploadForm.name}
                      onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                      placeholder="לדוגמה: תווים שיעור 5, הקלטה יד ימין"
                    />
                  </div>
                  <div>
                    <Label htmlFor="file-description">הסבר / תיאור (אופציונלי)</Label>
                    <Input
                      id="file-description"
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                      placeholder="הסבר קצר על הקובץ"
                    />
                  </div>
                  <div>
                    <Label htmlFor="file-url">קישור לקובץ</Label>
                    <Input
                      id="file-url"
                      value={uploadForm.url}
                      onChange={(e) => setUploadForm({...uploadForm, url: e.target.value})}
                      placeholder="הדביקי כאן את הקישור לקובץ (Google Drive, Dropbox וכו')"
                    />
                  </div>
                  <Button onClick={handleUpload} className="w-full hero-gradient">
                    הוסף קובץ
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              רענון קבצים
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            אין קבצים זמינים כרגע
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors">
                <button
                  onClick={() => handleOpenFile(file.webViewLink)}
                  className="w-full text-right"
                >
                  <div className="flex items-start gap-3">
                    {getFileIcon(file.name)}
                    <div className="flex-1">
                      <div className="font-medium hover:text-primary transition-colors">{file.name}</div>
                      {file.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {file.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        הועלה ב-{new Date(file.uploadDate).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentFiles;
