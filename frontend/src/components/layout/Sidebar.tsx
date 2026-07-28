import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, FileText, BookOpen, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const steps = [
  { id: 'step1', label: 'Карта объектов', desc: 'Анализ территории и объекта.', icon: MapPin },
  { id: 'step2', label: 'Комплект документов', desc: 'Все необходимые документы для совершения сделки.', icon: FileText },
  { id: 'step3', label: 'Пошаговые инструкции', desc: 'Все этапы и действия для продажи недвижимости', icon: BookOpen },
  { id: 'materials', label: 'Журнал', desc: 'Статьи, инструкции и рекомендации', icon: Lightbulb },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const currentPath = location.pathname.split('/').pop() || 'step1';

  return (
    <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r-2 border-border flex flex-col transition-all duration-300 shrink-0`}>
      <div className="p-3 border-b-2 border-border flex items-center justify-between">
        {!sidebarCollapsed && (
          <h2 className="text-sm uppercase tracking-wider text-primary font-bold">Разделы</h2>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-text-muted hover:text-primary transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {steps.map((step) => {
          const isActive = currentPath === step.id;
          return (
            <button
              key={step.id}
              onClick={() => navigate(`/app/${step.id}`)}
              className={`w-full text-left rounded-xl transition-all duration-200 ${
                sidebarCollapsed ? 'p-3 flex justify-center' : 'px-4 py-3'
              } ${
                isActive
                  ? 'bg-primary/10 text-primary border-2 border-primary/30'
                  : 'text-text-secondary hover:bg-slate-50 border-2 border-transparent'
              }`}
              title={sidebarCollapsed ? step.desc : undefined}
            >
              <div className="flex items-center gap-3">
                <step.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                {!sidebarCollapsed && (
                  <>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{step.label}</div>
                      <div className="text-xs text-text-muted">{step.desc}</div>
                    </div>
                    {isActive && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
