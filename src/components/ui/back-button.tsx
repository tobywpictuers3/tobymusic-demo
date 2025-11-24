import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearClientCaches } from '@/lib/cacheManager';

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

const BackButton = ({ to, label = 'חזור', className = '' }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = async () => {
    await clearClientCaches();
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button 
      onClick={handleClick}
      variant="outline"
      className={`flex items-center gap-2 ${className}`}
    >
      <ArrowRight className="h-4 w-4" />
      {label}
    </Button>
  );
};

export default BackButton;
