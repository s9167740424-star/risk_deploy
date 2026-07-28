import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Save, ExternalLink, Building2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useNavigationStore } from '@/store/navigationStore';
import { surveyApi } from '@/api';
import { mapSurveyToQuestionnaire } from '@/api/mappers';
import type { SurveyStep } from '@/types';

const SurveyPage: React.FC = () => {
  const [steps, setSteps] = useState<SurveyStep[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const { setSurveyCompleted, setSurveyFormData } = useAppStore();
  const { setMaterialsBackRoute, setAlgorithmsBackRoute } = useNavigationStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state) {
      const { stepIndex, formData: savedFormData } = location.state as {
        stepIndex?: number;
        formData?: Record<string, string>;
      };
      if (typeof stepIndex === 'number') setCurrentStepIndex(stepIndex);
      if (savedFormData) setFormData(savedFormData);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const schemaRes = await surveyApi.getSchema();
        if (cancelled) return;
        const loaded = (schemaRes.data?.schema?.steps || []) as SurveyStep[];
        setSteps(loaded);
        if (loaded.length === 0) {
          setSchemaError('Анкета пуста. Выполните flask seed-content.');
        }
      } catch (error) {
        console.error('Ошибка загрузки схемы:', error);
        if (!cancelled) setSchemaError('Не удалось загрузить вопросы анкеты');
      } finally {
        if (!cancelled) setSchemaLoading(false);
      }

      try {
        const { data } = await surveyApi.getData();
        if (cancelled) return;
        if (data.questionnaire?.completed) {
          setSurveyCompleted(true);
          navigate('/app', { replace: true });
          return;
        }
        const answers = data.questionnaire?.answers;
        if (answers && typeof answers === 'object' && Object.keys(answers).length > 0) {
          setFormData((prev) => ({ ...answers, ...prev }));
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, setSurveyCompleted]);

  const currentStep = steps && steps.length > 0 ? steps[currentStepIndex] : null;
  const totalSteps = steps.length;
  const isLastStep = totalSteps > 0 && currentStepIndex === totalSteps - 1;

  const getVisibleQuestions = () => {
    if (!currentStep || !currentStep.questions) return [];
    return currentStep.questions.filter(shouldShowQuestion);
  };

  const shouldShowQuestion = (question: any) => {
    if (!question.condition) return true;
    const { questionId, value } = question.condition;
    return formData[questionId] === value;
  };

  const visibleQuestions = getVisibleQuestions();
  const hasVisibleQuestions = visibleQuestions.length > 0;

  const handleInputChange = (questionId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();

    const allVisibleAnswered = visibleQuestions.every(
      (question) => formData[question.id] && formData[question.id].trim() !== ''
    );

    if (!allVisibleAnswered) {
      alert('Пожалуйста, ответьте на все отображаемые вопросы');
      return;
    }

    if (isLastStep) {
      setIsCompleted(true);
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) setCurrentStepIndex((prev) => prev - 1);
  };

  const handleComplete = async () => {
    setSurveyFormData(formData);
    setSurveyCompleted(true);
    try {
      await surveyApi.submit(mapSurveyToQuestionnaire(formData));
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
    navigate('/app');
  };

  const handleSkip = async () => {
    setSurveyCompleted(true);
    try {
      await surveyApi.submit({ completed: true, current_step: 3 });
    } catch (error) {
      console.error('Ошибка пропуска:', error);
    }
    navigate('/app');
  };

  const handleLinkClick = (type: 'algorithm' | 'helpful', id: string) => {
    const backRoute = {
      path: '/survey',
      label: 'Вернуться к анкете',
      state: {
        stepIndex: currentStepIndex,
        formData: formData,
      },
    };

    if (type === 'helpful') {
      setMaterialsBackRoute(backRoute);
      navigate(`/app/materials?article=${id}`);
    } else {
      setAlgorithmsBackRoute(backRoute);
      navigate(`/app/step3?algorithm=${id}`);
    }
  };

  if (schemaLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted font-medium">Загрузка анкеты…</p>
      </div>
    );
  }

  if (schemaError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-border p-8 text-center">
          <p className="text-base text-text-secondary mb-4">{schemaError}</p>
          <button onClick={() => navigate('/app')} className="btn-primary">
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-border p-8 text-center">
          <p className="text-base text-text-secondary mb-4">Вопросы анкеты не найдены</p>
          <button onClick={() => navigate('/app')} className="btn-primary">
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-border p-8 text-center">
          <p className="text-base text-text-secondary mb-4">Текущий шаг не найден</p>
          <button onClick={() => navigate('/app')} className="btn-primary">
            На главную
          </button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="bg-white border-b-2 border-border px-6 py-3 flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" strokeWidth={1.5} />
          <span className="font-display font-semibold text-lg text-text-primary">Атлас продаж</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border-2 border-border p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-primary" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold font-display text-text-primary mb-3">Анкета заполнена!</h2>
            <p className="text-base text-text-secondary mb-8">
              Теперь вам доступны персональные рекомендации.
            </p>
            <button onClick={handleComplete} className="btn-primary w-full text-base">
              Последний шаг: выбрать свой объект.
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-white border-b-2 border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" strokeWidth={1.5} />
          <span className="font-display font-semibold text-lg text-text-primary">Атлас продаж</span>
        </div>
        <button
          onClick={handleSkip}
          className="text-base text-text-secondary hover:text-primary font-medium flex items-center gap-1"
        >
          Пропустить анкету <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex items-start justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border-2 border-border p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm uppercase tracking-wider text-primary font-bold">Анкетирование</span>
              <span className="text-base text-text-secondary font-semibold">
                Шаг {currentStep.id} из {totalSteps}
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <h2 className="text-xl font-bold font-display text-text-primary mb-2">{currentStep.title}</h2>
          <p className="text-base text-text-secondary mb-8">{currentStep.subtitle}</p>

          {!hasVisibleQuestions && (
            <div className="text-center py-8 text-text-secondary">
              <p>Нет доступных вопросов для отображения</p>
            </div>
          )}

          <form onSubmit={handleNext} className="space-y-8">
            {visibleQuestions.map((question) => (
              <div key={question.id}>
                <p className="text-base font-semibold text-text-primary mb-4">{question.label}</p>
                <div className="space-y-3">
                  {question.options.map((option) => {
                    const isChecked = formData[question.id] === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isChecked
                            ? 'border-primary bg-primary/5 shadow-md'
                            : 'border-border hover:border-primary/50 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.value}
                          checked={isChecked}
                          onChange={() => handleInputChange(question.id, option.value)}
                          className="sr-only"
                          required
                        />
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isChecked ? 'border-primary' : 'border-border-dark'
                          }`}
                        >
                          {isChecked && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-base text-text-primary">{option.label}</span>
                      </label>
                    );
                  })}
                </div>

                {(question.tip || question.links) && (
                  <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                    {question.tip && (
                      <p className="text-base text-text-secondary leading-relaxed mb-3">{question.tip}</p>
                    )}
                    {question.links && (
                      <div className="flex flex-wrap gap-2">
                        {question.links.map((link, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleLinkClick(link.type, link.id)}
                            className="text-sm text-primary font-semibold hover:text-primary-dark bg-white border-2 border-primary/30 rounded-lg px-3 py-2 inline-flex items-center gap-1"
                          >
                            {link.label} <ExternalLink className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {hasVisibleQuestions && (
              <div className="flex items-center gap-3 pt-6 border-t-2 border-border">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex items-center gap-2 text-base text-text-secondary hover:text-primary font-medium border-2 border-border rounded-lg px-5 py-3"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Назад
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-base ml-auto"
                >
                  {isLastStep ? (
                    <>
                      <Save className="w-5 h-5" /> Завершить
                    </>
                  ) : (
                    <>
                      Далее <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default SurveyPage;
