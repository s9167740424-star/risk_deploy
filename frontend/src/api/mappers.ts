import axios from 'axios';
import { resolveLegalHint, resolveSurroundingHint, getLegalUnavailable } from '@/data/hints';
import type {
  AlgorithmGroup,
  DocumentItem,
  DocumentSource,
  PlaceCategory,
  PlaceItem,
  Property,
  SurroundingItem,
} from '@/types';

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  apartment: 'Квартира',
  house: 'Дом',
  commercial: 'Коммерческая',
};

const LEGAL_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'cadastral_number', label: 'Кадастровый номер' },
  { key: 'area', label: 'Площадь объекта' },
  { key: 'land_category', label: 'Категория земель' },
  { key: 'permitted_use', label: 'Разрешённое использование' },
  { key: 'ownership_type', label: 'Форма собственности' },
  { key: 'status', label: 'Статус записи в ЕГРН' },
  { key: 'cost', label: 'Кадастровая стоимость' },
  { key: 'encumbrances', label: 'Обременения и ограничения' },
];

function buildCadastralLegal(cadastral: Record<string, any>) {
  const publicItems = LEGAL_FIELDS.map(({ key, label }) => {
    const value = cadastral?.[key];
    const hasValue = value != null && String(value).trim() !== '';
    const hint = resolveLegalHint(key, hasValue ? String(value) : null, {
      unavailable: !hasValue,
    });

    return {
      label,
      value: hasValue ? String(value) : '—',
      impact: hint.impact,
      tip: hint.tip,
      link: hint.link ?? null,
    };
  });

  const extraItems = Object.entries(cadastral?.extra || {}).map(([label, value]) => ({
    label,
    value: String(value),
    impact: getLegalUnavailable().impact,
    tip: 'Поле получено из публичной кадастровой карты. Сверьте с выпиской ЕГРН.',
    link: null,
  }));

  return [...publicItems, ...extraItems];
}

function displayArea(value: unknown): string {
  if (value == null || String(value).trim() === '') return '—';
  if (typeof value === 'number') return `${value} м²`;

  const text = String(value).trim();
  if (/м²|кв\.?\s*м/i.test(text)) return text;
  return `${text} м²`;
}

export function mapBackendUser(raw: {
  id: number;
  email: string;
  full_name: string;
}) {
  return {
    id: String(raw.id),
    email: raw.email,
    fullName: raw.full_name,
    isAuthenticated: true,
    isGuest: false,
  };
}

export function mapBackendDocument(raw: {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  obtain_algorithm?: string | null;
  notes?: string[];
  note?: string[];
  is_required?: boolean;
  required?: boolean;
  sourceId?: string;
  algorithmId?: string | null;
  articleId?: string | null;
  collected?: boolean;
}): DocumentItem & { id: number; code: string; collected: boolean } {
  const note =
    raw.notes ||
    raw.note ||
    [raw.description, raw.obtain_algorithm].filter(
      (x): x is string => Boolean(x && String(x).trim())
    );
  return {
    id: raw.id,
    code: raw.code,
    title: raw.title,
    note: note.length ? note : [raw.title],
    required: Boolean(raw.required ?? raw.is_required ?? true),
    sourceId: raw.sourceId || 'on_hand',
    algorithmId: raw.algorithmId ?? null,
    articleId: raw.articleId ?? null,
    collected: Boolean(raw.collected),
  };
}

export function mapBackendDocumentSource(raw: {
  id: string;
  title: string;
  downloadHeader?: string;
  download_header?: string;
}): DocumentSource {
  return {
    id: raw.id,
    title: raw.title,
    downloadHeader: raw.downloadHeader || raw.download_header || '',
  };
}

function formatDistance(distance_m: number): string {
  return distance_m >= 1000
    ? `${(distance_m / 1000).toFixed(1)} км`
    : `${distance_m} м`;
}

export function mapBackendSurrounding(raw: {
  kind?: string;
  name: string;
  type?: 'plus' | 'minus';
  category?: string;
  distance_m: number;
  impact?: string;
  tip?: string;
  link?: { type: 'helpful' | 'algorithm'; id: string } | null;
}): SurroundingItem {
  const isPlus = raw.type === 'plus' || raw.category === 'positive';
  const type = isPlus ? 'plus' : 'minus';
  const distance = formatDistance(raw.distance_m);

  const hint = resolveSurroundingHint(
    raw.kind,
    type,
    { name: raw.name, distance },
    { impact: raw.impact, tip: raw.tip, link: raw.link }
  );

  return {
    text: `${raw.name} — ${distance}`,
    type,
    impact: hint.impact,
    tip: hint.tip,
    link: hint.link ?? null,
  };
}

export function mapBackendPlaceCategory(raw: {
  id: string;
  title: string;
  subtitle?: string;
  places?: Array<{
    name: string;
    address: string;
    working_hours?: string;
    distance_m?: number;
    latitude?: number;
    longitude?: number;
  }>;
}): PlaceCategory {
  const places: PlaceItem[] = (raw.places || []).map((p) => ({
    name: p.name,
    address: p.address,
    time: p.working_hours || '—',
    distance: p.distance_m != null ? formatDistance(p.distance_m) : '—',
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  }));
  return {
    id: raw.id,
    title: raw.title,
    subtitle: raw.subtitle || '',
    places,
  };
}

export function mapBackendProperty(
  raw: {
    id?: number;
    property_id?: number;
    address: string;
    cadastral_number?: string | null;
    area?: number | null;
    property_type?: string | null;
    ownership_type?: string | null;
    boundaries_status?: string | null;
    land_category?: string | null;
    permitted_use?: string | null;
    encumbrances?: string | null;
    owner_name?: string | null;
    checked_at?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    source?: string;
    cadastral?: Record<string, any> | null;
    nearby_objects?: Array<{
      kind: string;
      name: string;
      category: string;
      distance_m: number;
      latitude?: number | null;
      longitude?: number | null;
    }>;
  },
  options?: {
    surroundings?: SurroundingItem[];
  }
): Property {
  const id = raw.id ?? raw.property_id ?? 0;
  const surroundings: SurroundingItem[] =
    options?.surroundings ||
    (raw.nearby_objects || []).map((obj) =>
      mapBackendSurrounding({
        kind: obj.kind,
        name: obj.name,
        category: obj.category,
        distance_m: obj.distance_m,
      })
    );

  const cadastral = raw.cadastral;

  if (cadastral) {
    return {
      id,
      latitude: raw.latitude ?? null,
      longitude: raw.longitude ?? null,
      address: raw.address,
      type: cadastral.permitted_use
        ? String(cadastral.permitted_use)
        : 'Не определён',
      area: displayArea(cadastral.area ?? raw.area),
      source: 'rosreestr_parser',
      legal: {
        public: buildCadastralLegal(cadastral),
        private: [],
      },
      surroundings: Array.isArray(surroundings) ? surroundings : [],
    };
  }

  return {
    id,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    address: raw.address,
    type: PROPERTY_TYPE_LABEL[raw.property_type || ''] || raw.property_type || 'Объект',
    area: raw.area != null ? `${raw.area} м²` : '—',
    source: raw.source || 'demo',
    legal: {
      public: [
        { label: 'Кадастровый номер', value: raw.cadastral_number || '—' },
        { label: 'Граница и координаты', value: raw.boundaries_status || '—' },
        { label: 'Площадь объекта', value: raw.area != null ? `${raw.area} кв.м` : '—' },
        {
          label: 'Категория земель и ВРИ',
          value: [raw.land_category, raw.permitted_use].filter(Boolean).join(', ') || '—',
        },
        { label: 'Форма собственности', value: raw.ownership_type || '—' },
        { label: 'Обременения и ограничения', value: raw.encumbrances || '—' },
      ],
      private: [
        { label: 'Собственник', value: raw.owner_name || '—' },
        { label: 'Дата проверки', value: raw.checked_at || '—' },
      ],
    },
    surroundings: Array.isArray(surroundings) ? surroundings : [],
  };
}

export function mapBackendAlgorithmList(
  items: Array<{
    id: number;
    code: string;
    title: string;
    description?: string | null;
  }>
): { groups: AlgorithmGroup[]; codeToNumericId: Record<string, number> } {
  const codeToNumericId: Record<string, number> = {};
  const groups: AlgorithmGroup[] = items.map((algo) => {
    codeToNumericId[algo.code] = algo.id;
    return {
      id: algo.code,
      title: algo.title,
      algorithms: [
        {
          id: algo.code,
          displayTitle: algo.title,
          subtitle: algo.description || '',
          steps: [],
        },
      ],
    };
  });
  return { groups, codeToNumericId };
}

export function mapBackendAlgorithmDetail(algo: {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  steps: Array<{
    id: number;
    title: string;
    description?: string | null;
    completed?: boolean;
  }>;
}): {
  group: AlgorithmGroup;
  checkedStepIds: string[];
  numericId: number;
} {
  return {
    numericId: algo.id,
    checkedStepIds: algo.steps.filter((s) => s.completed).map((s) => String(s.id)),
    group: {
      id: algo.code,
      title: algo.title,
      algorithms: [
        {
          id: algo.code,
          displayTitle: algo.title,
          subtitle: algo.description || '',
          steps: algo.steps.map((s) => ({
            id: String(s.id),
            text: s.title,
            description: s.description || undefined,
          })),
        },
      ],
    },
  };
}

export function mapSurveyToQuestionnaire(
  formData: Record<string, string>
): Record<string, unknown> {
  const propertyTypeMap: Record<string, string> = {
    apartment_house: 'apartment',
    land: 'house',
    share: 'apartment',
    commercial: 'commercial',
  };
  const ownersMap: Record<string, string> = {
    '1': 'one',
    '2+': 'multiple',
  };

  const payload: Record<string, unknown> = {
    completed: true,
    current_step: 3,
    answers: { ...formData },
  };

  if (formData.propertyType && propertyTypeMap[formData.propertyType]) {
    payload.property_type = propertyTypeMap[formData.propertyType];
  }
  if (formData.ownersCount && ownersMap[formData.ownersCount]) {
    payload.owners_count = ownersMap[formData.ownersCount];
  }
  if (formData.maternityCapital === 'yes') payload.maternity_capital = true;
  if (formData.maternityCapital === 'no') payload.maternity_capital = false;
  if (formData.redevelopment === 'yes') payload.redevelopment = 'unauthorized';
  if (formData.redevelopment === 'no') payload.redevelopment = 'none';

  return payload;
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: string; min_length?: number }
      | undefined;
    const code = data?.error;
    const map: Record<string, string> = {
      invalid_credentials: 'Неверный email или пароль',
      email_already_exists: 'Пользователь с таким email уже зарегистрирован',
      invalid_email: 'Некорректный email',
      invalid_full_name: 'Введите корректное ФИО',
      password_too_short: `Пароль должен быть не менее ${data?.min_length ?? 8} символов`,
      authentication_required: 'Требуется авторизация',
    };
    if (code && map[code]) return map[code];
    if (typeof code === 'string') return code;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
