import React, { useState } from 'react';
import { Building2, LogIn, User, Eye, EyeOff } from 'lucide-react';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  onSwitchToRegister: () => void;
  onGuestAccess: () => void;
  isLoading: boolean;
  error: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  onSwitchToRegister,
  onGuestAccess,
  isLoading,
  error,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-border p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold font-display text-text-primary mb-2">
          С возвращением!
        </h2>
        <p className="text-text-secondary text-base">
          Войдите, чтобы получить персональные рекомендации
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-base text-red-700 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-base font-semibold text-text-primary mb-2">
            Email
          </label>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field text-base"
            required
          />
        </div>

        <div>
          <label className="block text-base font-semibold text-text-primary mb-2">
            Пароль
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pr-12 text-base"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogIn className="w-5 h-5" />
          {isLoading ? 'Входим...' : 'Войти'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t-2 border-border space-y-3">
        <button
          onClick={onSwitchToRegister}
          className="w-full text-center text-base text-text-secondary hover:text-primary transition-colors font-medium"
        >
          Нет аккаунта?{' '}
          <span className="text-primary font-bold">Зарегистрироваться</span>
        </button>

        <button
          onClick={onGuestAccess}
          className="w-full text-center text-base text-text-muted hover:text-text-secondary transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <User className="w-5 h-5" />
          Продолжить как гость
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
