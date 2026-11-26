import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const API_BASE = 'https://vercel.app';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Cek apakah berjalan di APK baru yang mendukung penyimpanan memori HP
export function isNativeStorageSupported() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Filesystem');
}

// 1. Download lagu berdasarkan videoId & simpan ke penyimpanan HP
export async function saveSongToPhone(videoId) {
  const proxyUrl = `${API_BASE}/api/audio?videoId=${encodeURIComponent(videoId)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error('Gagal mengunduh audio dari server');

  const blob = await response.blob();
  const fileName = `spidefy_${videoId}.m4a`;

  if (isNativeStorageSupported()) {
    const base64Data = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });
    return true;
  } else {
    throw new Error('APK versi lama atau browser biasa tidak mendukung penyimpanan HP');
  }
}

// 2. Ambil URL lokal dari memori HP untuk diputar secara offline di Spidefy
export async function getSongFromPhone(videoId) {
  if (!isNativeStorageSupported()) return null;

  const fileName = `spidefy_${videoId}.m4a`;
  try {
    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Data,
    });
    return Capacitor.convertFileSrc(uriResult.uri);
  } catch {
    return null;
  }
}

// 3. Cek daftar videoId lagu apa saja yang sudah tersimpan di memori HP
export async function getAllSavedSongIds() {
  if (!isNativeStorageSupported()) return [];

  try {
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Data,
    });
    return result.files
      .map((f) => (typeof f === 'string' ? f : f.name))
      .filter((name) => name.startsWith('spidefy_') && name.endsWith('.m4a'))
      .map((name) => name.replace('spidefy_', '').replace('.m4a', ''));
  } catch {
    return [];
  }
}

// 4. Hapus lagu dari memori HP
export async function deleteSongFromPhone(videoId) {
  if (!isNativeStorageSupported()) return;
  try {
    await Filesystem.deleteFile({
      path: `spidefy_${videoId}.m4a`,
      directory: Directory.Data,
    });
  } catch {
    // abaikan jika file sudah tidak ada
  }
      }
