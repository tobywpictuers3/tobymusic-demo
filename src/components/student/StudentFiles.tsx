
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
  type: 'image' | 'pdf' | 'audio' | 'drive_link';
  name: string;
  url: string;
}

const StudentFiles = ({ studentId }: StudentFilesProps) => {
  const [files] = useState(getFiles().filter(f => f.studentId === studentId));
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState<FileUpload>({
    type: 'image',
    name: '',
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

  const getFileTypeLabel = (type: FileUpload['type']) => {
    const labels = {
      image: 'תמונה',
      pdf: 'PDF',
      audio: 'קובץ שמע',
      drive_link: 'קישור לדרייב'
    };
    return labels[type];
  };

  const handleUpload = () => {
    if (!uploadForm.name || !uploadForm.url) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות',
        variant: 'destructive',
      });
      return;
    }

    // Here you would implement the actual file upload logic
    toast({
      title: 'הצלחה',
      description: 'הקובץ הועלה בהצלחה',
    });

    setUploadForm({ type: 'image', name: '', url: '' });
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
                  <DialogTitle>העלאת קובץ חדש</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-type">סוג קובץ</Label>
                    <Select 
                      value={uploadForm.type} 
                      onValueChange={(value: FileUpload['type']) => setUploadForm({...uploadForm, type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">תמונה</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="audio">קובץ שמע</SelectItem>
                        <SelectItem value="drive_link">קישור לדרייב</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="file-name">שם הקובץ</Label>
                    <Input
                      id="file-name"
                      value={uploadForm.name}
                      onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                      placeholder="הכנסי שם לקובץ"
                    />
                  </div>
                  <div>
                    <Label htmlFor="file-url">
                      {uploadForm.type === 'drive_link' ? 'קישור' : 'כתובת הקובץ'}
                    </Label>
                    <Input
                      id="file-url"
                      value={uploadForm.url}
                      onChange={(e) => setUploadForm({...uploadForm, url: e.target.value})}
                      placeholder={uploadForm.type === 'drive_link' ? 'הדביקי כאן את הקישור מהדרייב' : 'כתובת הקובץ'}
                    />
                  </div>
                  <Button onClick={handleUpload} className="w-full hero-gradient">
                    העלה קובץ
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
              <div key={file.id} className="flex justify-between items-center p-4 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  {getFileIcon(file.name)}
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-muted-foreground">
                      הועלה ב-{new Date(file.uploadDate).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => handleOpenFile(file.webViewLink)}
                  size="sm"
                  className="hero-gradient"
                >
                  <Download className="h-3 w-3 mr-1" />
                  פתח
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentFiles;
