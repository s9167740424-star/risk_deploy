import React, { useEffect, useRef, useState } from 'react';

export interface MapMarker {
  type: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  kind?: string;
  distance_m?: number;
  propertyId?: number;
}

export interface MapCenter {
  latitude: number;
  longitude: number;
}

interface MapViewProps {
  center: MapCenter | null;
  markers?: MapMarker[];
  selected?: boolean;
  clickedPoint?: { x: number; y: number } | null;
  onMapClick?: (x: number, y: number) => void;

  onGeoClick?: (lat: number, lon: number) => void;

  radiusM?: number;
  onReady?: () => void;
}

export const MAP_WIDTH = 480;
export const MAP_HEIGHT = 260;

export function projectToMap(
  lat: number,
  lng: number,
  center: MapCenter
): { x: number; y: number } {
  const scale = 14000;
  const x = MAP_WIDTH / 2 + (lng - center.longitude) * scale;
  const y = MAP_HEIGHT / 2 - (lat - center.latitude) * scale;
  return {
    x: Math.min(MAP_WIDTH - 16, Math.max(16, x)),
    y: Math.min(MAP_HEIGHT - 16, Math.max(16, y)),
  };
}

const KIND_PRESET: Record<string, string> = {
  metro: 'islands#nightDotIcon',
  school: 'islands#blueEducationIcon',
  kindergarten: 'islands#greenDotIcon',
  park: 'islands#darkGreenDotIcon',
  big_road: 'islands#orangeAutoIcon',
  railway: 'islands#grayDotIcon',
  industrial_zone: 'islands#brownFactoryIcon',
  cemetery: 'islands#blackDotIcon',
};

const DEFAULT_PRESET_PLUS = 'islands#greenDotIcon';
const DEFAULT_PRESET_MINUS = 'islands#redDotIcon';

let scriptPromise: Promise<void> | null = null;

function loadYandexMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));

  const w = window as any;
  if (w.ymaps && w.ymaps.Map) return Promise.resolve();

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const keyPart = apiKey ? `apikey=${encodeURIComponent(apiKey)}&` : '';
    script.src = `https://api-maps.yandex.ru/2.1/?${keyPart}lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      const ymaps = (window as any).ymaps;
      if (!ymaps) {
        reject(new Error('ymaps не загрузился'));
        return;
      }
      ymaps.ready(() => resolve());
    };
    script.onerror = () => reject(new Error('Не удалось загрузить API Яндекс.Карт'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

const MapView: React.FC<MapViewProps> = ({
  center,
  markers = [],
  selected,
  onGeoClick,
  radiusM = 3000,
  onReady,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const objectsRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/map/config');
        const data = await res.json();
        if (!cancelled) setApiKey(data.yandex_js_api_key || '');
      } catch {
        if (!cancelled) setApiKey('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (apiKey === null || !containerRef.current || mapRef.current) return;

    let cancelled = false;

    loadYandexMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const ymaps = (window as any).ymaps;

        const map = new ymaps.Map(
          containerRef.current,
          {
            center: center
              ? [center.latitude, center.longitude]
              : [55.7558, 37.6176],
            zoom: center ? 14 : 10,
            controls: ['zoomControl', 'geolocationControl'],
          },
          { suppressMapOpenBlock: true }
        );

        const collection = new ymaps.GeoObjectCollection();
        map.geoObjects.add(collection);

        if (onGeoClick) {
          map.events.add('click', (e: any) => {
            const coords = e.get('coords');
            onGeoClick(coords[0], coords[1]);
          });
        }

        mapRef.current = map;
        objectsRef.current = collection;
        setReady(true);
        onReady?.();
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Ошибка загрузки карты');
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !mapRef.current || !objectsRef.current) return;

    const ymaps = (window as any).ymaps;
    const map = mapRef.current;
    const collection = objectsRef.current;

    collection.removeAll();

    if (circleRef.current) {
      map.geoObjects.remove(circleRef.current);
      circleRef.current = null;
    }

    const property = markers.find((m) => m.type === 'property');
    const nearby = markers.filter((m) => m.type !== 'property');

    if (selected && center) {
      const circle = new ymaps.Circle(
        [[center.latitude, center.longitude], radiusM],
        {},
        {
          fillColor: '#4F46E51A',
          strokeColor: '#4F46E5',
          strokeWidth: 2,
          strokeStyle: 'shortdash',
        }
      );
      map.geoObjects.add(circle);
      circleRef.current = circle;
    }

    nearby.forEach((m) => {
      if (m.latitude == null || m.longitude == null) return;
      const isPlus = m.type === 'positive' || m.type === 'plus';
      const preset =
        (m.kind && KIND_PRESET[m.kind]) ||
        (isPlus ? DEFAULT_PRESET_PLUS : DEFAULT_PRESET_MINUS);

      collection.add(
        new ymaps.Placemark(
          [m.latitude, m.longitude],
          {
            balloonContentHeader: m.label,
            balloonContentBody:
              m.distance_m != null ? `${m.distance_m} м от объекта` : '',
          },
          { preset }
        )
      );
    });

    if (property && property.latitude != null && property.longitude != null) {
      collection.add(
        new ymaps.Placemark(
          [property.latitude, property.longitude],
          { balloonContentHeader: property.label, iconCaption: property.label },
          { preset: 'islands#redHomeIcon', zIndex: 1000 }
        )
      );
    } else if (selected && center) {
      collection.add(
        new ymaps.Placemark(
          [center.latitude, center.longitude],
          { balloonContentHeader: 'Выбранная точка', iconCaption: 'Объект' },
          { preset: 'islands#redHomeIcon', zIndex: 1000 }
        )
      );
    }

    if (center) {
      map.setCenter([center.latitude, center.longitude], selected ? 14 : 11, {
        duration: 300,
      });
    }
  }, [ready, markers, center, selected, radiusM]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-center p-4">
        <div>
          <p className="text-sm text-text-secondary font-medium">{error}</p>
          <p className="text-xs text-text-muted mt-1">
            Проверьте ключ YANDEX_JS_API_KEY в настройках сервера
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <p className="text-sm text-text-muted">Загрузка карты…</p>
        </div>
      )}
    </div>
  );
};

export default MapView;
