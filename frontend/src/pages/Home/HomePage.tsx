import React from 'react';
import { Building2, ArrowRight, Shield, FileText, BookOpen, MapPin, Sparkles, Library, UserPlus, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import GlobalSearch from '@/components/layout/GlobalSearch';

const HomePage: React.FC = () => {
  const { isAuthenticated, user, loginAsGuest } = useAuthStore();
  const navigate = useNavigate();

  const ensureAccess = async (): Promise<boolean> => {
    if (isAuthenticated || user?.isGuest) return true;
    await loginAsGuest();
    return true;
  };

  const handleFeatureClick = async (path: string) => {
    await ensureAccess();
    navigate(path);
  };

  const handleGetStarted = async () => {
    await ensureAccess();
    navigate('/app');
  };

  const steps = [
    {
      icon: Shield,
      title: 'Карта объектов',
      subtitle: 'Анализ территории и объекта',
      description: '',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      path: '/app/step1',
    },
    {
      icon: FileText,
      title: 'Комплект документов',
      subtitle: 'Все необходимые документы для совершения сделки',
      description: '',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      path: '/app/step2',
    },
    {
      icon: BookOpen,
      title: 'Пошаговые инструкции',
      subtitle: 'Все этапы и действия для продажи недвижимости',
      description: '',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      border: 'border-violet-200',
      path: '/app/step3',
    },
  ];

  const benefits = [
    'Персональный комплект документов под ваш объект',
    'Индивидуальные пошаговые инструкции',
    'Рекомендации по вашей ситуации',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 flex flex-col">
      <nav className="bg-white/95 backdrop-blur-sm border-b-2 border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </div>
            <span className="text-xl font-bold font-display text-text-primary hidden sm:inline">
              Атлас продаж
            </span>
          </div>
          <GlobalSearch
            className="relative flex-1 max-w-xl mx-2"
            beforeNavigate={async () => {
              await ensureAccess();
            }}
          />
          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated && !user?.isGuest ? (
              <button onClick={() => navigate('/app')} className="btn-primary">
                Перейти в приложение
              </button>
            ) : (
              <>
                <button onClick={handleGetStarted} className="btn-ghost font-semibold hidden md:inline-flex">
                  Попробовать как гость
                </button>
                <button onClick={() => navigate('/auth')} className="btn-primary flex items-center gap-2">
                  Войти <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full py-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              <span className="text-text-primary">Продажа недвижимости</span>
              <br />
              <span className="text-primary">проще, чем кажется</span>
            </h1>
            <div className="mt-3 max-w-3xl mx-auto">
              <p className="text-base md:text-lg text-text-secondary">
                  Мы собрали для вас документы и инструкции в единую систему. Разобраться в нюансах сделки проще, когда всё необходимое есть{' '}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              <span className="text-primary">в Атласе продаж</span>
            </h1>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mb-10">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/20 p-6 md:p-8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

              <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserPlus className="w-8 h-8 text-primary" strokeWidth={1.5} />
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl md:text-2xl font-bold text-text-primary mb-2">
                    Войдите в аккаунт — получите больше!
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-primary/70 flex-shrink-0" strokeWidth={2} />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={() => navigate('/auth')}
                    className="btn-primary flex items-center gap-2 whitespace-nowrap px-6 py-3 text-base"
                  >
                    Войти в аккаунт
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-text-muted mt-2 text-center">Это бесплатно и займёт 1 минуту</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => handleFeatureClick(step.path)}
                className={`${step.bg} border-2 ${step.border} rounded-xl p-5 text-left hover:shadow-lg transition-all duration-200 group relative overflow-hidden`}
              >
                <div className="absolute top-2 right-2 text-xs font-bold text-text-muted/30">
                  0{i + 1}
                </div>
                <div className={`${step.color} mb-3`}>
                  <step.icon className="w-8 h-8" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-text-primary mb-1">
                  {step.title}
                </h3>
                <p className="text-sm font-semibold text-text-secondary mb-2">
                  {step.subtitle}
                </p>
                <p className="text-sm text-text-muted leading-relaxed">
                  {step.description}
                </p>
              </button>
            ))}
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => handleFeatureClick('/app/materials')}
              className="group flex items-center gap-4 px-10 py-4 bg-white border-2 border-amber-200 rounded-xl hover:shadow-lg hover:border-amber-300 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Library className="w-6 h-6 text-amber-600" strokeWidth={1.5} />
              </div>
              <div className="text-left">
                <p className="text-base font-bold text-text-primary">Журнал</p>
                <p className="text-sm text-text-muted">Статьи, инструкции и рекомендации</p>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-200 bg-white/50 backdrop-blur-sm mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
              <span className="text-sm font-medium text-gray-600">Атлас продаж</span>
              <span className="text-xs text-gray-300">•</span>
              <span className="text-xs text-gray-400">{new Date().getFullYear()}</span>
            </div>

            <div className="text-center max-w-2xl">
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="font-medium text-gray-500"></span> Вся информация, представленная на сайте, носит исключительно справочный и информационный характер.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <a href="#" className="hover:text-gray-600 transition-colors"></a>
              <span>•</span>
              <a href="#" className="hover:text-gray-600 transition-colors"></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
