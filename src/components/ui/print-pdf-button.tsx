import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import blankTemplate from '@/assets/blank-template.jpg';

interface PrintPDFButtonProps {
  contentId?: string;
  filename?: string;
  tabName?: string;
}

export const PrintPDFButton = ({ contentId = 'main-content', filename, tabName }: PrintPDFButtonProps) => {
  const handlePrint = async () => {
    try {
      const element = document.getElementById(contentId) || document.body;
      
      toast({
        description: 'מייצא לPDF...',
      });

      // Create canvas from content (in grayscale)
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      // Convert to grayscale
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentHeight = (canvas.height * pageWidth) / canvas.width;
      const totalPages = Math.ceil(contentHeight / pageHeight);

      // Add pages with blank template background
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        // Add blank template background
        pdf.addImage(blankTemplate, 'JPEG', 0, 0, pageWidth, pageHeight);

        // Add content (cropped for this page)
        const yOffset = -page * pageHeight;
        const sourceY = (page * pageHeight * canvas.width) / pageWidth;
        const sourceHeight = Math.min((pageHeight * canvas.width) / pageWidth, canvas.height - sourceY);
        
        if (sourceHeight > 0) {
          // Create a cropped canvas for this page
          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = canvas.width;
          croppedCanvas.height = sourceHeight;
          const croppedCtx = croppedCanvas.getContext('2d');
          
          if (croppedCtx) {
            croppedCtx.drawImage(
              canvas,
              0, sourceY, canvas.width, sourceHeight,
              0, 0, canvas.width, sourceHeight
            );
            
            const croppedImgData = croppedCanvas.toDataURL('image/png');
            const croppedHeight = (sourceHeight * pageWidth) / canvas.width;
            pdf.addImage(croppedImgData, 'PNG', 10, 20, pageWidth - 20, croppedHeight, '', 'FAST');
          }
        }
      }

      // Generate filename with tab name and current date/time
      const now = new Date();
      const dateStr = now.toLocaleDateString('he-IL').replace(/\./g, '-');
      const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-');
      const finalFilename = filename || `${tabName || 'תצוגה'}-${dateStr}-${timeStr}.pdf`;
      
      pdf.save(finalFilename);

      toast({
        description: 'הקובץ הורד בהצלחה',
      });
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'שגיאה ביצירת PDF',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
      <FileDown className="h-4 w-4" />
      הדפסה לPDF
    </Button>
  );
};
