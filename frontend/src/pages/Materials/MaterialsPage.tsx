import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lightbulb, ChevronLeft, ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useNavigationStore } from '@/store/navigationStore';
import { useArticles } from '@/hooks/useArticles';
import DocxArticleViewer from '@/components/articles/DocxArticleViewer';

const MaterialsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const articleId = searchParams.get('article');
  const highlightQuery = searchParams.get('q');
  const [hlActive, setHlActive] = useState(Boolean(highlightQuery?.trim()));

  const { articles, loading, error } = useArticles();
  const [selectedArticleId, setSelectedArticleId] = useState('');

  const { materialsBackRoute, setMaterialsBackRoute } = useNavigationStore();
  const navigate = useNavigate();

  useEffect(() => {
    setHlActive(Boolean(highlightQuery?.trim()));
  }, [highlightQuery, selectedArticleId]);

  useEffect(() => {
    if (!hlActive) return;
    const clear = () => {
      setHlActive(false);
      const next = new URLSearchParams(searchParams);
      next.delete('q');
      setSearchParams(next, { replace: true });
    };
    document.addEventListener('pointerdown', clear, true);
    return () => document.removeEventListener('pointerdown', clear, true);
  }, [hlActive, searchParams, setSearchParams]);

  useEffect(() => {
    if (articles.length === 0) return;

    const validId =
      articleId && articles.some((a) => a.id === articleId)
        ? articleId
        : articles[0].id;

    setSelectedArticleId(validId);
  }, [articleId, articles]);

  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  const handleSelectArticle = (id: string) => {
    setSelectedArticleId(id);
    const next: Record<string, string> = { article: id };
    if (highlightQuery) next.q = highlightQuery;
    setSearchParams(next, { replace: true });
  };

  const handleBackClick = () => {
    if (materialsBackRoute) {
      navigate(materialsBackRoute.path, {
        state: materialsBackRoute.state,
      });
      setMaterialsBackRoute(null);
    }
  };

  const handlePrevStep = () => {
    navigate('/app/step3');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted font-medium">Загрузка журнала…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="max-w-md rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 font-medium mb-2">{error}</p>
          <p className="text-sm text-red-600">
            Не удалось загрузить статьи с сервера. Проверьте бэкенд и{' '}
            <code className="bg-red-100 px-1 rounded">flask seed-content</code>
            {' '}(docx в <code className="bg-red-100 px-1 rounded">frontend/public/articles/</code>).
          </p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="max-w-md rounded-xl border-2 border-border bg-white p-8 text-center">
          <Lightbulb className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">В журнале пока пусто</h2>
          <p className="text-text-secondary font-medium">
            Добавьте .docx в{' '}
            <code className="bg-slate-100 px-1 rounded">frontend/public/articles/</code>{' '}
            и выполните{' '}
            <code className="bg-slate-100 px-1 rounded">flask --app run.py seed-content</code>
          </p>
        </div>
      </div>
    );
  }

  if (!selectedArticle) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">Статья не найдена</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 bg-white border-r-2 border-border p-4 overflow-y-auto flex flex-col">
        <div className="mb-4">
          <p className="text-sm uppercase tracking-wider text-primary font-bold mb-1">Журнал</p>
          <p className="text-base text-text-secondary font-medium">Статьи, инструкции и рекомендации</p>
        </div>

        <div className="space-y-1 flex-1">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => handleSelectArticle(article.id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-base transition-all duration-200 ${
                selectedArticleId === article.id
                  ? 'bg-primary/10 text-primary border-2 border-primary/30 shadow-md'
                  : 'text-text-secondary hover:bg-slate-50 border-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 shrink-0" />
                <span className="font-medium">{article.title}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={handlePrevStep}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-text-secondary font-medium rounded-lg border-2 border-border hover:border-primary/30 hover:bg-slate-50 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к инструкциям
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {materialsBackRoute && (
          <div className="mb-4">
            <button
              onClick={handleBackClick}
              className="flex items-center gap-2 text-base text-text-secondary hover:text-primary font-medium bg-white border-2 border-border rounded-xl px-4 py-2 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              {materialsBackRoute.label}
            </button>
          </div>
        )}

        <div className="max-w-4xl">
          {selectedArticle.description && (
            <p className="text-lg text-text-secondary font-medium mb-6">
              {selectedArticle.description}
            </p>
          )}

          {selectedArticle.keyPoints.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">
                Ключевые моменты
              </h3>
              <ul className="space-y-1">
                {selectedArticle.keyPoints.map((point, idx) => (
                  <li key={idx} className="text-base text-text-secondary flex items-start gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-900 font-medium leading-relaxed">
                  Материал соответствует законодательству РФ на дату публикации.
                </p>
                <div className="flex items-start gap-2 mt-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Перед совершением сделки сверяйтесь с актуальным законодательством и при необходимости обратитесь за квалифицированной юридической помощью к нам по номеру телефона горяцей линии (+7 ХХХ ХХХ ХХ ХХ).
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DocxArticleViewer
            fileUrl={selectedArticle.fileUrl}
            highlightQuery={hlActive ? highlightQuery : null}
          />
        </div>
      </div>
    </div>
  );
};

export default MaterialsPage;
