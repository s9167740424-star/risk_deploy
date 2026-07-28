import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Building2, ArrowLeft } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { surveyApi } from '@/api';
import { useAppStore } from '@/store/appStore';

async function routeAfterAuth(navigate: (path: string) => void) {
  const setSurveyCompleted = useAppStore.getState().setSurveyCompleted;
  try {
    const { data } = await surveyApi.getData();
    if (data.questionnaire?.completed) {
      setSurveyCompleted(true);
      navigate('/app');
      return;
    }
  } catch {
    // fall through to survey
  }
  setSurveyCompleted(false);
  navigate('/survey');
}

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { login, register, loginAsGuest, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      await routeAfterAuth(navigate);
    } catch {
      // error shown via store
    }
  };

  const handleRegister = async (fullName: string, email: string, password: string) => {
    try {
      await register(fullName, email, password);
      await routeAfterAuth(navigate);
    } catch {
      // error shown via store
    }
  };

  const handleGuest = async () => {
    await loginAsGuest();
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col">
      <div className="bg-white/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">На главную</span>
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <span className="font-display font-semibold text-text-primary">Атлас продаж</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {mode === 'login' ? (
            <LoginForm
              onSubmit={handleLogin}
              onSwitchToRegister={() => {
                setMode('register');
                clearError();
              }}
              onGuestAccess={handleGuest}
              isLoading={isLoading}
              error={error}
            />
          ) : (
            <RegisterForm
              onSubmit={handleRegister}
              onSwitchToLogin={() => {
                setMode('login');
                clearError();
              }}
              isLoading={isLoading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
