import { userGeoApi } from '@/api';
import { useAppStore, type Step1Snapshot } from '@/store/appStore';

function ensurePropertyMarker(step1: Step1Snapshot): Step1Snapshot {
  const markers = [...(step1.mapMarkers || [])];
  const hasProperty = markers.some((m) => m.type === 'property');
  if (!hasProperty && step1.mapCenter) {
    markers.unshift({
      type: 'property',
      label: step1.selectedProperty.address,
      latitude: step1.mapCenter.latitude,
      longitude: step1.mapCenter.longitude,
      propertyId: step1.selectedProperty.id,
    });
  }
  return { ...step1, mapMarkers: markers };
}

/** Подтягивает сохранённую точку карты пользователя в appStore после логина/bootstrap. */
export async function hydrateUserGeoFromServer(): Promise<void> {
  try {
    const { data } = await userGeoApi.get();
    const state = data.state;
    if (!state) return;

    const store = useAppStore.getState();

    if (state.step1?.selectedProperty) {
      const step1 = ensurePropertyMarker(state.step1 as Step1Snapshot);
      store.setStep1Snapshot(step1);
      const lat = state.latitude ?? step1.mapCenter?.latitude;
      const lon = state.longitude ?? step1.mapCenter?.longitude;
      if (lat != null && lon != null) {
        store.setSelectedLocation({
          address:
            state.address ||
            step1.selectedProperty.address ||
            state.searchQuery ||
            'Сохранённая точка',
          latitude: lat,
          longitude: lon,
        });
      }
      return;
    }

    if (state.latitude != null && state.longitude != null) {
      store.setSelectedLocation({
        address: state.address || state.searchQuery || 'Сохранённая точка',
        latitude: state.latitude,
        longitude: state.longitude,
      });
    }
  } catch {
    // ignore — карта откроется без сохранённой точки
  }
}
