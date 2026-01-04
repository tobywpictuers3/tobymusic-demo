import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Button } from '@/components/safe-ui/button';
import { Badge } from '@/components/safe-ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/safe-ui/select';
import { ShoppingBag, Check, Info, Filter } from 'lucide-react';
import { 
  getStoreItems, 
  getStudentPurchases, 
  getStudentPracticeSessions,
  getAvailableCopper,
  purchaseStoreItem 
} from '@/lib/storage';
import { StoreItem, StorePurchase, PracticeSession } from '@/lib/types';
import { isStoreItemAvailableForStudent, buildRequirementExplanation } from '@/lib/storeLogic';
import { 
  getStudentMedalWallet, 
  formatPrice, 
  formatPriceCompact,
  MEDAL_ICONS 
} from '@/lib/storeCurrency';
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
  const [availableCopper, setAvailableCopper] = useState(0);
  const [wallet, setWallet] = useState({ bronze: 0, silver: 0, gold: 0, platinum: 0 });
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
    setAvailableCopper(getAvailableCopper(studentId));
    setWallet(getStudentMedalWallet(studentId));
  };

  const isPurchased = (itemId: string) => {
    return purchases.some(p => p.itemId === itemId);
  };

  const getAvailability = (item: StoreItem) => {
    return isStoreItemAvailableForStudent(studentId, item, sessions);
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
      {/* Medal Wallet Display */}
      <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-2 border-amber-400/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-sm text-muted-foreground">המדליות שלי</div>
            
            {/* Medal Counts */}
            <div className="flex justify-center gap-6 text-2xl">
              <div className="flex flex-col items-center">
                <span className="text-3xl">{MEDAL_ICONS.platinum}</span>
                <span className="font-bold">{wallet.platinum}</span>
                <span className="text-xs text-muted-foreground">פלטינום</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl">{MEDAL_ICONS.gold}</span>
                <span className="font-bold">{wallet.gold}</span>
                <span className="text-xs text-muted-foreground">זהב</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl">{MEDAL_ICONS.silver}</span>
                <span className="font-bold">{wallet.silver}</span>
                <span className="text-xs text-muted-foreground">כסף</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl">{MEDAL_ICONS.bronze}</span>
                <span className="font-bold">{wallet.bronze}</span>
                <span className="text-xs text-muted-foreground">נחושת</span>
              </div>
            </div>
            
            {/* Available Balance */}
            <div className="pt-2 border-t border-amber-300/50">
              <div className="text-sm text-muted-foreground">יתרה לקניות</div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400">
                {formatPriceCompact(availableCopper)}
              </div>
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
              <p className="text-sm">המורה תעלה פריטים שניתן לרכוש במדליות</p>
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
                        <Badge variant="secondary" className="gap-1 text-sm">
                          {formatPriceCompact(item.priceCredits)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          מלאי: {item.stock}
                        </span>
                      </div>


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
            <AlertDialogDescription asChild>
              <div>
                {selectedItem && (
                  <div className="space-y-3">
                    <p>
                      את עומדת לרכוש את <strong>"{selectedItem.name}"</strong>
                    </p>
                    
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between">
                        <span>מחיר:</span>
                        <span className="font-bold">{formatPrice(selectedItem.priceCredits)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>יתרה נוכחית:</span>
                        <span>{formatPriceCompact(availableCopper)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span>יתרה לאחר רכישה:</span>
                        <span className="font-bold text-amber-600">
                          {formatPriceCompact(availableCopper - selectedItem.priceCredits)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
                {buildRequirementExplanation(studentId, infoItem, sessions).details.map((detail, idx) => (
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