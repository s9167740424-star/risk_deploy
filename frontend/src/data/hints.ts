export type LinkRef = { type: 'helpful' | 'algorithm'; id: string } | null;

export interface HintTemplate {
  impact: string;
  tip: string;
  link?: LinkRef;
}

export interface ValueAwareHint extends HintTemplate {
  byValue?: Record<string, Partial<HintTemplate>>;
}

export interface HintContext {
  name?: string;
  distance?: string;
  value?: string;
}

interface HintsFile {
  surroundings: Record<string, HintTemplate>;
  surroundingFallback: Record<'plus' | 'minus', HintTemplate>;
  legal: Record<string, ValueAwareHint>;
  legalFallback: HintTemplate;
  legalUnavailable: HintTemplate;
}

let hints: HintsFile | null = null;
let loadPromise: Promise<void> | null = null;

const EMPTY: HintTemplate = {
  impact: '',
  tip: '',
  link: null,
};

export function loadHints(): Promise<void> {
  if (hints) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/hints/hints.json')
    .then((res) => {
      if (!res.ok) throw new Error(`hints.json: ${res.status}`);
      return res.json() as Promise<HintsFile>;
    })
    .then((data) => {
      hints = data;
    })
    .catch(() => {
      hints = {
        surroundings: {},
        surroundingFallback: { plus: EMPTY, minus: EMPTY },
        legal: {},
        legalFallback: EMPTY,
        legalUnavailable: EMPTY,
      };
    });

  return loadPromise;
}

export function getLegalUnavailable(): HintTemplate {
  return hints?.legalUnavailable ?? EMPTY;
}

function fill(template: string, ctx: HintContext): string {
  return template
    .replace(/\{name\}/g, ctx.name ?? '')
    .replace(/\{distance\}/g, ctx.distance ?? '')
    .replace(/\{value\}/g, ctx.value ?? '');
}

export function resolveSurroundingHint(
  kind: string | undefined,
  type: 'plus' | 'minus',
  ctx: HintContext,
  override?: Partial<HintTemplate>
): HintTemplate {
  const base =
    (kind && hints?.surroundings[kind]) ||
    hints?.surroundingFallback[type] ||
    EMPTY;

  return {
    impact: override?.impact || fill(base.impact, ctx),
    tip: override?.tip || fill(base.tip, ctx),
    link: override?.link ?? base.link ?? null,
  };
}

export function resolveLegalHint(
  field: string,
  value: string | null | undefined,
  options?: { unavailable?: boolean }
): HintTemplate {
  if (options?.unavailable) return getLegalUnavailable();

  const entry = hints?.legal[field];
  if (!entry) return hints?.legalFallback ?? EMPTY;

  const ctx: HintContext = { value: value ?? '' };
  let impact = entry.impact;
  let tip = entry.tip;
  let link = entry.link ?? null;

  if (entry.byValue && value) {
    const needle = value.toLowerCase();
    for (const [marker, patch] of Object.entries(entry.byValue)) {
      if (needle.includes(marker)) {
        impact = patch.impact ?? impact;
        tip = patch.tip ?? tip;
        link = patch.link !== undefined ? patch.link : link;
        break;
      }
    }
  }

  return { impact: fill(impact, ctx), tip: fill(tip, ctx), link };
}

export const LEGAL_UNAVAILABLE = {
  get impact() {
    return getLegalUnavailable().impact;
  },
  get tip() {
    return getLegalUnavailable().tip;
  },
  get link() {
    return getLegalUnavailable().link ?? null;
  },
};
