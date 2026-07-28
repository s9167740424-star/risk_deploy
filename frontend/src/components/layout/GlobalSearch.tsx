import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, FileText, ListChecks, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchApi, type SearchHit } from '@/api';

const DEBOUNCE_MS = 280;

interface GlobalSearchProps {
  className?: string;
  beforeNavigate?: () => void | Promise<void>;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({
  className = 'relative flex-1 max-w-xl mx-4',
  beforeNavigate,
}) => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  const runSearch = useCallback(async (value: string) => {
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const { data } = await searchApi.query(q);
      if (reqId !== reqIdRef.current) return;
      setResults(data.items || []);
    } catch {
      if (reqId !== reqIdRef.current) return;
      setResults([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void runSearch(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const goTo = async (hit: SearchHit) => {
    const q = query.trim();
    setOpen(false);
    setQuery('');
    setResults([]);
    if (beforeNavigate) await beforeNavigate();
    const qParam = q ? `&q=${encodeURIComponent(q)}` : '';
    if (hit.type === 'article') {
      navigate(`/app/materials?article=${encodeURIComponent(hit.id)}${qParam}`);
    } else {
      navigate(`/app/step3?algorithm=${encodeURIComponent(hit.id)}${qParam}`);
    }
  };

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Поиск по журналу и пошаговым инструкциям…"
          className="w-full h-9 pl-9 pr-9 rounded-lg border-2 border-border bg-slate-50 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:bg-white transition-colors"
          aria-label="Поиск по журналу и пошаговым инструкциям"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
            aria-label="Очистить поиск"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border-2 border-border bg-white shadow-lg overflow-hidden">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Ищем…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-text-muted">
              Ничего не найдено. Попробуйте другие слова.
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((hit) => (
                <li key={`${hit.type}:${hit.id}`}>
                  <button
                    type="button"
                    onClick={() => void goTo(hit)}
                    className="w-full text-left px-4 py-2.5 hover:bg-primary/5 flex items-start gap-3 transition-colors"
                  >
                    <span className="mt-0.5 shrink-0 text-primary">
                      {hit.type === 'article' ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <ListChecks className="w-4 h-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-text-primary truncate">
                        {hit.title}
                      </span>
                      <span className="block text-xs text-text-muted mt-0.5">
                        {hit.type === 'article' ? 'Журнал' : 'Пошаговые инструкции'}
                        {hit.subtitle ? ` · ${hit.subtitle}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
