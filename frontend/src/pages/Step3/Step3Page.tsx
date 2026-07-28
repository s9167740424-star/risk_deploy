import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { User, ChevronLeft, ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useNavigationStore } from '@/store/navigationStore';
import { algorithmsApi } from '@/api';
import AlgorithmToggle from '@/components/ui/AlgorithmToggle';
import type { AlgorithmGroup, AlgorithmStep } from '@/types';
import { splitHighlightParts } from '@/utils/textHighlight';

type UiStep = AlgorithmStep & { dbId?: number };

const HighlightedText: React.FC<{ text: string; query: string | null; className?: string }> = ({
  text,
  query,
  className,
}) => {
  if (!query?.trim()) return <span className={className}>{text}</span>;
  const parts = splitHighlightParts(text, query);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.hit ? (
          <mark
            key={i}
            className="atlas-search-hl rounded-sm px-0.5"
            style={{ backgroundColor: '#fde68a', color: 'inherit' }}
          >
            {p.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        )
      )}
    </span>
  );
};

const Step3Page: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const algorithmParam = searchParams.get('algorithm');
  const highlightQuery = searchParams.get('q');
  const firstHitRef = useRef<HTMLDivElement | null>(null);
  const [highlightActive, setHighlightActive] = useState(Boolean(highlightQuery?.trim()));

  const [groups, setGroups] = useState<AlgorithmGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [activeAlgorithmId, setActiveAlgorithmId] = useState('');

  const { isAuthenticated } = useAuthStore();
  const { checkedAlgorithms, toggleAlgorithmStep, setCheckedAlgorithmSteps } = useAppStore();
  const {
    algorithmsBackRoute,
    setAlgorithmsBackRoute,
    setMaterialsBackRoute,
    setStep1BackRoute,
  } = useNavigationStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data } = await algorithmsApi.getTree();
        if (cancelled) return;
        const nextGroups: AlgorithmGroup[] = data.groups || [];
        setGroups(nextGroups);

        const checked = data.checkedAlgorithms || {};
        Object.entries(checked).forEach(([code, stepIds]) => {
          setCheckedAlgorithmSteps(code, stepIds as string[]);
        });

        let groupId = nextGroups[0]?.id || '';
        let algoId = nextGroups[0]?.algorithms[0]?.id || '';

        if (algorithmParam) {
          for (const group of nextGroups) {
            const found = group.algorithms.find((a) => a.id === algorithmParam);
            if (found) {
              groupId = group.id;
              algoId = algorithmParam;
              break;
            }
          }
        }

        setActiveGroupId(groupId);
        setActiveAlgorithmId(algoId);
      } catch {
        if (!cancelled) setLoadError('Не удалось загрузить пошаговые инструкции с сервера');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [algorithmParam, setCheckedAlgorithmSteps]);

  useEffect(() => {
    setHighlightActive(Boolean(highlightQuery?.trim()));
  }, [highlightQuery, activeAlgorithmId]);

  useEffect(() => {
    if (!highlightActive || !highlightQuery?.trim() || loading) return;
    const timer = window.setTimeout(() => {
      firstHitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [highlightActive, highlightQuery, loading, groups, activeAlgorithmId]);

  useEffect(() => {
    if (!highlightActive) return;
    const clear = () => {
      setHighlightActive(false);
      const next = new URLSearchParams(searchParams);
      next.delete('q');
      setSearchParams(next, { replace: true });
    };
    document.addEventListener('pointerdown', clear, true);
    return () => document.removeEventListener('pointerdown', clear, true);
  }, [highlightActive, searchParams, setSearchParams]);

  useEffect(() => {
    if (location.state) {
      const { activeAlgorithm: savedAlgorithm } = location.state as {
        activeAlgorithm?: string;
      };
      if (savedAlgorithm) {
        for (const group of groups) {
          const found = group.algorithms.find((a) => a.id === savedAlgorithm);
          if (found) {
            setActiveGroupId(group.id);
            setActiveAlgorithmId(savedAlgorithm);
            break;
          }
        }
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, groups]);

  const currentGroup = groups.find((g) => g.id === activeGroupId);
  const currentAlgorithms = currentGroup?.algorithms || [];
  const currentConfig = currentAlgorithms.find((a) => a.id === activeAlgorithmId);
  const currentSteps = (currentConfig?.steps || []) as UiStep[];
  const currentChecked = checkedAlgorithms[activeAlgorithmId] || [];

  const pageTitle = currentConfig?.displayTitle || currentGroup?.title || 'Алгоритм';
  const pageSubtitle = currentConfig?.subtitle || '';

  const hasToggle = !!currentConfig?.toggle;
  const toggleConfig = currentConfig?.toggle;

  const getActiveToggleId = () => {
    if (!toggleConfig) return 'left';
    if (activeAlgorithmId === toggleConfig.left?.id) return 'left';
    if (activeAlgorithmId === toggleConfig.middle1?.id) return 'middle1';
    if (activeAlgorithmId === toggleConfig.middle2?.id) return 'middle2';
    if (activeAlgorithmId === toggleConfig.middle3?.id) return 'middle3';
    if (activeAlgorithmId === toggleConfig.right?.id) return 'right';
    return 'left';
  };

  const handleToggle = (toggleId: string) => {
    if (!toggleConfig) return;
    let targetId: string | undefined;
    if (toggleId === 'left') targetId = toggleConfig.left?.id;
    else if (toggleId === 'middle1') targetId = toggleConfig.middle1?.id;
    else if (toggleId === 'middle2') targetId = toggleConfig.middle2?.id;
    else if (toggleId === 'middle3') targetId = toggleConfig.middle3?.id;
    else if (toggleId === 'right') targetId = toggleConfig.right?.id;
    if (targetId) setActiveAlgorithmId(targetId);
  };

  const handleBackClick = () => {
    if (algorithmsBackRoute) {
      navigate(algorithmsBackRoute.path, { state: algorithmsBackRoute.state });
      setAlgorithmsBackRoute(null);
    }
  };

  const handleLinkClick = (link: {
    type: 'algorithm' | 'helpful' | 'step1' | 'step2' | 'external';
    id: string;
    label: string;
    url?: string;
  }) => {
    if (link.type === 'external' && link.url) {
      window.open(link.url, '_blank');
      return;
    }
    if (link.type === 'helpful') {
      setMaterialsBackRoute({
        path: '/app/step3',
        label: `Назад к «${pageTitle}»`,
        state: { activeAlgorithm: activeAlgorithmId },
      });
      navigate(`/app/materials?article=${encodeURIComponent(link.id)}`);
    } else if (link.type === 'step1') {
      setStep1BackRoute({
        path: '/app/step3',
        label: `Назад к «${pageTitle}»`,
        state: { activeAlgorithm: activeAlgorithmId },
      });
      navigate('/app/step1');
    } else if (link.type === 'step2') {
      setAlgorithmsBackRoute({
        path: '/app/step3',
        label: 'Назад к пошаговым инструкциям',
        state: { activeAlgorithm: activeAlgorithmId },
      });
      navigate('/app/step2');
    } else if (link.type === 'algorithm' && link.id) {
      setAlgorithmsBackRoute({
        path: '/app/step3',
        label: `Назад к «${pageTitle}»`,
        state: { activeAlgorithm: activeAlgorithmId },
      });
      for (const group of groups) {
        const found = group.algorithms.find((a) => a.id === link.id);
        if (found) {
          setActiveGroupId(group.id);
          setActiveAlgorithmId(link.id);
          break;
        }
      }
    }
  };

  const handleToggleStep = async (step: UiStep) => {
    if (isAuthenticated && step.dbId != null) {
      try {
        await algorithmsApi.toggleStep(step.dbId);
      } catch {
        return;
      }
    }
    toggleAlgorithmStep(activeAlgorithmId, step.id);
  };

  const handleGroupClick = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (group && group.algorithms.length > 0) {
      setActiveGroupId(groupId);
      setActiveAlgorithmId(group.algorithms[0].id);
    }
  };

  const handlePrevStep = () => navigate('/app/step2');
  const handleNextStep = () => navigate('/app/materials');

  const isProgressStep = (step: { id: string }) => !step.id.includes('title');

  const totalMainSteps = currentSteps.filter(isProgressStep).length;
  const completedMainSteps = currentSteps.filter(
    (step) => isProgressStep(step) && currentChecked.includes(step.id)
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted font-medium">Загрузка инструкций…</p>
      </div>
    );
  }

  if (loadError || groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="max-w-md rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 font-medium mb-2">
            {loadError || 'Пошаговые инструкции не найдены'}
          </p>
          <p className="text-sm text-red-600">
            Добавьте JSON в{' '}
            <code className="bg-red-100 px-1 rounded">frontend/public/algorithms/</code> и выполните{' '}
            <code className="bg-red-100 px-1 rounded">flask seed-content</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 bg-white border-r-2 border-border p-4 overflow-y-auto flex flex-col">
        <div className="mb-4">
          <p className="text-sm uppercase tracking-wider text-primary font-bold mb-1">Шаг 3</p>
          <p className="text-base text-text-secondary font-medium">Пошаговые инструкции</p>
        </div>

        <div className="space-y-1 flex-1">
          {groups.map((group) => {
            const isGroupActive = group.id === activeGroupId;
            const totalChecked = group.algorithms.reduce((sum, alg) => {
              const checked = checkedAlgorithms[alg.id] || [];
              return (
                sum +
                alg.steps.filter(
                  (step) => !step.id.includes('title') && checked.includes(step.id)
                ).length
              );
            }, 0);
            const totalSteps = group.algorithms.reduce((sum, alg) => {
              return sum + alg.steps.filter((step) => !step.id.includes('title')).length;
            }, 0);

            return (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-base transition-all duration-200 ${
                  isGroupActive
                    ? 'bg-primary/10 text-primary border-2 border-primary/30 shadow-md'
                    : 'text-text-secondary hover:bg-slate-50 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{group.title}</span>
                  {totalChecked > 0 && (
                    <span className="text-xs text-violet-600 font-bold">
                      {totalChecked}/{totalSteps}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <button
            onClick={handlePrevStep}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-text-secondary font-medium rounded-lg border-2 border-border hover:border-primary/30 hover:bg-slate-50 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Предыдущий шаг
          </button>
          <button
            onClick={handleNextStep}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-md hover:shadow-lg text-sm"
          >
            Следующий шаг
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {algorithmsBackRoute && (
          <div className="mb-4">
            <button
              onClick={handleBackClick}
              className="flex items-center gap-2 text-base text-text-secondary hover:text-primary font-medium bg-white border-2 border-border rounded-xl px-4 py-2 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              {algorithmsBackRoute.label}
            </button>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold font-display text-text-primary">{pageTitle}</h2>
              {pageSubtitle && (
                <p className="text-sm text-text-muted mt-0.5">{pageSubtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-base text-text-secondary font-medium">
                Выполнено: {completedMainSteps} / {totalMainSteps}
              </span>
              <div className="w-32 h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(completedMainSteps / Math.max(totalMainSteps, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {hasToggle && toggleConfig && (
          <div className="mb-6 flex items-center gap-4">
            <AlgorithmToggle
              leftLabel={toggleConfig.left.label}
              rightLabel={toggleConfig.right.label}
              middle1Label={toggleConfig.middle1?.label}
              middle2Label={toggleConfig.middle2?.label}
              middle3Label={toggleConfig.middle3?.label}
              activeId={getActiveToggleId()}
              onToggle={handleToggle}
            />
          </div>
        )}

        {!isAuthenticated && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <User className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-base font-semibold text-text-primary">
                Настройте подборку под себя
              </p>
              <p className="text-base text-text-secondary mt-1">
                Зарегистрируйтесь, чтобы видеть только актуальные для вас документы и управлять списком.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(() => {
            const activeQ = highlightActive ? highlightQuery : null;
            const firstMatchId =
              activeQ?.trim()
                ? currentSteps.find(
                    (step) =>
                      splitHighlightParts(step.text, activeQ).some((p) => p.hit) ||
                      Boolean(
                        step.description &&
                          splitHighlightParts(step.description, activeQ).some((p) => p.hit)
                      )
                  )?.id
                : undefined;

            return currentSteps.map((step) => {
            const done = currentChecked.includes(step.id);
            const isTitle = step.id.includes('title');

            return (
              <div
                key={step.id}
                ref={step.id === firstMatchId ? firstHitRef : undefined}
                className={`flex flex-col gap-1 p-4 rounded-xl border-2 transition-all ${
                  isTitle
                    ? 'border-primary/30 bg-primary/5'
                    : done
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-border bg-white hover:border-primary/30 hover:shadow-md'
                } ${step.isSubStep ? 'ml-8' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {!isTitle && (
                    <button
                      onClick={() => void handleToggleStep(step)}
                      className="shrink-0 mt-1"
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          done ? 'bg-violet-500 border-violet-500' : 'border-border-dark'
                        }`}
                      >
                        {done && (
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
                    </button>
                  )}
                  {isTitle && <div className="w-5 shrink-0" />}

                  <div className="flex-1">
                    <HighlightedText
                      text={step.text}
                      query={activeQ}
                      className={`${
                        isTitle
                          ? 'text-lg font-bold text-primary'
                          : `text-base ${done ? 'text-text-muted line-through' : 'text-text-primary'}`
                      } leading-relaxed`}
                    />

                    {step.description && (
                      <HighlightedText
                        text={step.description}
                        query={activeQ}
                        className={`block text-sm ${isTitle ? 'text-text-secondary' : 'text-text-muted'} mt-1 ${done ? 'opacity-70' : ''}`}
                      />
                    )}

                    {step.link && (
                      <button
                        onClick={() => handleLinkClick(step.link!)}
                        className="mt-2 text-sm text-primary font-medium hover:text-primary-dark transition-colors inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {step.link.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          });
          })()}
        </div>
      </div>
    </div>
  );
};

export default Step3Page;
