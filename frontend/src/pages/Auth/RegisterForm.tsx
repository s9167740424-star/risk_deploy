import React, { useState } from 'react';
import { Building2, UserPlus, Eye, EyeOff } from 'lucide-react';

interface RegisterFormProps {
  onSubmit: (fullName: string, email: string, password: string) => Promise<void>;
  onSwitchToLogin: () => void;
  isLoading: boolean;
  error: string | null;
}

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  onSwitchToLogin,
  isLoading,
  error,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    await onSubmit(fullName, email, password);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-border p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Building2
            className="w-8 h-8 text-primary"
            strokeWidth={1.5}
          />
        </div>

        <h2 className="text-2xl font-bold font-display text-text-primary mb-2">
          Создайте аккаунт
        </h2>

        <p className="text-text-secondary text-base">
          Для доступа к персональным рекомендациям
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
            ФИО
          </label>

          <input
            type="text"
            placeholder="Иванов Иван Иванович"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-field text-base"
            required
          />
        </div>

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
              placeholder="Минимум 8 символов"
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
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only"
              />

              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  agreed
                    ? 'bg-primary border-primary'
                    : 'border-border-dark group-hover:border-primary'
                }`}
              >
                {agreed && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </div>

            <span className="text-base text-text-secondary group-hover:text-text-primary transition-colors leading-relaxed">
              Я согласен на обработку персональных данных и принимаю
              условия политики конфиденциальности
            </span>
          </label>

          <p className="text-sm text-text-muted leading-relaxed pl-8">
            Нажимая кнопку «зарегистрироваться» я подтверждаю, что ознакомлен с
            тем, что информация, содержащаяся на сайте носит исключительно
            справочный характер
          </p>
        </div>

        <button
          type="submit"
          disabled={!agreed || isLoading}
          className={`w-full flex items-center justify-center gap-2 rounded-lg font-semibold py-3 text-base transition-all duration-200 ${
            agreed
              ? 'btn-primary'
              : 'bg-slate-100 text-text-muted cursor-not-allowed border-2 border-border'
          }`}
        >
          <UserPlus className="w-5 h-5" />
          {isLoading ? 'Регистрируем...' : 'Зарегистрироваться'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t-2 border-border text-center">
        <button
          onClick={onSwitchToLogin}
          className="text-base text-text-secondary hover:text-primary transition-colors font-medium"
        >
          Уже есть аккаунт?{' '}
          <span className="text-primary font-bold">Войти</span>
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;
