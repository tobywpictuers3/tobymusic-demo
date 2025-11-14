import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setDevMode, getCurrentUser } from '@/lib/storage';
import AdminDashboard from './AdminDashboard';

const DevAdminDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = getCurrentUser();
    
    // If not logged in as admin, redirect to homepage
    if (!currentUser || currentUser.type !== 'admin') {
      navigate('/');
      return;
    }

    // 🔒 CRITICAL: Force developer mode
    setDevMode(true);
    sessionStorage.setItem('musicSystem_devMode', 'true');
  }, [navigate]);

  // Render the same AdminDashboard component
  return <AdminDashboard />;
};

export default DevAdminDashboard;
