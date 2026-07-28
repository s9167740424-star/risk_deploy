import React from 'react';
import { Building2, LogIn, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/home');
  };

  return (
    <header className="bg-white border-b border-border">
      <div className="flex items-center justify-between px-6 h-14 gap-2">
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer shrink-0"
        >
          <Building2 className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <span className="font-display font-semibold text-text-primary hidden sm:inline">
            Атлас продаж
          </span>
        </button>

        <GlobalSearch />

        <div className="flex items-center gap-3 shrink-0">
          {!isAuthenticated && !user?.isGuest && (
            <button
              onClick={() => navigate('/auth')}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Войти
            </button>
          )}

          {(isAuthenticated || user?.isGuest) && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="font-medium hidden md:inline">
                  {user?.fullName || 'Пользователь'}
                </span>
              </div>
              <button
                onClick={() => {
                  void logout().then(() => navigate('/home'));
                }}
                className="btn-ghost text-sm flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
