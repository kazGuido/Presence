import { Capacitor } from '@capacitor/core';

export function isCapacitorNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function getCurrentPositionGeo(): Promise<{ lat: number; lng: number }> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      throw new Error('Geolocation permission denied');
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

/** Pick a camera photo as File for punch proof (native); returns null if user cancelled. */
export async function pickCameraPhotoFile(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const image = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
  });
  const b64 = image.base64String;
  if (!b64) return null;
  const mime = `image/${image.format === 'png' ? 'png' : 'jpeg'}`;
  const res = await fetch(`data:${mime};base64,${b64}`);
  const blob = await res.blob();
  return new File([blob], `capture.${image.format === 'png' ? 'png' : 'jpg'}`, { type: mime });
}
