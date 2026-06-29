import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { restaurant } = useAuth();

  return (
    <div className="app-layout">
      <div className="app-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
