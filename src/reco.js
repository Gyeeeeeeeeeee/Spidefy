const API_BASE = 'https://vercel.app';

// Pembantu rekomendasi: dipakai di beranda dan di sheet "Tambahkan lagu".
const SUFFIX = ['lagu populer', 'terbaik', 'hits', 'terbaru', 'best songs', 'lagu pilihan', 'mix', 'favorit'];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function artistOf(t) {
  return String((t && t.artist) || '').split(',')[0].trim();
}

// Ambil nama artis unik dari daftar seed (yang terbaru di depan) lalu jadikan kata kunci pencarian.
// Akhiran dipilih acak supaya hasilnya berubah tiap kali disegarkan.
export function seedQueries(seeds, n = 3) {
  const out = [];
  const used = new Set();
  for (const s of seeds || []) {
    const a = artistOf(s);
    if (!a || used.has(a.toLowerCase())) continue;
    used.add(a.toLowerCase());
    out.push(`${a} ${pick(SUFFIX)}`);
    if (out.length >= n) break;
  }
  return out;
}

export function toSong(item) {
  const vid = item && (item.videoId || item.id);
  if (!vid) return null;
  const sec = Number(item.durationSec) || 180;
  const m = Math.floor(sec / 60);
  const sc = Math.floor(sec % 60);
  return {
    id: String(vid),
    videoId: vid,
    title: item.title || 'Untitled',
    artist: item.artist || 'Unknown',
    album: item.album || 'Single',
    durationSec: sec,
    durationLabel: `${m}:${String(sc).padStart(2, '0')}`,
    cover: item.cover || (String(vid).length === 11 ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : undefined),
    lyrics: null,
  };
}

export async function fetchSongs(query, signal) {
  const res = await fetch(`${API_BASE}/api/ytmusic?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error('status ' + res.status);
  const data = await res.json();
  return (Array.isArray(data.songs) ? data.songs : []).map(toSong).filter(Boolean);
}

export function mergeAlternating(lists, max = 40) {
  const seen = new Set();
  const merged = [];
  const valid = lists.filter(Boolean);
  const longest = Math.max(...valid.map((l) => l.length), 0);
  for (let i = 0; i < longest && merged.length < max; i += 1) {
    valid.forEach((l) => {
      if (l[i] && !seen.has(l[i].id)) {
        seen.add(l[i].id);
        merged.push(l[i]);
      }
    });
  }
  return merged;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
