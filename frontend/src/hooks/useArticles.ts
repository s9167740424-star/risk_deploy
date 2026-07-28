import { useEffect, useState } from 'react';
import { materialsApi } from '@/api';
import type { ArticleManifest } from '@/types';

export type ArticleItem = ArticleManifest & {
  numericId: number;
  fileUrl: string;
  slug: string;
};

export function useArticles() {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    materialsApi
      .getAll()
      .then((res) => {
        if (cancelled) return;
        const items: ArticleItem[] = (res.data.items || []).map(
          (m: {
            id: number;
            slug: string;
            title: string;
            description?: string;
            summary?: string;
            keyPoints?: string[];
            fileName?: string;
            fileUrl?: string;
          }) => ({
            id: m.slug,
            numericId: m.id,
            slug: m.slug,
            title: m.title,
            description: m.description || m.summary || '',
            keyPoints: m.keyPoints || [],
            fileName: m.fileName || '',
            fileUrl: m.fileUrl || materialsApi.fileUrl(m.id),
          })
        );
        setArticles(items);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setArticles([]);
          setError(
            err instanceof Error ? err.message : 'Ошибка загрузки материалов'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { articles, loading, error };
}
