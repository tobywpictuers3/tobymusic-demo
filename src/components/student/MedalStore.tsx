import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Button } from '@/components/safe-ui/button';
import { ShoppingBag, Trophy, Undo2, ShoppingCart } from 'lucide-react';
import { getStudentMedalRecords, updateMedalAsUsed, refundMedal } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { MedalRecord } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
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

interface MedalStoreProps {
  studentId: string;
}

interface StoreItem {
  id: string;
  name: string;
  description: string;
  medalCost: number;
  icon: string;
}

const MedalStore = ({ studentId }: MedalStoreProps) => {
  const [medals, setMedals] = useState<MedalRecord[]>([]);
  const [availableMedals, setAvailableMedals] = useState(0);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<{ medalIds: string[], itemName: string } | null>(null);

  useEffect(() => {
    loadMedals();
  }, [studentId]);

  const loadMedals = () => {
    const allMedals = getStudentMedalRecords(studentId);
    setMedals(allMedals);
    const available = allMedals.filter(m => !m.used).length;
    setAvailableMedals(available);
  };

  // Store items - can be configured later
  const storeItems: StoreItem[] = [
    {
      id: 'item1',
      name: 'פריט לדוגמה',
      description: 'זה פריט לדוגמה - המורה תעלה את המוצרים בהמשך',
      medalCost: 5,
      icon: '🎁'
    }
  ];

  const handlePurchase = (item: StoreItem) => {
    if (availableMedals < item.medalCost) {
      toast({
        title: 'אין מספיק מדליות',
        description: `נדרשות ${item.medalCost} מדליות לרכישת פריט זה`,
        variant: 'destructive'
      });
      return;
    }

    // Find unused medals to mark as used
    const unusedMedals = medals.filter(m => !m.used).slice(0, item.medalCost);
    
    unusedMedals.forEach(medal => {
      updateMedalAsUsed(medal.id, item.name);
    });

    toast({
      title: '🎉 רכישה הושלמה!',
      description: `רכשת את "${item.name}" תמורת ${item.medalCost} מדליות`
    });

    loadMedals();
  };

  const handleRefundRequest = (itemName: string) => {
    // Find all medals used for this item
    const usedMedals = medals.filter(m => m.used && m.usedForItem === itemName);
    
    if (usedMedals.length === 0) return;

    setSelectedRefund({
      medalIds: usedMedals.map(m => m.id),
      itemName
    });
    setRefundDialogOpen(true);
  };

  const handleRefundConfirm = () => {
    if (!selectedRefund) return;

    selectedRefund.medalIds.forEach(medalId => {
      refundMedal(medalId);
    });

    toast({
      title: '✅ הרכישה בוטלה בהצלחה',
      description: `${selectedRefund.medalIds.length} מדליות הוחזרו לחשבונך`
    });

    setRefundDialogOpen(false);
    setSelectedRefund(null);
    loadMedals();
  };

  // Group purchases by item name
  const getPurchasedItems = () => {
    const purchasedMap = new Map<string, { count: number, date: string }>();
    
    medals.filter(m => m.used && m.usedForItem).forEach(medal => {
      const itemName = medal.usedForItem!;
      const existing = purchasedMap.get(itemName);
      
      if (existing) {
        purchasedMap.set(itemName, {
          count: existing.count + 1,
          date: medal.usedDate! > existing.date ? medal.usedDate! : existing.date
        });
      } else {
        purchasedMap.set(itemName, { count: 1, date: medal.usedDate! });
      }
    });

    return Array.from(purchasedMap.entries()).map(([itemName, data]) => ({
      itemName,
      medalCount: data.count,
      purchaseDate: data.date
    }));
  };

  const purchasedItems = getPurchasedItems();

  return (
    <div className="space-y-6">
      {/* Available Medals Counter */}
      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-2 border-yellow-400/50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">מדליות זמינות לרכישה</div>
            <div className="text-5xl font-bold text-yellow-600 dark:text-yellow-400">
              <Trophy className="inline-block h-12 w-12 mb-2" />
              <div>{availableMedals}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchased Items - Refund Section */}
      {purchasedItems.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              הרכישות שלי
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchasedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20"
                >
                  <div className="flex-1">
                    <h4 className="font-bold">{item.itemName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {item.medalCount} מדליות • נרכש ב-{item.purchaseDate}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefundRequest(item.itemName)}
                    className="gap-2"
                  >
                    <Undo2 className="h-4 w-4" />
                    החזר
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            פריטים זמינים לרכישה
          </CardTitle>
        </CardHeader>
        <CardContent>
          {storeItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border-2 border-primary/20 bg-card hover:border-primary/40 transition-colors"
                >
                  <div className="text-center space-y-3">
                    <div className="text-6xl">{item.icon}</div>
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <div className="flex items-center justify-center gap-2 text-yellow-600 dark:text-yellow-400 font-bold">
                      <Trophy className="h-5 w-5" />
                      <span>{item.medalCost} מדליות</span>
                    </div>
                    <Button
                      onClick={() => handlePurchase(item)}
                      disabled={availableMedals < item.medalCost}
                      className="w-full"
                    >
                      {availableMedals >= item.medalCost ? 'רכוש עכשיו' : 'אין מספיק מדליות'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              החנות תתעדכן בקרוב! המורה תעלה פריטים שניתן לרכוש במדליות
            </p>
          )}
        </CardContent>
      </Card>

      {/* Refund Confirmation Dialog */}
      <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>אישור ביטול רכישה</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRefund && (
                <>
                  האם את בטוחה שברצונך לבטל את הרכישה של "{selectedRefund.itemName}"?
                  <br />
                  <strong className="text-foreground">{selectedRefund.medalIds.length} מדליות יוחזרו לחשבונך.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefundConfirm}>
              אישור החזר
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MedalStore;
