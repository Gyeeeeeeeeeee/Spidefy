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
} from 'lucide-react';

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

export function PlaylistCover({ pl, suit, className = '', iconSize = 28 }) {
  const tracks = pl.tracks || [];
  const covers = tracks.map((t) => t.cover).filter(Boolean);
  let inner;
  if (pl.cover) {
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
      setCover(await fileToCover(file));
    } catch {
      setError('Foto tidak bisa dibuka, coba foto lain.');
    } finally {
      setBusy(false);
    }
  };

  const previewPl = { cover, tracks: initial.tracks || [] };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14141b] border border-white/15 p-5 space-y-4"
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
            aria-label="Pilih foto dari galeri"
          >
            <PlaylistCover pl={previewPl} suit={suit} className="w-full h-full rounded-xl" iconSize={56} />
            <span className="absolute inset-0 rounded-xl bg-black/35 flex flex-col items-center justify-center gap-1 text-white">
              <ImagePlus className="w-7 h-7" />
              <span className="text-[11px] font-bold">{busy ? 'Memproses…' : 'Pilih foto'}</span>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-white/10 active:scale-95"
            >
              Ambil dari galeri
            </button>
            {cover && (
              <button
                type="button"
                onClick={() => setCover(null)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold text-neutral-300 bg-white/5 active:scale-95"
              >
                Hapus foto
              </button>
            )}
          </div>
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
          onClick={() => onSave({ name: name.trim(), desc: desc.trim(), cover })}
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

const TASTE_CHIPS = [
  { label: 'Pop Indonesia', qs: ['lagu pop indonesia hits'] },
  { label: 'Galau', qs: ['lagu galau indonesia'] },
  { label: 'Santai', qs: ['lagu santai chill'] },
  { label: 'Semangat', qs: ['lagu semangat workout'] },
  { label: 'Hip-hop', qs: ['hip hop hits'] },
  { label: 'Rock', qs: ['rock hits'] },
  { label: 'Lo-fi', qs: ['lofi chill beats'] },
  { label: 'Akustik', qs: ['akustik cover indonesia'] },
  { label: 'Dangdut', qs: ['dangdut populer'] },
  { label: 'K-Pop', qs: ['kpop hits'] },
  { label: 'Jazz', qs: ['jazz santai'] },
  { label: 'EDM', qs: ['edm party hits'] },
  { label: 'Anime', qs: ['anime opening songs'] },
  { label: 'Religi', qs: ['lagu religi islami'] },
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
  const res = await fetch(`/api/ytmusic?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error('status ' + res.status);
  const data = await res.json();
  return (Array.isArray(data.songs) ? data.songs : []).map(toSong).filter(Boolean);
}

function AddSongsSheet({ suit, pl, songs, onToggle, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Chip "Mirip playlist ini": ambil artis yang paling sering ada di playlist
  const similarChip = useMemo(() => {
    const count = {};
    (pl.tracks || []).forEach((t) => {
      const name = String(t.artist || '').split(',')[0].trim();
      if (name) count[name] = (count[name] || 0) + 1;
    });
    const top = Object.keys(count).sort((x, y) => count[y] - count[x]).slice(0, 2);
    if (!top.length) return null;
    return { label: 'Mirip playlist ini', qs: top.map((n) => `${n} lagu populer`) };
  }, [pl.tracks]);

  const chips = useMemo(() => (similarChip ? [similarChip, ...TASTE_CHIPS] : TASTE_CHIPS), [similarChip]);
  const typed = q.trim();
  const mode = typed.length >= 2 ? 'search' : sel.length ? 'reco' : 'local';

  const queries = useMemo(() => {
    if (mode === 'search') return [typed];
    if (mode === 'reco') return chips.filter((c) => sel.includes(c.label)).flatMap((c) => c.qs).slice(0, 6);
    return [];
  }, [mode, typed, chips, sel]);
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

  const localList = useMemo(() => {
    const needle = typed.toLowerCase();
    if (!needle) return songs;
    return songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(needle));
  }, [typed, songs]);

  // Kalau pencarian online gagal, tetap tampilkan hasil dari daftar yang ada
  const list = mode === 'local' || failed ? localList : results;

  const toggleChip = (label) => {
    setSel((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  };

  const heading =
    mode === 'search'
      ? `Hasil pencarian "${typed}"`
      : mode === 'reco'
      ? 'Rekomendasi sesuai seleramu'
      : 'Dari daftar yang sedang tampil';

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
          <div className="text-[11px] font-bold text-neutral-300 mb-1.5">Pilih seleramu untuk dapat rekomendasi</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {chips.map((c) => {
              const on = sel.includes(c.label);
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => toggleChip(c.label)}
                  aria-pressed={on}
                  className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold text-white border"
                  style={on ? { backgroundColor: suit.primary, borderColor: suit.primary } : { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'transparent' }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-[11px] font-bold text-neutral-400 -mb-1">{heading}</div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {loading && mode !== 'local' && <p className="text-xs text-neutral-400 px-1">Mencari lagu...</p>}
          {failed && <p className="text-[11px] text-neutral-400 px-1">Pencarian online belum tersambung. Menampilkan dari daftar yang ada.</p>}
          {!loading && list.length === 0 && <p className="text-xs text-neutral-400 px-1">Tidak ada lagu.</p>}
          {list.map((s) => {
            const has = pl.tracks.some((t) => t.id === s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(pl.id, s)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white/[0.04] text-left active:scale-[0.99]"
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
          onSave={(data) => {
            onCreate(data);
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
                    if (window.confirm(`Hapus playlist "${pl.name}"?`)) onDelete(pl.id);
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
            <div
              key={`${t.id}-${index}`}
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
            </div>
          );
        })}
      </div>

      {showAdd && (
        <AddSongsSheet suit={suit} pl={pl} songs={songs} onToggle={onToggleTrack} onClose={() => setShowAdd(false)} />
      )}
      {showInfo && (
        <PlaylistEditor
          suit={suit}
          initial={{ name: pl.name, desc: pl.desc || '', cover: pl.cover || null, tracks: pl.tracks }}
          title="Nama & detail"
          saveLabel="Simpan"
          onClose={() => setShowInfo(false)}
          onSave={(data) => {
            onUpdate(pl.id, { name: data.name, desc: data.desc, cover: data.cover });
            setShowInfo(false);
          }}
        />
      )}
    </div>
  );
}
