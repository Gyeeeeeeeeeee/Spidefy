import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  EllipsisVertical,
  ImagePlus,
  Pencil,
  Play,
  Plus,
  Search,
  Shuffle,
  Trash2,
  X,
  Minus,
  ListPlus,
  RefreshCw,
  Video,
} from 'lucide-react';
import { seedQueries, API_BASE } from './reco.js';
import SwipeRow from './SwipeRow.jsx';

/* ---------- Helpers ---------- */

function SpiderMark({ size = 24, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <ellipse cx="12" cy="13.5" rx="3" ry="4" fill={color} />
      <circle cx="12" cy="8" r="2" fill={color} />
      <path d="M9 11 L3 7 M9 13 L2 13 M9.5 15 L4 20 M10 17 L7 22 M15 11 L21 7 M15 13 L22 13 M14.5 15 L20 20 M14 17 L17 22" />
    </svg>
  );
}

// Foto dari galeri -> dipotong persegi & dikecilkan supaya muat di penyimpanan HP
export function fileToCover(file, size = 512) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('bukan gambar'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('gagal baca file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('gambar rusak'));
      img.onload = () => {
        try {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Video sampul (disimpan di IndexedDB, karena terlalu besar untuk localStorage) ---------- */

const MEDIA_DB = 'spideyfy-media';
const VIDEO_STORE = 'cover-videos';
const MAX_VIDEO_MB = 30;
const LOOP_SECONDS = 5;

function openMediaDb() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(MEDIA_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(VIDEO_STORE)) req.result.createObjectStore(VIDEO_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function idbRun(mode, fn) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, mode);
    const req = fn(tx.objectStore(VIDEO_STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req ? req.result : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

const saveCoverVideo = (id, blob) => idbRun('readwrite', (st) => st.put(blob, id));
const loadCoverVideo = (id) => idbRun('readonly', (st) => st.get(id));
const deleteCoverVideo = (id) => idbRun('readwrite', (st) => st.delete(id)).catch(() => {});

// Video dari galeri -> gambar pratinjau (bingkai pertama, persegi) + file videonya
function videoToCover(file, size = 512) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('video/')) {
      reject(new Error('bukan video'));
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      reject(new Error('terlalu besar'));
      return;
    }
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const done = (fn, arg) => {
      URL.revokeObjectURL(url);
      fn(arg);
    };
    v.onerror = () => done(reject, new Error('video rusak'));
    v.onloadeddata = () => {
      const target = Math.min(0.5, (v.duration || 1) / 2);
      v.onseeked = () => {
        try {
          const w = v.videoWidth;
          const h = v.videoHeight;
          const side = Math.min(w, h);
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          canvas.getContext('2d').drawImage(v, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
          done(resolve, { poster: canvas.toDataURL('image/jpeg', 0.82), blob: file, duration: v.duration || 0 });
        } catch (e) {
          done(reject, e);
        }
      };
      v.currentTime = target;
    };
    v.src = url;
  });
}

// Simpan video baru (kalau ada) dan hapus yang lama. Mengembalikan id video untuk disimpan di playlist.
async function persistCoverVideo({ videoBlob, keepVideo }, prevId) {
  let id = keepVideo ? prevId || null : null;
  if (videoBlob) {
    const nid = `cv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await saveCoverVideo(nid, videoBlob);
      id = nid;
    } catch {
      id = null; // penyimpanan penuh/tidak tersedia: tetap pakai gambar pratinjau saja
    }
  }
  if (prevId && prevId !== id) deleteCoverVideo(prevId);
  return id;
}

function totalDurationLabel(tracks) {
  const total = tracks.reduce((sum, t) => sum + (Number(t.durationSec) || 0), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} j ${m} mnt`;
  if (m > 0) return `${m} mnt ${s} dtk`;
  return `${s} dtk`;
}

/* ---------- Sampul playlist ---------- */

export function PlaylistCover({ pl, suit, className = '', iconSize = 28, animated = false, videoBlob = null }) {
  const tracks = pl.tracks || [];
  const covers = tracks.map((t) => t.cover).filter(Boolean);
  const [videoUrl, setVideoUrl] = useState(null);

  // Video sampul dimuat dari IndexedDB hanya di tampilan besar (animated), atau langsung dari file yang baru dipilih
  useEffect(() => {
    let dead = false;
    let url = null;
    if (videoBlob) {
      url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
    } else if (animated && pl.coverVideoId) {
      loadCoverVideo(pl.coverVideoId)
        .then((blob) => {
          if (dead || !blob) return;
          url = URL.createObjectURL(blob);
          setVideoUrl(url);
        })
        .catch(() => {});
    } else {
      setVideoUrl(null);
    }
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [animated, pl.coverVideoId, videoBlob]);

  let inner;
  if (videoUrl) {
    inner = (
      <video
        src={videoUrl}
        poster={pl.cover || undefined}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
        // Hanya 5 detik pertama yang diulang
        onTimeUpdate={(e) => {
          if (e.currentTarget.currentTime >= LOOP_SECONDS) e.currentTarget.currentTime = 0;
        }}
      />
    );
  } else if (pl.cover) {
    inner = <img src={pl.cover} alt="" className="w-full h-full object-cover" />;
  } else if (covers.length >= 4) {
    inner = (
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
        {covers.slice(0, 4).map((c, i) => (
          <img key={i} src={c} alt="" className="w-full h-full object-cover" />
        ))}
      </div>
    );
  } else if (covers.length > 0) {
    inner = <img src={covers[0]} alt="" className="w-full h-full object-cover" />;
  } else {
    inner = (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${suit.primary}55, ${suit.secondary}44)` }}
      >
        <SpiderMark size={iconSize} color={suit.primary} />
      </div>
    );
  }
  return <div className={`overflow-hidden bg-black/60 shrink-0 ${className}`}>{inner}</div>;
}

/* ---------- Form buat / edit (nama, deskripsi, foto dari galeri) ---------- */

function PlaylistEditor({ suit, initial, title, saveLabel, onSave, onClose }) {
  const [name, setName] = useState(initial.name || '');
  const [desc, setDesc] = useState(initial.desc || '');
  const [cover, setCover] = useState(initial.cover || null);
  const [videoBlob, setVideoBlob] = useState(null); // video baru yang baru dipilih
  const [keepVideo, setKeepVideo] = useState(!!initial.coverVideoId); // video lama tetap dipakai
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (file.type && file.type.startsWith('video/')) {
        const v = await videoToCover(file);
        setCover(v.poster);
        setVideoBlob(v.blob);
        setKeepVideo(false);
      } else {
        setCover(await fileToCover(file));
        setVideoBlob(null);
        setKeepVideo(false);
      }
    } catch (err) {
      setError(
        err && err.message === 'terlalu besar'
          ? `Video terlalu besar (maks ${MAX_VIDEO_MB} MB). Pilih video yang lebih pendek.`
          : 'File tidak bisa dibuka, coba foto atau video lain.'
      );
    } finally {
      setBusy(false);
    }
  };

  const previewPl = { cover, tracks: initial.tracks || [], coverVideoId: keepVideo ? initial.coverVideoId : null };

  return (
    <div className="fade-in fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="sheet-up w-full sm:max-w-sm max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14141b] border border-white/15 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-base font-black italic uppercase text-white">{title}</div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-2 rounded-full bg-white/10 text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current && fileRef.current.click()}
            className="relative w-44 h-44 rounded-xl active:scale-95 transition"
            style={{ boxShadow: `0 0 24px ${suit.glow}` }}
            aria-label="Pilih foto atau video dari galeri"
          >
            <PlaylistCover pl={previewPl} suit={suit} className="w-full h-full rounded-xl" iconSize={56} animated videoBlob={videoBlob} />
            <span className="absolute inset-0 rounded-xl bg-black/35 flex flex-col items-center justify-center gap-1 text-white">
              <ImagePlus className="w-7 h-7" />
              <span className="text-[11px] font-bold">{busy ? 'Memproses…' : 'Pilih foto / video'}</span>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pick} className="hidden" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-white/10 active:scale-95"
            >
              Foto / video galeri
            </button>
            {cover && (
              <button
                type="button"
                onClick={() => {
                  setCover(null);
                  setVideoBlob(null);
                  setKeepVideo(false);
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold text-neutral-300 bg-white/5 active:scale-95"
              >
                Hapus sampul
              </button>
            )}
          </div>
          {(videoBlob || keepVideo) && (
            <p className="flex items-center gap-1 text-[11px] text-neutral-300">
              <Video className="w-3.5 h-3.5" /> Video sampul aktif, 5 detik pertama diputar berulang
            </p>
          )}
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>

        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama playlist"
            maxLength={60}
            className="w-full px-4 py-2.5 rounded-xl bg-black/50 text-sm text-white outline-none"
            style={{ border: `1px solid ${suit.primary}77` }}
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Deskripsi (opsional)"
            rows={2}
            maxLength={160}
            className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/15 text-sm text-white outline-none resize-none"
          />
        </div>

        <button
          type="button"
          disabled={!name.trim() || busy}
          onClick={async () => {
            setBusy(true);
            await onSave({ name: name.trim(), desc: desc.trim(), cover, videoBlob, keepVideo });
          }}
          className="w-full py-3 rounded-full text-sm font-extrabold text-white active:scale-[0.98] disabled:opacity-40"
          style={{ backgroundColor: suit.primary, boxShadow: `0 0 18px ${suit.glow}` }}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

/* ---------- Tambah lagu ke playlist ---------- */

// Genre dikelompokkan per kategori supaya gampang dicari. Tiap genre punya beberapa kata kunci,
// tombol "Segarkan" berganti ke kata kunci berikutnya sehingga hasilnya selalu baru.
const GENRE_GROUPS = [
  {
    title: 'Indonesia',
    items: [
      { label: 'Pop Indonesia', qs: ['lagu pop indonesia hits', 'pop indonesia terbaru', 'lagu pop indonesia 2000an'] },
      { label: 'Indie Indonesia', qs: ['indie indonesia', 'lagu indie senja', 'indie folk indonesia'] },
      { label: 'Dangdut', qs: ['dangdut populer', 'dangdut koplo terbaru', 'dangdut lawas'] },
      { label: 'Koplo & Campursari', qs: ['dj koplo terbaru', 'campursari populer', 'denny caknan guyon waton'] },
      { label: 'Rock Indonesia', qs: ['rock indonesia legendaris', 'band rock indonesia', 'slow rock indonesia'] },
      { label: 'Hip-hop Indonesia', qs: ['rap indonesia hits', 'hip hop indonesia terbaru', 'rapper indonesia'] },
      { label: 'Religi', qs: ['lagu religi islami', 'sholawat populer', 'nasyid terbaru'] },
      { label: 'Lagu Daerah', qs: ['lagu daerah populer', 'lagu sunda populer', 'lagu minang populer'] },
      { label: 'Akustik', qs: ['akustik cover indonesia', 'cover akustik santai', 'live akustik indonesia'] },
      { label: 'Nostalgia', qs: ['lagu indonesia 90an', 'lagu nostalgia 2000an indonesia', 'lagu lawas indonesia'] },
    ],
  },
  {
    title: 'Mood',
    items: [
      { label: 'Galau', qs: ['lagu galau indonesia', 'lagu patah hati', 'lagu sedih indonesia'] },
      { label: 'Santai', qs: ['lagu santai chill', 'lagu santai sore hari', 'chill vibes indonesia'] },
      { label: 'Semangat', qs: ['lagu semangat workout', 'lagu penyemangat pagi', 'gym motivation songs'] },
      { label: 'Romantis', qs: ['lagu romantis indonesia', 'love songs terbaik', 'lagu cinta manis'] },
      { label: 'Fokus & Belajar', qs: ['musik fokus belajar', 'study music instrumental', 'musik konsentrasi kerja'] },
      { label: 'Pengantar Tidur', qs: ['musik pengantar tidur', 'sleep music relaxing', 'lagu tidur tenang'] },
      { label: 'Perjalanan', qs: ['lagu perjalanan road trip', 'lagu naik motor santai', 'driving songs'] },
      { label: 'Pesta', qs: ['lagu pesta party hits', 'lagu joget viral', 'dance party songs'] },
    ],
  },
  {
    title: 'Dunia',
    items: [
      { label: 'Pop', qs: ['pop hits', 'top pop songs', 'pop terbaru global'] },
      { label: 'Hip-hop', qs: ['hip hop hits', 'rap hits terbaru', 'old school hip hop'] },
      { label: 'R&B', qs: ['r&b hits', 'rnb slow jam', 'neo soul'] },
      { label: 'Rock', qs: ['rock hits', 'classic rock songs', 'alternative rock'] },
      { label: 'Metal', qs: ['metal hits', 'heavy metal klasik', 'metalcore'] },
      { label: 'EDM', qs: ['edm party hits', 'house music hits', 'electronic dance remix'] },
      { label: 'Lo-fi', qs: ['lofi chill beats', 'lofi hip hop', 'lofi study'] },
      { label: 'Jazz', qs: ['jazz santai', 'smooth jazz', 'jazz klasik'] },
      { label: 'Country & Folk', qs: ['country hits', 'folk acoustic songs', 'americana'] },
      { label: 'Reggae', qs: ['reggae hits', 'reggae santai', 'ska reggae indonesia'] },
      { label: 'Klasik', qs: ['musik klasik populer', 'piano klasik', 'orchestra soundtrack'] },
      { label: 'K-Pop', qs: ['kpop hits', 'kpop terbaru', 'kpop girl group'] },
      { label: 'J-Pop & Anime', qs: ['anime opening songs', 'jpop hits', 'anime ending songs'] },
      { label: 'Latin', qs: ['latin hits', 'reggaeton hits', 'bachata populer'] },
    ],
  },
];


function toSong(item) {
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

async function searchSongsOnline(query, signal) {
  const res = await fetch(`${API_BASE}/api/ytmusic?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error('status ' + res.status);
  const data = await res.json();
  return (Array.isArray(data.songs) ? data.songs : []).map(toSong).filter(Boolean);
}

// Gabung beberapa daftar lagu secara bergantian, tanpa lagu dobel
function mergeAlternating(lists, max = 40) {
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

function AddSongsSheet({ suit, pl, songs, onToggle, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Rekomendasi otomatis (tanpa perlu memilih chip), ikut berubah setiap kali lagu ditambahkan
  const [autoList, setAutoList] = useState([]);
  const [autoLoading, setAutoLoading] = useState(true);
  const [autoFailed, setAutoFailed] = useState(false);
  const [freshIds, setFreshIds] = useState([]);
  const [addingId, setAddingId] = useState(null);
  const [variant, setVariant] = useState(0); // naik tiap tekan "Segarkan" pada genre
  const [groupTab, setGroupTab] = useState(null);
  const autoRef = useRef([]);
  autoRef.current = autoList;
  const addedRef = useRef([]); // lagu yang dipilih di sesi ini, terbaru di depan
  const seenRef = useRef(new Set());
  const resultsRef = useRef([]);
  resultsRef.current = results;
  const tracksRef = useRef(pl.tracks || []);
  tracksRef.current = pl.tracks || [];

  // Chip "Mirip playlist ini": ambil artis yang paling sering ada di playlist
  const similarChip = useMemo(() => {
    const count = {};
    (pl.tracks || []).forEach((t) => {
      const name = String(t.artist || '').split(',')[0].trim();
      if (name) count[name] = (count[name] || 0) + 1;
    });
    const top = Object.keys(count).sort((x, y) => count[y] - count[x]).slice(0, 2);
    if (!top.length) return null;
    return { label: 'Mirip playlist ini', qs: top.map((n) => `${n} lagu populer`), fixed: true };
  }, [pl.tracks]);

  const groups = useMemo(
    () => (similarChip ? [{ title: 'Untukmu', items: [similarChip] }, ...GENRE_GROUPS] : GENRE_GROUPS),
    [similarChip]
  );
  const chips = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const activeGroup = groups.find((g) => g.title === groupTab) || groups[0];
  const typed = q.trim();
  const mode = typed.length >= 2 ? 'search' : sel.length ? 'reco' : 'auto';

  const queries = useMemo(() => {
    if (mode === 'search') return [typed];
    if (mode === 'reco') {
      return chips
        .filter((c) => sel.includes(c.label))
        .flatMap((c) => (c.fixed ? c.qs : [c.qs[variant % c.qs.length]]))
        .slice(0, 6);
    }
    return [];
  }, [mode, typed, chips, sel, variant]);
  const queryKey = queries.join('||');

  useEffect(() => {
    if (!queries.length) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(async () => {
      try {
        const lists = await Promise.all(
          queries.map((qq) => searchSongsOnline(qq, controller.signal).catch(() => null))
        );
        if (cancelled) return;
        if (lists.every((l) => l === null)) {
          setFailed(true);
          setResults([]);
        } else {
          // gabung bergantian supaya tiap selera kebagian, tanpa lagu dobel
          const seen = new Set();
          const merged = [];
          const valid = lists.filter(Boolean);
          const max = Math.max(...valid.map((l) => l.length), 0);
          for (let i = 0; i < max && merged.length < 40; i += 1) {
            valid.forEach((l) => {
              if (l[i] && !seen.has(l[i].id)) {
                seen.add(l[i].id);
                merged.push(l[i]);
              }
            });
          }
          setResults(merged);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // Rekomendasi awal: dari artis yang paling sering ada di playlist (atau lagu populer kalau masih kosong)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const qs = similarChip ? similarChip.qs : ['lagu populer indonesia', 'top hits terbaru'];
    (async () => {
      try {
        const lists = await Promise.all(qs.map((qq) => searchSongsOnline(qq, controller.signal).catch(() => null)));
        if (cancelled) return;
        if (lists.every((l) => l === null)) {
          setAutoFailed(true);
        } else {
          setAutoList(mergeAlternating(lists, 30));
        }
      } finally {
        if (!cancelled) setAutoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selera saat ini: lagu yang baru dipilih (terbaru dulu) + lagu terakhir di playlist
  const tasteSeeds = () => [...addedRef.current, ...[...(tracksRef.current || [])].reverse().slice(0, 6)];

  // Ambil rekomendasi segar dari selera saat ini. Lagu yang sudah ada/sudah pernah tampil dikurangi.
  const buildFresh = async (limit) => {
    const seeds = tasteSeeds();
    const qs = seedQueries(seeds, 3);
    const last = addedRef.current[0];
    if (last) qs.push(`mirip ${last.title} ${String(last.artist || '').split(',')[0].trim()}`);
    if (!qs.length) qs.push('lagu populer indonesia');
    const lists = await Promise.all(qs.map((qq) => searchSongsOnline(qq).catch(() => null)));
    const taken = new Set([...tracksRef.current.map((x) => x.id), ...addedRef.current.map((x) => x.id)]);
    const all = mergeAlternating(lists, 60).filter((x) => !taken.has(x.id));
    const unseen = all.filter((x) => !seenRef.current.has(x.id));
    const out = (unseen.length >= limit ? unseen : [...unseen, ...all.filter((x) => seenRef.current.has(x.id))]).slice(0, limit);
    out.forEach((x) => seenRef.current.add(x.id));
    return out;
  };

  const flash = (ids) => {
    setFreshIds(ids);
    setTimeout(() => setFreshIds([]), 900);
  };

  // Begitu lagu dipilih: sisa daftar di bawahnya diganti rekomendasi baru yang mengikuti seleramu
  const refreshAfterAdd = async (song) => {
    setAddingId(song.id);
    try {
      const fresh = await buildFresh(10);
      if (!fresh.length) return;
      if (mode === 'auto') {
        setAutoList((prev) => {
          const idx = prev.findIndex((x) => x.id === song.id);
          const at = idx >= 0 ? idx + 1 : prev.length;
          return [...prev.slice(0, at), ...fresh];
        });
      } else {
        // Saat mencari/chip: hasilnya tetap, rekomendasi disisipkan tepat di bawah lagu yang ditambah
        const near = fresh.slice(0, 5);
        const insertAfter = (prev) => {
          const idx = prev.findIndex((x) => x.id === song.id);
          const at = idx >= 0 ? idx + 1 : 0;
          return [...prev.slice(0, at), ...near.filter((n) => !prev.some((x) => x.id === n.id)), ...prev.slice(at)];
        };
        setResults(insertAfter);
        setAutoList((prev) => [...fresh, ...prev.filter((x) => !fresh.some((f) => f.id === x.id))]);
      }
      flash(fresh.map((x) => x.id));
    } finally {
      setAddingId(null);
    }
  };

  // Tombol segarkan: ganti seluruh rekomendasi dengan yang baru
  const regenerate = async () => {
    setAutoLoading(true);
    try {
      const fresh = await buildFresh(20);
      if (fresh.length) {
        setAutoList([...addedRef.current, ...fresh]);
        flash(fresh.map((x) => x.id));
      }
    } finally {
      setAutoLoading(false);
    }
  };

  const handleToggle = (song) => {
    const had = pl.tracks.some((t) => t.id === song.id);
    onToggle(pl.id, song);
    if (had) {
      addedRef.current = addedRef.current.filter((x) => x.id !== song.id);
    } else {
      addedRef.current = [song, ...addedRef.current.filter((x) => x.id !== song.id)].slice(0, 6);
      refreshAfterAdd(song);
    }
  };

  const localList = useMemo(() => {
    const needle = typed.toLowerCase();
    if (!needle) return songs;
    return songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(needle));
  }, [typed, songs]);

  // Kalau pencarian online gagal, tetap tampilkan hasil dari daftar yang ada
  const autoShown = autoList.length ? autoList : autoFailed ? localList : [];
  const list = mode === 'auto' ? autoShown : failed ? localList : results;

  const toggleChip = (label) => {
    setSel((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  };

  const heading =
    mode === 'search'
      ? `Hasil pencarian "${typed}"`
      : mode === 'reco'
      ? 'Rekomendasi sesuai seleramu'
      : 'Rekomendasi untukmu';

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm h-[80dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#14141b] border border-white/15 p-4 gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-base font-black italic uppercase text-white">Tambahkan lagu</div>
          <button type="button" onClick={onClose} aria-label="Selesai" className="px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white" style={{ backgroundColor: suit.primary }}>
            Selesai
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
          <Search className="w-4 h-4 text-neutral-300 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari lagu atau artis apa saja"
            className="flex-1 min-w-0 bg-transparent text-sm text-white outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Hapus pencarian" className="text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div>
          <div className="text-[11px] font-bold text-neutral-300 mb-1.5">Atau pilih genre</div>
          <div className="flex gap-1 mb-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {groups.map((g) => {
              const on = g.title === activeGroup.title;
              const picked = g.items.filter((c) => sel.includes(c.label)).length;
              return (
                <button
                  key={g.title}
                  type="button"
                  onClick={() => setGroupTab(g.title)}
                  aria-pressed={on}
                  className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-extrabold"
                  style={on ? { backgroundColor: 'rgba(255,255,255,0.16)', color: '#fff' } : { color: 'rgba(255,255,255,0.55)' }}
                >
                  {g.title}
                  {picked > 0 && (
                    <span className="ml-1 px-1.5 rounded-full text-[10px]" style={{ backgroundColor: suit.primary }}>
                      {picked}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto pb-1">
            {activeGroup.items.map((c) => {
              const on = sel.includes(c.label);
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => toggleChip(c.label)}
                  aria-pressed={on}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold text-white border"
                  style={on ? { backgroundColor: suit.primary, borderColor: suit.primary } : { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'transparent' }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between -mb-1">
          <div className="text-[11px] font-bold text-neutral-400">{heading}</div>
          {(mode === 'auto' || mode === 'reco') && (
            <button
              type="button"
              onClick={mode === 'reco' ? () => setVariant((v) => v + 1) : regenerate}
              disabled={mode === 'reco' ? loading : autoLoading}
              aria-label="Segarkan rekomendasi"
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-white/10 text-white active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${(mode === 'reco' ? loading : autoLoading) ? 'animate-spin' : ''}`} /> Segarkan
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {((loading && mode !== 'auto') || (autoLoading && mode === 'auto' && !autoList.length)) && <p className="text-xs text-neutral-400 px-1">Mencari lagu...</p>}
          {failed && <p className="text-[11px] text-neutral-400 px-1">Pencarian online belum tersambung. Menampilkan dari daftar yang ada.</p>}
          {!loading && !autoLoading && list.length === 0 && <p className="text-xs text-neutral-400 px-1">Tidak ada lagu.</p>}
          {list.map((s) => {
            const has = pl.tracks.some((t) => t.id === s.id);
            return (
              <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => handleToggle(s)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white/[0.04] text-left active:scale-[0.99]"
                style={freshIds.includes(s.id) ? { animation: 'recIn 0.45s ease-out both' } : undefined}
              >
                <img src={s.cover} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white truncate">{s.title}</span>
                  <span className="block text-[10.5px] text-neutral-400 truncate">{s.artist}</span>
                </span>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={has ? { backgroundColor: suit.primary } : { border: '1.5px solid rgba(255,255,255,0.4)' }}
                >
                  {has ? <Check className="w-4 h-4 text-white" /> : <Plus className="w-3.5 h-3.5 text-white/70" />}
                </span>
              </button>
              {addingId === s.id && (
                <p className="text-[10.5px] px-3 py-1" style={{ color: suit.primary }}>Mencari lagu yang mirip...</p>
              )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Daftar playlist (seperti "Koleksi Kamu") ---------- */

export function PlaylistLibrary({ suit, playlists, onOpen, onCreate }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 pt-1 pb-1">
        <SpiderMark size={18} color={suit.primary} />
        <div className="text-lg font-black italic uppercase text-white tracking-wide" style={{ textShadow: `0 0 14px ${suit.glow}` }}>
          Koleksi Kamu
        </div>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${suit.primary}, transparent)` }} />
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Buat playlist"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90"
          style={{ backgroundColor: suit.primary, boxShadow: `0 0 14px ${suit.glow}` }}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {playlists.length === 0 && (
        <p className="text-[11px] text-neutral-400 px-1 pb-2">
          Belum ada playlist. Tekan + di kanan atas untuk membuat, atau tekan + di sebuah lagu.
        </p>
      )}

      {playlists.map((pl) => (
        <button
          key={pl.id}
          type="button"
          onClick={() => onOpen(pl.id)}
          className="w-full flex items-center gap-3 p-2 rounded-xl text-left active:bg-white/[0.07] hover:bg-white/[0.05] transition"
        >
          <PlaylistCover
            pl={pl}
            suit={suit}
            className="w-16 h-16 rounded-lg"
            iconSize={28}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-white truncate">{pl.name}</div>
            <div className="text-xs text-neutral-400 truncate mt-0.5">
              Playlist • Kamu • {pl.tracks.length} lagu
            </div>
          </div>
        </button>
      ))}

      {creating && (
        <PlaylistEditor
          suit={suit}
          initial={{ name: '', desc: '', cover: null, tracks: [] }}
          title="Playlist baru"
          saveLabel="Buat"
          onClose={() => setCreating(false)}
          onSave={async (data) => {
            const coverVideoId = await persistCoverVideo(data, null);
            onCreate({ name: data.name, desc: data.desc, cover: data.cover, coverVideoId });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Halaman detail playlist ---------- */

export function PlaylistDetail({
  suit,
  pl,
  songs,
  currentTrackId,
  isPlaying,
  onBack,
  onPlay,
  onQueue,
  shuffleOn,
  onToggleShuffle,
  onUpdate,
  onDelete,
  onToggleTrack,
}) {
  const [query, setQuery] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (rootRef.current && rootRef.current.scrollIntoView) {
      rootRef.current.scrollIntoView({ block: 'start' });
    }
  }, [pl.id]);

  const needle = query.trim().toLowerCase();
  const visible = pl.tracks
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => !needle || `${t.title} ${t.artist}`.toLowerCase().includes(needle));

  const move = (from, to) => {
    if (to < 0 || to >= pl.tracks.length) return;
    const next = pl.tracks.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onUpdate(pl.id, { tracks: next });
  };

  return (
    <div ref={rootRef} className="-mx-3 -mt-3 pb-4">
      {/* Header bergradien */}
      <div
        className="px-4 pt-4 pb-5 space-y-4"
        style={{ background: `linear-gradient(180deg, ${suit.primary}cc 0%, ${suit.orbA} 55%, transparent 100%)` }}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali"
            className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center active:scale-90"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center active:scale-90"
            >
              <EllipsisVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-20 w-52 rounded-xl bg-[#1c1c26] border border-white/15 shadow-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowInfo(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-white text-left active:bg-white/10"
                >
                  <Pencil className="w-4 h-4" /> Nama & detail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm(`Hapus playlist "${pl.name}"?`)) {
                      if (pl.coverVideoId) deleteCoverVideo(pl.coverVideoId);
                      onDelete(pl.id);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 text-left active:bg-white/10"
                >
                  <Trash2 className="w-4 h-4" /> Hapus playlist
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-black/30">
          <Search className="w-4 h-4 text-white shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Temukan di playlist"
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-white placeholder-white/80 outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Hapus pencarian" className="text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label="Ganti foto playlist"
            className="active:scale-95 transition"
          >
            <PlaylistCover
              pl={pl}
              suit={suit}
              className="w-56 h-56 rounded-lg"
              iconSize={72}
              animated
            />
          </button>
        </div>

        <div>
          <div className="text-3xl font-black text-white leading-tight break-words">{pl.name}</div>
          {pl.desc && <div className="text-xs text-white/75 mt-1">{pl.desc}</div>}
          <div className="flex items-center gap-2 mt-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white"
              style={{ backgroundColor: suit.secondary }}
            >
              K
            </span>
            <span className="text-sm font-bold text-white">Kamu</span>
          </div>
          <div className="text-xs text-white/70 mt-1.5">
            {pl.tracks.length} lagu • {totalDurationLabel(pl.tracks)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold text-white/70">
            {isPlaying && pl.tracks.some((t) => t.id === currentTrackId) ? 'Sedang diputar' : ''}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleShuffle}
              aria-label={shuffleOn ? 'Acak aktif, tekan untuk mematikan' : 'Acak mati, tekan untuk menyalakan'}
              aria-pressed={shuffleOn}
              className="relative flex flex-col items-center active:scale-90"
              style={{ color: shuffleOn ? suit.primary : 'rgba(255,255,255,0.7)' }}
            >
              <Shuffle className="w-7 h-7" />
              <span
                className="mt-1 w-1 h-1 rounded-full"
                style={{ backgroundColor: shuffleOn ? suit.primary : 'transparent' }}
              />
            </button>
            <button
              type="button"
              onClick={() => onPlay(pl)}
              aria-label="Putar playlist"
              className="w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-90"
              style={{ backgroundColor: suit.primary, boxShadow: `0 0 22px ${suit.glow}` }}
            >
              <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/40 text-sm font-bold text-white active:scale-95"
          >
            <Plus className="w-4 h-4" /> Tambahkan
          </button>
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white active:scale-95"
            style={editMode ? { backgroundColor: suit.primary } : { backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            {editMode ? <Check className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
            {editMode ? 'Selesai' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/40 text-sm font-bold text-white active:scale-95"
          >
            <Pencil className="w-4 h-4" /> Nama & detail
          </button>
        </div>
      </div>

      {/* Daftar lagu */}
      <div className="px-3 space-y-1">
        {pl.tracks.length === 0 && (
          <p className="text-xs text-neutral-400 px-1 py-4">
            Playlist ini masih kosong. Tekan <b>Tambahkan</b> atau tombol + di sebuah lagu.
          </p>
        )}
        {pl.tracks.length > 0 && visible.length === 0 && (
          <p className="text-xs text-neutral-400 px-1 py-4">Tidak ada lagu yang cocok.</p>
        )}
        {visible.map(({ t, index }) => {
          const active = t.id === currentTrackId;
          return (
            <SwipeRow
              key={`${t.id}-${index}`}
              color={suit.primary}
              disabled={editMode}
              onSwipe={() => onQueue && onQueue(t)}
              onClick={() => !editMode && onPlay(pl, t)}
              className="flex items-center gap-3 px-1 py-1.5 rounded-lg cursor-pointer active:bg-white/[0.06]"
            >
              {editMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTrack(pl.id, t);
                  }}
                  aria-label="Hapus dari playlist"
                  className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
              <img src={t.cover} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold truncate" style={{ color: active ? suit.primary : '#fff' }}>
                  {t.title}
                </div>
                <div className="text-xs text-neutral-400 truncate">{t.artist}</div>
              </div>
              {editMode ? (
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(index, index - 1);
                    }}
                    aria-label="Naikkan"
                    className="p-2 text-white disabled:opacity-25"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === pl.tracks.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(index, index + 1);
                    }}
                    aria-label="Turunkan"
                    className="p-2 text-white disabled:opacity-25"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Hapus "${t.title}" dari playlist?`)) onToggleTrack(pl.id, t);
                  }}
                  aria-label="Hapus dari playlist"
                  className="p-2 text-neutral-400 shrink-0"
                >
                  <EllipsisVertical className="w-5 h-5" />
                </button>
              )}
            </SwipeRow>
          );
        })}
      </div>

      {showAdd && (
        <AddSongsSheet suit={suit} pl={pl} songs={songs} onToggle={onToggleTrack} onClose={() => setShowAdd(false)} />
      )}
      {showInfo && (
        <PlaylistEditor
          suit={suit}
          initial={{ name: pl.name, desc: pl.desc || '', cover: pl.cover || null, coverVideoId: pl.coverVideoId || null, tracks: pl.tracks }}
          title="Nama & detail"
          saveLabel="Simpan"
          onClose={() => setShowInfo(false)}
          onSave={async (data) => {
            const coverVideoId = await persistCoverVideo(data, pl.coverVideoId);
            onUpdate(pl.id, { name: data.name, desc: data.desc, cover: data.cover, coverVideoId });
            setShowInfo(false);
          }}
        />
      )}
    </div>
  );
}
