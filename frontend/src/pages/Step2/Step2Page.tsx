import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  MapPin,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { coordsKey, readCache, writeCache } from '@/utils/geoCache';
import { useNavigationStore } from '@/store/navigationStore';
import { documentsApi, mapApi, userGeoApi } from '@/api';
import {
  mapBackendDocument,
  mapBackendDocumentSource,
  mapBackendPlaceCategory,
} from '@/api/mappers';
import type { DocumentItem, DocumentSource, PlaceCategory } from '@/types';

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDocsList(docs: DocumentItem[]): string {
  return docs
    .map((doc, i) => {
      const lines = [`${i + 1}. ${doc.title}${doc.required ? ' (обязательно)' : ''}`];
      doc.note.forEach((n) => lines.push(`   ${n}`));
      return lines.join('\n');
    })
    .join('\n\n');
}

function buildSourceDownloadContent(source: DocumentSource, docs: DocumentItem[]): string {
  return [source.downloadHeader, '', 'Список документов:', '', formatDocsList(docs), ''].join(
    '\n'
  );
}

function buildAllSourcesDownloadContent(
  groups: { source: DocumentSource; docs: DocumentItem[] }[]
): string {
  const parts = [
    'Полный список документов для продажи недвижимости',
    'Документы сгруппированы по местам получения.',
    '',
  ];
  groups.forEach(({ source, docs }, index) => {
    if (index > 0) parts.push('', '─'.repeat(40), '');
    parts.push(source.downloadHeader, '', 'Список документов:', '', formatDocsList(docs));
  });
  parts.push('');
  return parts.join('\n');
}

const docKey = (doc: DocumentItem) => (doc.id != null ? String(doc.id) : doc.title);

const OFFICE_FALLBACK = [
  {
    id: 'mfc',
    title: 'МФЦ',
    subtitle: 'Центры «Мои документы» рядом с объектом',
    allMapButton: 'Открыть все МФЦ на карте',
    emptyText: 'Ближайшие МФЦ не найдены.',
    searchText: 'МФЦ',
  },
  {
    id: 'rosreestr_office',
    title: 'Росреестр / кадастровая палата',
    subtitle: 'Офисы для подачи и получения документов',
    allMapButton: 'Открыть все офисы Росреестра на карте',
    emptyText: 'Ближайшие офисы Росреестра не найдены.',
    searchText: 'Росреестр',
  },
] as const;

const NEARBY_SHOW_LIMIT = 2;

function yandexSearchNearUrl(
  center: { latitude: number; longitude: number },
  searchText: string,
  zoom = 14
): string {
  return (
    'https://yandex.ru/maps/?' +
    `ll=${center.longitude},${center.latitude}&z=${zoom}` +
    `&text=${encodeURIComponent(searchText)}`
  );
}

/** Карта с одной отмеченной точкой офиса. */
function yandexPlaceUrl(
  place: { latitude: number | null; longitude: number | null; name: string },
  zoom = 16
): string | null {
  if (place.latitude == null || place.longitude == null) return null;
  const pt = `${place.longitude},${place.latitude},pm2rdm`;
  return (
    'https://yandex.ru/maps/?' +
    `ll=${place.longitude},${place.latitude}&z=${zoom}` +
    `&pt=${pt}` +
    `&text=${encodeURIComponent(place.name)}`
  );
}

const Step2Page: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { checkedDocuments, toggleDocument, setCheckedDocuments } = useAppStore();
  const { algorithmsBackRoute, setAlgorithmsBackRoute, setMaterialsBackRoute } =
    useNavigationStore();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentSources, setDocumentSources] = useState<DocumentSource[]>([]);
  const selectedLocation = useAppStore((s) => s.selectedLocation);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [placeCategories, setPlaceCategories] = useState<PlaceCategory[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesFailed, setPlacesFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const docsRes = await documentsApi.getAll();
        if (cancelled) return;
        const mapped: Array<DocumentItem & { collected: boolean }> = (
          docsRes.data.items || []
        ).map((item: any) => mapBackendDocument(item));
        setDocuments(mapped);
        setCheckedDocuments(
          mapped
            .filter((d: DocumentItem & { collected: boolean }) => d.collected)
            .map((d) => docKey(d))
        );
        setDocumentSources((docsRes.data.sources || []).map(mapBackendDocumentSource));
      } catch {
        if (!cancelled) setLoadError('Не удалось загрузить документы с сервера');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setCheckedDocuments]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedLocation) {
      setPlaceCategories([]);
      setPlacesFailed(false);
      setPlacesLoading(false);
      return;
    }

    (async () => {
      setPlacesLoading(true);
      setPlacesFailed(false);

      const officesKey = coordsKey(
        selectedLocation.latitude,
        selectedLocation.longitude
      );

      let cachedOffices = readCache<any>('offices', officesKey);

      if (!cachedOffices && isAuthenticated) {
        try {
          const { data } = await userGeoApi.get();
          const state = data.state;
          if (
            state?.offices &&
            state.latitude != null &&
            state.longitude != null &&
            coordsKey(state.latitude, state.longitude) === officesKey
          ) {
            cachedOffices = state.offices;
          }
        } catch {
          // ignore
        }
      }

      if (cancelled) return;

      if (cachedOffices) {
        setPlaceCategories((cachedOffices.categories || []).map(mapBackendPlaceCategory));
        setPlacesFailed(Boolean(cachedOffices.failed));
        setPlacesLoading(false);
        return;
      }

      const persistOffices = (officesData: Record<string, unknown>) => {
        writeCache('offices', officesKey, officesData);
        if (!isAuthenticated) return;
        void userGeoApi
          .save({
            address: selectedLocation.address,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            offices: officesData,
          })
          .catch(() => undefined);
      };

      const emptyOfficesPayload = (failed: boolean) => ({
        source: failed ? 'error' : 'none',
        center: {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        },
        categories: [
          {
            id: 'mfc',
            title: 'МФЦ',
            subtitle: 'Центры «Мои документы» рядом с объектом',
            places: [],
          },
          {
            id: 'rosreestr_office',
            title: 'Росреестр / кадастровая палата',
            subtitle: 'Офисы для подачи и получения документов',
            places: [],
          },
        ],
        failed,
        radius_m: null,
        searchedAt: new Date().toISOString(),
      });

      try {
        const placesRes = await mapApi.getOffices(
          selectedLocation.latitude,
          selectedLocation.longitude
        );
        if (cancelled) return;
        const officesData = {
          ...(placesRes.data || emptyOfficesPayload(true)),
          searchedAt: new Date().toISOString(),
        };
        setPlaceCategories((officesData.categories || []).map(mapBackendPlaceCategory));
        setPlacesFailed(Boolean(officesData.failed));
        persistOffices(officesData);
      } catch {
        if (!cancelled) {
          const failedPayload = emptyOfficesPayload(true);
          setPlaceCategories(
            (failedPayload.categories || []).map(mapBackendPlaceCategory)
          );
          setPlacesFailed(true);
          persistOffices(failedPayload);
        }
      } finally {
        if (!cancelled) setPlacesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selectedLocation]);

  const documentGroups = documentSources
    .map((source) => ({
      source,
      docs: documents.filter((d) => d.sourceId === source.id),
    }))
    .filter((g) => g.docs.length > 0);

  const navigateTo = (path: string, docTitle: string, type: 'materials' | 'algorithms') => {
    const label = `Назад к «${docTitle}»`;
    if (type === 'materials') {
      setMaterialsBackRoute({ path: '/app/step2', label });
    } else {
      setAlgorithmsBackRoute({ path: '/app/step2', label });
    }
    navigate(path);
  };

  const handleBackClick = () => {
    if (algorithmsBackRoute) {
      navigate(algorithmsBackRoute.path, { state: algorithmsBackRoute.state });
      setAlgorithmsBackRoute(null);
    }
  };

  const handleToggle = async (doc: DocumentItem) => {
    const key = docKey(doc);
    if (isAuthenticated && doc.id != null) {
      try {
        await documentsApi.toggleDocument(doc.id);
      } catch {
        return;
      }
    }
    toggleDocument(key);
  };

  const handlePrevStep = () => navigate('/app/step1');
  const handleNextStep = () => navigate('/app/step3');

  const downloadSourceList = (source: DocumentSource, docs: DocumentItem[]) => {
    downloadTextFile(`документы_${source.id}.txt`, buildSourceDownloadContent(source, docs));
  };

  const downloadAllLists = () => {
    downloadTextFile('документы_все_места.txt', buildAllSourcesDownloadContent(documentGroups));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted font-medium">Загрузка документов…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
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

        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-primary font-bold mb-1">Шаг 2</p>
            <h2 className="text-2xl font-bold font-display text-text-primary mb-2">
              Документы для продажи
            </h2>
            <p className="text-base text-text-secondary">
              Отметьте документы, которые уже собраны. Списки сгруппированы по местам получения.
            </p>
            {loadError && <p className="text-sm text-red-600 mt-2">{loadError}</p>}
          </div>
          {documentGroups.length > 0 && (
            <button
              onClick={downloadAllLists}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-text-secondary font-medium rounded-lg border-2 border-border hover:border-primary/30 hover:bg-slate-50 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Скачать все списки
            </button>
          )}
        </div>

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

        <div className="space-y-8">
          {documentGroups.map(({ source, docs }) => (
            <section key={source.id} className="relative">
              <div className="flex items-start justify-between gap-3 mb-3 pb-2 border-b-2 border-border">
                <div className="flex-1">
                  <h3 className="text-sm uppercase tracking-wider text-primary font-bold">
                    {source.title}
                  </h3>
                  {source.downloadHeader && (
                    <p className="text-sm text-text-muted mt-1 leading-relaxed">
                      {source.downloadHeader}
                    </p>
                  )}
                  <p className="text-sm text-text-muted mt-0.5">
                    {docs.length}{' '}
                    {docs.length === 1 ? 'документ' : docs.length < 5 ? 'документа' : 'документов'}
                  </p>
                </div>
                <button
                  onClick={() => downloadSourceList(source, docs)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-primary bg-slate-50 border border-border rounded-lg hover:border-primary/30 transition-colors"
                  title={`Скачать список: ${source.title}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Скачать список
                </button>
              </div>

              <div className="space-y-2 pl-3 border-l-2 border-primary/20">
                {docs.map((doc) => {
                  const key = docKey(doc);
                  const done = checkedDocuments.includes(key);
                  return (
                    <div
                      key={key}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                        done
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-border bg-white hover:border-primary/30 hover:shadow-md'
                      }`}
                    >
                      <button onClick={() => void handleToggle(doc)} className="shrink-0 mt-1">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            done ? 'bg-emerald-500 border-emerald-500' : 'border-border-dark'
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
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`text-base font-semibold ${
                              done ? 'text-text-muted line-through' : 'text-text-primary'
                            }`}
                          >
                            {doc.title}
                          </span>
                          {doc.required && !done && (
                            <span className="text-xs uppercase tracking-wider text-amber-700 font-bold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg">
                              обязательно
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-text-secondary space-y-1">
                          {doc.note.map((line, index) => (
                            <p key={index}>{line}</p>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {doc.algorithmId && (
                            <button
                              onClick={() =>
                                navigateTo(
                                  `/app/step3?algorithm=${doc.algorithmId!}`,
                                  doc.title,
                                  'algorithms'
                                )
                              }
                              className="text-sm text-primary font-semibold hover:text-primary-dark bg-primary/10 border border-primary/30 rounded-lg px-3 py-1"
                            >
                              Инструкция →
                            </button>
                          )}
                          {doc.articleId && (
                            <button
                              onClick={() =>
                                navigateTo(
                                  `/app/materials?article=${doc.articleId!}`,
                                  doc.title,
                                  'materials'
                                )
                              }
                              className="text-sm text-text-secondary font-medium hover:text-primary bg-slate-50 border border-border rounded-lg px-3 py-1"
                            >
                              В журнал →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t-2 border-border">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-base text-text-secondary font-medium">
              Собрано: {checkedDocuments.length} / {documents.length || 1}
            </span>
            <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    documents.length
                      ? (checkedDocuments.length / documents.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <span className="text-base text-emerald-600 font-bold">
              {documents.length
                ? Math.round((checkedDocuments.length / documents.length) * 100)
                : 0}
              %
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handlePrevStep}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-text-secondary font-medium rounded-lg border-2 border-border hover:border-primary/30 hover:bg-slate-50 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Предыдущий шаг
            </button>
            <button
              onClick={handleNextStep}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-md hover:shadow-lg text-sm"
            >
              Следующий шаг
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="w-72 shrink-0 bg-white border-l-2 border-border p-6 overflow-y-auto">
        {!selectedLocation && (
          <p className="text-sm text-text-muted">
            Выберите объект на Шаге 1 — здесь появятся ближайшие МФЦ
            и офисы Росреестра.
          </p>
        )}
        {selectedLocation && (
          <div className="space-y-6">
            <p className="text-sm text-text-secondary">
              Вокруг: {selectedLocation.address}
            </p>
            {placesLoading && (
              <p className="text-sm text-text-muted">Ищем ближайшие офисы…</p>
            )}
            {!placesLoading &&
              placesFailed &&
              placeCategories.every((c) => c.places.length === 0) && (
                <div className="text-sm text-amber-800 bg-amber-50 border-2 border-amber-200 rounded-lg p-3">
                  Не удалось проверить ближайшие офисы. Можно открыть
                  поиск на карте вручную.
                </div>
              )}
            {!placesLoading &&
              OFFICE_FALLBACK.map((fallback) => {
                const category =
                  placeCategories.find((c) => c.id === fallback.id) || null;
                const places = category?.places || [];
                const nearest = places.slice(0, NEARBY_SHOW_LIMIT);
                const allMapUrl = yandexSearchNearUrl(
                  selectedLocation,
                  fallback.searchText
                );

                return (
                  <div key={fallback.id}>
                    <div className="mb-3">
                      <h3 className="text-sm uppercase tracking-wider text-primary font-bold mb-1">
                        {fallback.title}
                      </h3>
                      <p className="text-sm text-text-secondary">{fallback.subtitle}</p>
                    </div>
                    {nearest.length > 0 ? (
                      <ul className="space-y-2 mb-3">
                        {nearest.map((place) => {
                          const placeUrl = yandexPlaceUrl(place);
                          const meta =
                            [place.distance !== '—' ? place.distance : null, place.address]
                              .filter(Boolean)
                              .join(' · ') || '—';

                          if (!placeUrl) {
                            return (
                              <li
                                key={`${place.name}-${place.latitude}-${place.longitude}`}
                                className="text-sm rounded-lg border-2 border-border px-3 py-2"
                              >
                                <p className="font-semibold text-text-primary leading-snug">
                                  {place.name}
                                </p>
                                <p className="text-text-muted text-xs mt-0.5">{meta}</p>
                              </li>
                            );
                          }

                          return (
                            <li key={`${place.name}-${place.latitude}-${place.longitude}`}>
                              <a
                                href={placeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm rounded-lg border-2 border-border px-3 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                              >
                                <p className="font-semibold text-primary leading-snug">
                                  {place.name}
                                </p>
                                <p className="text-text-muted text-xs mt-0.5">{meta}</p>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-text-muted mb-3">{fallback.emptyText}</p>
                    )}
                    <a
                      href={allMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 hover:border-primary transition-colors"
                    >
                      <MapPin className="w-4 h-4 shrink-0" />
                      {fallback.allMapButton}
                    </a>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Step2Page;
