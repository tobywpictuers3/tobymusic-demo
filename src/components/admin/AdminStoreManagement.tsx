import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/safe-ui/table';
import { Button } from '@/components/safe-ui/button';
import { Input } from '@/components/safe-ui/input';
import { Label } from '@/components/safe-ui/label';
import { Textarea } from '@/components/safe-ui/textarea';
import { Badge } from '@/components/safe-ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/safe-ui/select';
import { ShoppingBag, Plus, Trash2, Image, Upload, Coins, User } from 'lucide-react';
import { 
  getStoreItems, 
  upsertStoreItem, 
  deleteStoreItem, 
  getStudents, 
  getStudentCredits, 
  setStudentCredits,
  addStudentCredits
} from '@/lib/storage';
import { StoreItem, Student } from '@/lib/types';
import { toast } from 'sonner';
import { workerApi } from '@/lib/workerApi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/safe-ui/alert-dialog";

const AdminStoreManagement = () => {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceCredits: 10,
    stock: 1,
    minStreakDays: 0,
    minMinutesInLastNDays: 0,
    windowDays: 7,
    imageUrl: '',
    imagePath: ''
  });

  // Credit management
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setItems(getStoreItems());
    setStudents(getStudents());
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('הקובץ גדול מדי (מקסימום 10MB)');
      return;
    }

    setUploading(true);
    try {
      const result = await workerApi.uploadAttachment(file);
      if (result.success && result.data?.url) {
        setFormData(prev => ({
          ...prev,
          imageUrl: result.data.url,
          imagePath: result.data.path || ''
        }));
        toast.success('התמונה הועלתה בהצלחה');
      } else {
        toast.error('שגיאה בהעלאת התמונה');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('שגיאה בהעלאת התמונה');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('יש להזין שם מוצר');
      return;
    }

    if (formData.priceCredits < 1) {
      toast.error('המחיר חייב להיות לפחות 1 קרדיט');
      return;
    }

    const newItem: Omit<StoreItem, 'id' | 'createdAt' | 'lastModified'> = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      priceCredits: formData.priceCredits,
      stock: formData.stock,
      imageUrl: formData.imageUrl || undefined,
      imagePath: formData.imagePath || undefined,
      isActive: true,
      requirements: (formData.minStreakDays > 0 || formData.minMinutesInLastNDays > 0) 
        ? {
            minStreakDays: formData.minStreakDays || undefined,
            minMinutesInLastNDays: formData.minMinutesInLastNDays || undefined,
            windowDays: formData.windowDays
          }
        : undefined
    };

    upsertStoreItem(newItem as StoreItem);
    toast.success('המוצר נשמר בהצלחה');
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      priceCredits: 10,
      stock: 1,
      minStreakDays: 0,
      minMinutesInLastNDays: 0,
      windowDays: 7,
      imageUrl: '',
      imagePath: ''
    });
    setShowForm(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    await deleteStoreItem(itemToDelete);
    toast.success('המוצר נמחק');
    setDeleteDialogOpen(false);
    setItemToDelete(null);
    loadData();
  };

  const handleAddCredits = () => {
    if (!selectedStudentId || creditAmount === 0) {
      toast.error('יש לבחור תלמידה ולהזין כמות קרדיטים');
      return;
    }

    addStudentCredits(selectedStudentId, creditAmount);
    const student = students.find(s => s.id === selectedStudentId);
    const action = creditAmount > 0 ? 'נוספו' : 'הופחתו';
    toast.success(`${action} ${Math.abs(creditAmount)} קרדיטים ל${student?.firstName}`);
    setCreditAmount(0);
    loadData();
  };

  const getItemImage = (item: StoreItem) => {
    if (item.imageUrl) {
      return (
        <img 
          src={item.imageUrl} 
          alt={item.name}
          className="w-12 h-12 rounded-lg object-cover"
        />
      );
    }
    
    // Default gradient icon with first letter
    const colors = [
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-yellow-500 to-orange-500',
    ];
    const colorIndex = item.name.charCodeAt(0) % colors.length;
    
    return (
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-bold text-xl`}>
        {item.name.charAt(0)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Credit Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            ניהול קרדיטים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>בחרי תלמידה</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחרי תלמידה" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.firstName} {student.lastName} ({getStudentCredits(student.id)} קרדיטים)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label>כמות</Label>
              <Input 
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <Button onClick={handleAddCredits} className="gap-2">
              <Coins className="h-4 w-4" />
              עדכן קרדיטים
            </Button>
          </div>
          
          {/* Quick view of all students credits */}
          <div className="mt-4 flex flex-wrap gap-2">
            {students.map(student => (
              <Badge key={student.id} variant="outline" className="gap-1">
                <User className="h-3 w-3" />
                {student.firstName}: {getStudentCredits(student.id)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Product Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            מוצרים בחנות
          </CardTitle>
          <Button onClick={() => setShowForm(!showForm)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            מוצר חדש
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>שם מוצר *</Label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="שם המוצר"
                  />
                </div>
                <div>
                  <Label>מחיר בקרדיטים *</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={formData.priceCredits}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceCredits: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

              <div>
                <Label>תיאור</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="תיאור המוצר"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>מלאי</Label>
                  <Input 
                    type="number"
                    min={0}
                    value={formData.stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>דרישת רצף (ימים)</Label>
                  <Input 
                    type="number"
                    min={0}
                    value={formData.minStreakDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, minStreakDays: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>דרישת דקות אימון</Label>
                  <Input 
                    type="number"
                    min={0}
                    value={formData.minMinutesInLastNDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, minMinutesInLastNDays: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {(formData.minStreakDays > 0 || formData.minMinutesInLastNDays > 0) && (
                <div className="w-32">
                  <Label>חלון ימים</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={formData.windowDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, windowDays: parseInt(e.target.value) || 7 }))}
                  />
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>תמונת מוצר</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="gap-2"
                    >
                      {uploading ? (
                        <>טוען...</>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          העלה תמונה
                        </>
                      )}
                    </Button>
                    {formData.imageUrl && (
                      <img src={formData.imageUrl} alt="Preview" className="w-10 h-10 rounded object-cover" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowForm(false)}>ביטול</Button>
                <Button onClick={handleSubmit}>שמור מוצר</Button>
              </div>
            </div>
          )}

          {/* Products Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-16">תמונה</TableHead>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">מחיר</TableHead>
                <TableHead className="text-right">מלאי</TableHead>
                <TableHead className="text-right">דרישות</TableHead>
                <TableHead className="text-right w-16">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    אין מוצרים בחנות. הוסיפי מוצר חדש!
                  </TableCell>
                </TableRow>
              ) : (
                items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{getItemImage(item)}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {item.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Coins className="h-3 w-3" />
                        {item.priceCredits}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.stock > 0 ? 'outline' : 'destructive'}>
                        {item.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.requirements ? (
                        <div className="space-y-1">
                          {item.requirements.minStreakDays && (
                            <div>🔥 {item.requirements.minStreakDays} ימים</div>
                          )}
                          {item.requirements.minMinutesInLastNDays && (
                            <div>⏱️ {item.requirements.minMinutesInLastNDays} דק'</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setItemToDelete(item.id);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת מוצר</AlertDialogTitle>
            <AlertDialogDescription>
              האם את בטוחה שברצונך למחוק את המוצר? פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminStoreManagement;
