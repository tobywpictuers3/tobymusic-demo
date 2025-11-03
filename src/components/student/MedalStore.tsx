import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Trophy } from 'lucide-react';
import { getStudentMedalRecords, updateMedalAsUsed } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { MedalRecord } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

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
    </div>
  );
};

export default MedalStore;
