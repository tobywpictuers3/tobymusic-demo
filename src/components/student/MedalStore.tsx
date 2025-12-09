import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Button } from '@/components/safe-ui/button';
import { Badge } from '@/components/safe-ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/safe-ui/select';
import { ShoppingBag, Coins, Check, Info, Filter } from 'lucide-react';
import { 
  getStoreItems, 
  getStudentCredits, 
  getStudentPurchases, 
  getStudentPracticeSessions,
  purchaseStoreItem 
} from '@/lib/storage';
import { StoreItem, StorePurchase, PracticeSession } from '@/lib/types';
import { isStoreItemAvailableForStudent, buildRequirementExplanation } from '@/lib/storeLogic';
import { toast } from 'sonner';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/safe-ui/dialog";

interface MedalStoreProps {
  studentId: string;
}

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'available' | 'unavailable';

const MedalStore = ({ studentId }: MedalStoreProps) => {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [purchases, setPurchases] = useState<StorePurchase[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [credits, setCredits] = useState(0);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoItem, setInfoItem] = useState<StoreItem | null>(null);

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = () => {
    setItems(getStoreItems().filter(i => i.isActive));
    setPurchases(getStudentPurchases(studentId));
    setSessions(getStudentPracticeSessions(studentId));
    setCredits(getStudentCredits(studentId));
  };

  const isPurchased = (itemId: string) => {
    return purchases.some(p => p.itemId === itemId);
  };

  const getAvailability = (item: StoreItem) => {
    return isStoreItemAvailableForStudent(studentId, item, sessions, credits);
  };

  const getSortedItems = () => {
    let sorted = [...items];
    
    // First separate purchased vs not purchased
    const purchased = sorted.filter(i => isPurchased(i.id));
    const notPurchased = sorted.filter(i => !isPurchased(i.id));
    
    // Sort not purchased items
    switch (sortOption) {
      case 'price-asc':
        notPurchased.sort((a, b) => a.priceCredits - b.priceCredits);
        break;
      case 'price-desc':
        notPurchased.sort((a, b) => b.priceCredits - a.priceCredits);
        break;
      case 'available':
        notPurchased.sort((a, b) => {
          const aAvail = getAvailability(a).available ? 0 : 1;
          const bAvail = getAvailability(b).available ? 0 : 1;
          return aAvail - bAvail;
        });
        break;
      case 'unavailable':
        notPurchased.sort((a, b) => {
          const aAvail = getAvailability(a).available ? 1 : 0;
          const bAvail = getAvailability(b).available ? 1 : 0;
          return aAvail - bAvail;
        });
        break;
    }
    
    // Purchased items always go to bottom
    return [...notPurchased, ...purchased];
  };

  const handlePurchaseClick = (item: StoreItem) => {
    const availability = getAvailability(item);
    if (!availability.available) {
      toast.error(availability.reason || 'לא ניתן לרכוש מוצר זה');
      return;
    }
    setSelectedItem(item);
    setPurchaseDialogOpen(true);
  };

  const handlePurchaseConfirm = async () => {
    if (!selectedItem) return;
    
    const result = await purchaseStoreItem(studentId, selectedItem.id, sessions);
    
    if (result.ok) {
      toast.success(`🎉 רכשת את "${selectedItem.name}" בהצלחה!`);
      loadData();
    } else {
      toast.error(result.reason || 'שגיאה ברכישה');
    }
    
    setPurchaseDialogOpen(false);
    setSelectedItem(null);
  };

  const handleInfoClick = (item: StoreItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInfoItem(item);
    setInfoDialogOpen(true);
  };

  const getItemImage = (item: StoreItem) => {
    if (item.imageUrl) {
      return (
        <img 
          src={item.imageUrl} 
          alt={item.name}
          className="w-full h-32 rounded-lg object-cover"
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
      <div className={`w-full h-32 rounded-lg bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-bold text-5xl`}>
        {item.name.charAt(0)}
      </div>
    );
  };

  const sortedItems = getSortedItems();

  return (
    <div className="space-y-6">
      {/* Credits Display */}
      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-2 border-yellow-400/50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">הקרדיטים שלי</div>
            <div className="text-5xl font-bold text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-3">
              <Coins className="h-12 w-12" />
              <span>{credits}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            חנות הפרסים
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="מיון" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">ברירת מחדל</SelectItem>
                <SelectItem value="price-asc">מחיר: נמוך לגבוה</SelectItem>
                <SelectItem value="price-desc">מחיר: גבוה לנמוך</SelectItem>
                <SelectItem value="available">זמינים לי קודם</SelectItem>
                <SelectItem value="unavailable">לא זמינים קודם</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {sortedItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <ShoppingBag className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>החנות תתעדכן בקרוב!</p>
              <p className="text-sm">המורה תעלה פריטים שניתן לרכוש בקרדיטים</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedItems.map(item => {
                const purchased = isPurchased(item.id);
                const availability = getAvailability(item);
                
                return (
                  <div
                    key={item.id}
                    className={`relative p-4 rounded-lg border-2 transition-all ${
                      purchased 
                        ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20 opacity-70' 
                        : availability.available 
                          ? 'border-primary/20 bg-card hover:border-primary/40 hover:shadow-lg' 
                          : 'border-muted bg-muted/30 opacity-60'
                    }`}
                    onContextMenu={(e) => handleInfoClick(item, e)}
                  >
                    {/* Purchased Badge */}
                    {purchased && (
                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="bg-green-500 gap-1">
                          <Check className="h-3 w-3" />
                          נרכש
                        </Badge>
                      </div>
                    )}

                    {/* Info Button */}
                    <button
                      onClick={(e) => handleInfoClick(item, e)}
                      className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-background/80 hover:bg-background border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Info className="h-4 w-4" />
                    </button>

                    {/* Image */}
                    <div className="mb-3">
                      {getItemImage(item)}
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="gap-1">
                          <Coins className="h-3 w-3" />
                          {item.priceCredits} קרדיטים
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          מלאי: {item.stock}
                        </span>
                      </div>

                      {/* Requirements indicators */}
                      {item.requirements && (
                        <div className="flex flex-wrap gap-1 text-xs">
                          {item.requirements.minStreakDays && (
                            <Badge variant="outline" className="text-xs">
                              🔥 {item.requirements.minStreakDays} ימים
                            </Badge>
                          )}
                          {item.requirements.minMinutesInLastNDays && (
                            <Badge variant="outline" className="text-xs">
                              ⏱️ {item.requirements.minMinutesInLastNDays} דק'
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Purchase Button */}
                      {!purchased && (
                        <Button
                          onClick={() => handlePurchaseClick(item)}
                          disabled={!availability.available}
                          className="w-full mt-2"
                          variant={availability.available ? 'default' : 'outline'}
                        >
                          {availability.available ? 'רכישה' : availability.reason || 'לא זמין'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>אישור רכישה</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedItem && (
                <>
                  את עומדת לרכוש את <strong>"{selectedItem.name}"</strong> תמורת{' '}
                  <strong>{selectedItem.priceCredits} קרדיטים</strong>.
                  <br /><br />
                  לאחר הרכישה יישארו לך {credits - selectedItem.priceCredits} קרדיטים.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurchaseConfirm}>
              אישור רכישה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Info Dialog */}
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{infoItem?.name}</DialogTitle>
          </DialogHeader>
          {infoItem && (
            <div className="space-y-4">
              {infoItem.description && (
                <p className="text-muted-foreground">{infoItem.description}</p>
              )}
              
              <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                {buildRequirementExplanation(studentId, infoItem, sessions, credits).details.map((detail, idx) => (
                  <div key={idx} className="text-sm">{detail}</div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MedalStore;
