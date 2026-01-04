import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/safe-ui/table';
import { Button } from '@/components/safe-ui/button';
import { Input } from '@/components/safe-ui/input';
import { Label } from '@/components/safe-ui/label';
import { Textarea } from '@/components/safe-ui/textarea';
import { Badge } from '@/components/safe-ui/badge';
import { ShoppingBag, Plus, Trash2, Upload, Gift } from 'lucide-react';
import { 
  getStoreItems, 
  upsertStoreItem, 
  deleteStoreItem
} from '@/lib/storage';
import { StoreItem } from '@/lib/types';
import { toast } from 'sonner';
import { workerApi } from '@/lib/workerApi';
import { formatPriceCompact } from '@/lib/storeCurrency';
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
  const [showForm, setShowForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Form state - simplified: only name, description, price, stock, image
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceCredits: 10,
    stock: 1,
    imageUrl: '',
    imagePath: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setItems(getStoreItems());
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
      toast.error('המחיר חייב להיות לפחות 1');
      return;
    }

    // Simplified: no requirements, only price and stock
    const newItem: Omit<StoreItem, 'id' | 'createdAt' | 'lastModified'> = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      priceCredits: formData.priceCredits,
      stock: formData.stock,
      imageUrl: formData.imageUrl || undefined,
      imagePath: formData.imagePath || undefined,
      isActive: true
    };

    upsertStoreItem(newItem as StoreItem);
    toast.success('המוצר נשמר בהצלחה');
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      priceCredits: 10,
      stock: 1,
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

  const getItemImage = (item: StoreItem) => {
    if (item.imageUrl) {
      // Gift icon with product image inside
      return (
        <div className="relative w-12 h-12 rounded-lg border-2 border-dashed border-pink-400 bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center overflow-hidden">
          <Gift className="absolute h-5 w-5 text-pink-400 opacity-30" />
          <img 
            src={item.imageUrl} 
            alt={item.name}
            className="w-10 h-10 rounded object-cover relative z-10"
          />
        </div>
      );
    }
    
    // Empty gift icon
    return (
      <div className="w-12 h-12 rounded-lg border-2 border-dashed border-pink-400 bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center">
        <Gift className="h-6 w-6 text-pink-500" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
                  <Label>מחיר (נחושת)</Label>
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

              <div className="w-32">
                <Label>מלאי</Label>
                <Input 
                  type="number"
                  min={0}
                  value={formData.stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                />
              </div>

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
                      <div className="relative w-10 h-10 rounded-lg border-2 border-dashed border-pink-400 bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center overflow-hidden">
                        <img src={formData.imageUrl} alt="Preview" className="w-8 h-8 rounded object-cover" />
                      </div>
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
                <TableHead className="text-right w-16">מוצר</TableHead>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">מחיר</TableHead>
                <TableHead className="text-right">מלאי</TableHead>
                <TableHead className="text-right w-16">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                      <Badge variant="secondary">
                        {formatPriceCompact(item.priceCredits)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.stock > 0 ? 'outline' : 'destructive'}>
                        {item.stock}
                      </Badge>
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
