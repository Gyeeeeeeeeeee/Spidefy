import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Disc3,
  Mic2,
  ListMusic,
  Music,
  Sparkles,
  Tv,
  Headphones,
  Maximize2,
  Minimize2,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  Clock,
  Home,
  Settings,
} from 'lucide-react';

/**
 * Spider-Verse Suit Theme Definitions
 * Controls accent colors, glow shadows, and ambient backdrop gradients.
 */
const SUITS = {
  classic: {
    id: 'classic',
    label: 'Classic',
    fullName: 'Classic Suit',
    primary: '#e62429',
    secondary: '#2563eb',
    glow: 'rgba(230, 36, 41, 0.45)',
    orbA: 'rgba(230, 36, 41, 0.28)',
    orbB: 'rgba(37, 99, 235, 0.22)',
  },
  miles: {
    id: 'miles',
    label: 'Miles',
    fullName: 'Miles Morales',
    primary: '#06b6d4',
    secondary: '#ef4444',
    glow: 'rgba(6, 182, 212, 0.48)',
    orbA: 'rgba(6, 182, 212, 0.26)',
    orbB: 'rgba(239, 68, 68, 0.22)',
  },
  symbiote: {
    id: 'symbiote',
    label: 'Symbiote',
    fullName: 'Symbiote Suit',
    primary: '#a855f7',
    secondary: '#e2e8f0',
    glow: 'rgba(168, 85, 247, 0.52)',
    orbA: 'rgba(168, 85, 247, 0.30)',
    orbB: 'rgba(226, 232, 240, 0.14)',
  },
};

/**
 * Graceful Fallback Catalog (used automatically when /api/ytmusic is unreachable
 * or before Vercel serverless deployment is live).
 */
const FALLBACK_CATALOG = {
  songs: [
    {
      id: 'ApXoWvfEYVU',
      videoId: 'ApXoWvfEYVU',
      title: 'Sunflower',
      artist: 'Post Malone, Swae Lee',
      album: 'Spider-Man: Into the Spider-Verse',
      durationSec: 158,
      durationLabel: '2:38',
      cover: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg',
      lyrics: [
        { time: 0, text: 'Needless to say, I keep her in check' },
        { time: 5, text: 'She was a bad-bad, nevertheless (yeah)' },
        { time: 10, text: 'Callin’ it quits now, baby, I’m a wreck (wreck)' },
        { time: 15, text: 'Crash at my place, baby, you’re a wreck (wreck)' },
        { time: 20, text: 'Needless to say, I keep her in check' },
        { time: 25, text: 'She was a bad-bad, nevertheless' },
        { time: 30, text: 'Callin’ it quits now, baby, I’m a wreck' },
        { time: 35, text: 'Crash at my place, baby, you’re a wreck' },
        { time: 41, text: 'Thinkin’ in a bad way, losin’ your grip' },
        { time: 46, text: 'Screamin’ at my face, baby, don’t trip' },
        { time: 51, text: 'Someone took a big L, don’t know how that felt' },
        { time: 56, text: 'Lookin’ at you sideways, party on tilt' },
        { time: 62, text: 'Ooh-ooh-ooh, you’re a sunflower' },
        { time: 67, text: 'I think your love would be too much' },
        { time: 72, text: 'Or you’ll be left in the dust' },
        { time: 77, text: 'Unless I stuck by ya' },
        { time: 82, text: 'You’re a sunflower' },
        { time: 87, text: 'I think your love would be too much' },
      ],
    },
    {
      id: 'Y88LVU7MAe4',
      videoId: 'Y88LVU7MAe4',
      title: "What's Up Danger",
      artist: 'Blackway & Black Caviar',
      album: 'Spider-Man: Into the Spider-Verse',
      durationSec: 222,
      durationLabel: '3:42',
      cover: 'https://i.ytimg.com/vi/Y88LVU7MAe4/hqdefault.jpg',
      lyrics: [
        { time: 0, text: 'Can’t stop it now, I’m leaping high' },
        { time: 6, text: 'City lights beneath the Brooklyn sky' },
        { time: 12, text: 'Feel the rush when the beat drops low' },
        { time: 18, text: 'Nowhere left to run, nowhere to go' },
        { time: 24, text: 'What’s up danger? (What’s up danger?)' },
        { time: 30, text: 'I like the way it feels when I’m taking a leap' },
        { time: 36, text: 'What’s up danger? (What’s up danger?)' },
        { time: 42, text: 'Promises made that I’m gonna keep' },
        { time: 48, text: 'Up in the air, no safety net' },
        { time: 54, text: 'Best version of me that I haven’t met yet' },
      ],
    },
    {
      id: 'P1z-26Q017o',
      videoId: 'P1z-26Q017o',
      title: 'Am I Dreaming',
      artist: 'Metro Boomin, A$AP Rocky, Roisee',
      album: 'Spider-Man: Across the Spider-Verse',
      durationSec: 256,
      durationLabel: '4:16',
      cover: 'https://i.ytimg.com/vi/P1z-26Q017o/hqdefault.jpg',
      lyrics: [
        { time: 0, text: 'Am I dreaming? Tell me what is real' },
        { time: 7, text: 'Shadows stretching out across the steel' },
        { time: 14, text: 'Every choice echoes through the multiversal tide' },
        { time: 21, text: 'Hold onto the light when there’s nowhere to hide' },
        { time: 28, text: 'Am I dreaming? Wake me up tonight' },
        { time: 35, text: 'Everything we built is burning bright' },
      ],
    },
    {
      id: '4NRXx6U8ABQ',
      videoId: '4NRXx6U8ABQ',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      durationSec: 200,
      durationLabel: '3:20',
      cover: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
      lyrics: [
        { time: 0, text: 'Yeah, I’ve been tryna call' },
        { time: 6, text: 'I’ve been on my own for long enough' },
        { time: 12, text: 'Maybe you can show me how to love, maybe' },
        { time: 18, text: 'I’m going through withdrawals' },
        { time: 24, text: 'You don’t even have to do too much' },
        { time: 30, text: 'You can turn me on with just a touch, baby' },
        { time: 36, text: 'I look around and Sin City’s cold and empty' },
        { time: 43, text: 'No one’s around to judge me' },
        { time: 50, text: 'I’m blinded by the lights' },
        { time: 56, text: 'No, I can’t sleep until I feel your touch' },
      ],
    },
    {
      id: '1G4isv_Fylg',
      videoId: '1G4isv_Fylg',
      title: 'Paradise',
      artist: 'Coldplay',
      album: 'Mylo Xyloto',
      durationSec: 278,
      durationLabel: '4:38',
      cover: 'https://i.ytimg.com/vi/1G4isv_Fylg/hqdefault.jpg',
      lyrics: [
        { time: 0, text: 'When she was just a girl, she expected the world' },
        { time: 8, text: 'But it flew away from her reach so they ran away in her sleep' },
        { time: 16, text: 'And dreamed of para-para-paradise' },
        { time: 23, text: 'Para-para-paradise, para-para-paradise' },
        { time: 30, text: 'Every time she closed her eyes' },
        { time: 38, text: 'Para-para-paradise, para-para-paradise' },
      ],
    },
    {
      id: 'fHI8X4OXluQ',
      videoId: 'fHI8X4OXluQ',
      title: 'Starboy',
      artist: 'The Weeknd ft. Daft Punk',
      album: 'Starboy',
      durationSec: 230,
      durationLabel: '3:50',
      cover: 'https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg',
      lyrics: [
        { time: 0, text: 'I’m tryna put you in the worst mood, ah' },
        { time: 6, text: 'P1 cleaner than your church shoes, ah' },
        { time: 12, text: 'Milli point two just to hurt you, ah' },
        { time: 18, text: 'All red Lamb’ just to tease you, ah' },
        { time: 25, text: 'Look what you’ve done' },
        { time: 30, text: 'I’m a motherfucking starboy' },
      ],
    },
  ],
  albums: [
    {
      id: 'alb-spiderverse-1',
      title: 'Spider-Man: Into the Spider-Verse',
      artist: 'Various Artists',
      year: '2018',
      trackCount: 13,
      cover: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg',
      sampleTrackId: 'ApXoWvfEYVU',
    },
    {
      id: 'alb-spiderverse-2',
      title: 'Spider-Man: Across the Spider-Verse',
      artist: 'Metro Boomin',
      year: '2023',
      trackCount: 13,
      cover: 'https://i.ytimg.com/vi/P1z-26Q017o/hqdefault.jpg',
      sampleTrackId: 'P1z-26Q017o',
    },
    {
      id: 'alb-after-hours',
      title: 'After Hours',
      artist: 'The Weeknd',
      year: '2020',
      trackCount: 14,
      cover: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
      sampleTrackId: '4NRXx6U8ABQ',
    },
    {
      id: 'alb-mylo-xyloto',
      title: 'Mylo Xyloto',
      artist: 'Coldplay',
      year: '2011',
      trackCount: 14,
      cover: 'https://i.ytimg.com/vi/1G4isv_Fylg/hqdefault.jpg',
      sampleTrackId: '1G4isv_Fylg',
    },
  ],
  artists: [
    {
      id: 'art-post-malone',
      name: 'Post Malone',
      subtitle: 'Artist • Hip-Hop / Pop',
      subscribers: '46.2M listeners',
      cover: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg',
      sampleTrackId: 'ApXoWvfEYVU',
    },
    {
      id: 'art-metro-boomin',
      name: 'Metro Boomin',
      subtitle: 'Artist • Producer & Soundtrack',
      subscribers: '28.5M listeners',
      cover: 'https://i.ytimg.com/vi/P1z-26Q017o/hqdefault.jpg',
      sampleTrackId: 'P1z-26Q017o',
    },
    {
      id: 'art-weeknd',
      name: 'The Weeknd',
      subtitle: 'Artist • R&B / Synthpop',
      subscribers: '62.8M listeners',
      cover: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
      sampleTrackId: '4NRXx6U8ABQ',
    },
    {
      id: 'art-coldplay',
      name: 'Coldplay',
      subtitle: 'Artist • Alternative Rock',
      subscribers: '41.0M listeners',
      cover: 'https://i.ytimg.com/vi/1G4isv_Fylg/hqdefault.jpg',
      sampleTrackId: '1G4isv_Fylg',
    },
  ],
  playlists: [
    {
      id: 'pl-spidey-anthology',
      title: 'Spider-Verse Multiverse Mix',
      owner: 'YouTube Music Proxy',
      trackCount: 24,
      cover: 'https://i.ytimg.com/vi/Y88LVU7MAe4/hqdefault.jpg',
      sampleTrackId: 'Y88LVU7MAe4',
    },
    {
      id: 'pl-midnight-drive',
      title: 'Brooklyn Night Drive',
      owner: 'SpideyFy Curated',
      trackCount: 18,
      cover: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
      sampleTrackId: '4NRXx6U8ABQ',
    },
    {
      id: 'pl-starboy-vibes',
      title: 'Neon City Anthems',
      owner: 'YouTube Music Proxy',
      trackCount: 20,
      cover: 'https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg',
      sampleTrackId: 'fHI8X4OXluQ',
    },
    {
      id: 'pl-skyline-chill',
      title: 'Web-Slinging Chill',
      owner: 'SpideyFy Curated',
      trackCount: 16,
      cover: 'https://i.ytimg.com/vi/1G4isv_Fylg/hqdefault.jpg',
      sampleTrackId: '1G4isv_Fylg',
    },
  ],
};

function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function parseLrcText(lrcText) {
  const out = [];
  const pattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/;
  String(lrcText || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(pattern);
      if (!match) return;
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
      const text = match[4].trim();
      if (text) out.push({ time: min * 60 + sec + ms, text });
    });
  return out;
}

function buildPlainLyrics(plainText) {
  return String(plainText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text, idx) => ({ time: idx * 5, text }));
}

function generateSmartLyricsFallback(track) {
  return [
    { time: 0, text: `${track.title} — ${track.artist}` },
    { time: 5, text: `From the album "${track.album || 'Single'}"` },
    { time: 11, text: 'Echoes across the Spider-Verse skyline' },
    { time: 17, text: 'Every beat hits right on time' },
    { time: 23, text: 'Keep moving forward through the night' },
    { time: 29, text: 'Synced lyrics ready whenever LRC timestamps match' },
  ];
}

/**
 * Normalizes flexible responses from /api/ytmusic (ytmusic-api serverless proxy)
 * into clean Songs, Albums, Artists, and Playlists structures.
 */
function normalizeApiPayload(raw) {
  const songsRaw = raw?.songs || raw?.data?.songs || [];
  const albumsRaw = raw?.albums || raw?.data?.albums || [];
  const artistsRaw = raw?.artists || raw?.data?.artists || [];
  const playlistsRaw = raw?.playlists || raw?.data?.playlists || [];

  const songs = songsRaw
    .map((item, idx) => {
      const vid = item.videoId || item.id || `track-${idx}`;
      const sec = Number(item.durationSec ?? item.duration_seconds ?? 180) || 180;
      const artistName = Array.isArray(item.artists)
        ? item.artists.map((a) => a.name || a).join(', ')
        : (item.artist || 'YouTube Music Artist');
      const albumName = typeof item.album === 'object'
        ? (item.album?.name || 'Single')
        : (item.album || 'Single');
      const thumb =
        item.cover ||
        item.thumbnail ||
        (Array.isArray(item.thumbnails) && item.thumbnails[item.thumbnails.length - 1]?.url) ||
        (vid.length === 11 ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : FALLBACK_CATALOG.songs[0].cover);

      return {
        id: String(item.id || vid),
        videoId: vid,
        title: item.title || item.name || 'Untitled Track',
        artist: artistName,
        album: albumName,
        durationSec: sec,
        durationLabel: item.durationLabel || item.duration || formatDuration(sec),
        cover: thumb,
        lyrics: Array.isArray(item.lyrics) ? item.lyrics : null,
      };
    })
    .filter((s) => Boolean(s.videoId));

  const albums = albumsRaw.map((a, idx) => ({
    id: String(a.id || a.browseId || `alb-${idx}`),
    title: a.title || a.name || 'Untitled Album',
    artist: a.artist || (Array.isArray(a.artists) ? a.artists.map((x) => x.name).join(', ') : 'Various Artists'),
    year: a.year || '2024',
    trackCount: Number(a.trackCount || 12),
    cover: a.cover || a.thumbnail || FALLBACK_CATALOG.albums[0].cover,
    sampleTrackId: a.sampleTrackId || songs[idx % Math.max(1, songs.length)]?.id || 'ApXoWvfEYVU',
  }));

  const artists = artistsRaw.map((ar, idx) => ({
    id: String(ar.id || ar.browseId || `art-${idx}`),
    name: ar.name || ar.artist || 'Unknown Artist',
    subtitle: ar.subtitle || 'Artist • YouTube Music',
    subscribers: ar.subscribers || '1.2M listeners',
    cover: ar.cover || ar.thumbnail || FALLBACK_CATALOG.artists[0].cover,
    sampleTrackId: ar.sampleTrackId || songs[idx % Math.max(1, songs.length)]?.id || 'ApXoWvfEYVU',
  }));

  const playlists = playlistsRaw.map((pl, idx) => ({
    id: String(pl.id || pl.playlistId || `pl-${idx}`),
    title: pl.title || pl.name || 'Playlist',
    owner: pl.owner || pl.author || 'YouTube Music',
    trackCount: Number(pl.trackCount || 15),
    cover: pl.cover || pl.thumbnail || FALLBACK_CATALOG.playlists[0].cover,
    sampleTrackId: pl.sampleTrackId || songs[idx % Math.max(1, songs.length)]?.id || 'ApXoWvfEYVU',
  }));

  return {
    songs: songs.length ? songs : FALLBACK_CATALOG.songs,
    albums: albums.length ? albums : FALLBACK_CATALOG.albums,
    artists: artists.length ? artists : FALLBACK_CATALOG.artists,
    playlists: playlists.length ? playlists : FALLBACK_CATALOG.playlists,
  };
}

function SpiderIcon({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <ellipse cx="12" cy="13.5" rx="3" ry="4" fill={color} />
      <circle cx="12" cy="8" r="2" fill={color} />
      <path d="M9 11 L3 7 M9 13 L2 13 M9.5 15 L4 20 M10 17 L7 22 M15 11 L21 7 M15 13 L22 13 M14.5 15 L20 20 M14 17 L17 22" />
    </svg>
  );
}

function WebCorner({ color }) {
  return (
    <svg className="absolute top-0 right-0 w-40 h-40 pointer-events-none" viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="0.6" opacity="0.4" aria-hidden="true">
      <path d="M100 0 L0 0 M100 0 L0 25 M100 0 L0 55 M100 0 L25 100 M100 0 L55 100 M100 0 L100 100" />
      <path d="M85 0 Q80 15 100 18 M65 0 Q58 28 100 36 M45 0 Q38 42 100 56 M25 0 Q18 58 100 78" />
    </svg>
  );
}

const BURST = 'polygon(50% 0, 62% 20%, 85% 12%, 80% 36%, 100% 50%, 80% 64%, 85% 88%, 62% 80%, 50% 100%, 38% 80%, 15% 88%, 20% 64%, 0 50%, 20% 36%, 15% 12%, 38% 20%)';

function HomeView({ songs, currentTrack, isPlaying, suit, onPlay }) {
  const h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const quick = songs.slice(0, 6);
  const cont = [currentTrack, ...songs.filter((x) => x.id !== currentTrack?.id)].filter(Boolean).slice(0, 8);
  const top = songs.slice(0, 10);
  const first = top[0];
  const outline = { WebkitTextStroke: `1px ${suit.primary}`, color: 'transparent' };
  return (
    <div className="space-y-5 pb-4">
      <div className="relative overflow-hidden rounded-2xl p-4 border border-white/10" style={{ background: `linear-gradient(135deg, ${suit.orbA}, rgba(0,0,0,0.4) 70%)` }}>
        <WebCorner color={suit.primary} />
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: suit.primary }}>
          <SpiderIcon size={14} color={suit.primary} /> Your friendly neighborhood player
        </div>
        <h2 className="text-xl font-black italic text-white mt-1">{greet}, Spider-Fan!</h2>
        <p className="text-[11px] text-neutral-300 mt-0.5">Ayunan nada hari ini sudah siap.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {quick.map((t) => (
          <button key={t.id} type="button" onClick={() => onPlay(t)} className="flex items-center gap-2 rounded-lg bg-white/[0.08] overflow-hidden text-left active:scale-95 transition" style={{ borderLeft: `3px solid ${suit.primary}` }}>
            <img src={t.cover} alt={t.title} className="w-11 h-11 object-cover shrink-0" />
            <span className="text-[11px] font-bold text-white line-clamp-2 pr-2">{t.title}</span>
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-black italic text-white mb-2 flex items-center gap-1.5"><SpiderIcon size={14} color={suit.primary} /> Lanjutkan</h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {cont.map((t) => (
            <button key={t.id} type="button" onClick={() => onPlay(t)} className="w-28 shrink-0 text-left active:scale-95 transition">
              <img src={t.cover} alt={t.title} className="w-28 h-28 rounded-xl object-cover" style={{ border: currentTrack?.id === t.id && isPlaying ? `2px solid ${suit.primary}` : '1px solid rgba(255,255,255,0.12)' }} />
              <div className="text-[11px] font-bold text-white truncate mt-1.5">{t.title}</div>
              <div className="text-[10px] text-neutral-400 truncate">{t.artist}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2">
          <span className="px-2 py-0.5 -skew-x-6 text-sm font-black text-white" style={{ background: suit.primary }}>TOP 10</span>
          <span className="text-sm font-black italic text-white">Spider-Chart</span>
        </h3>
        {first && (
          <div onClick={() => onPlay(first)} className="relative overflow-hidden rounded-2xl p-3 mb-2 flex items-center gap-3 cursor-pointer border-2 active:scale-[0.99] transition" style={{ borderColor: suit.primary, boxShadow: `0 0 24px ${suit.glow}`, backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px)', backgroundSize: '8px 8px' }}>
            <div className="relative shrink-0">
              <img src={first.cover} alt={first.title} className="w-24 h-24 rounded-xl object-cover border-2 border-white" />
              <div className="absolute -top-3 -left-3 w-11 h-11 flex items-center justify-center font-black text-white text-sm -rotate-12" style={{ background: suit.primary, clipPath: BURST }}>#1</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: suit.primary }}>No. 1 minggu ini</div>
              <div className="text-base font-black text-white truncate">{first.title}</div>
              <div className="text-xs text-neutral-300 truncate">{first.artist}</div>
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white" style={{ background: suit.primary }}>
                <Play className="w-3 h-3" fill="currentColor" /> Ayun sekarang
              </div>
            </div>
            <div className="absolute right-2 bottom-2 opacity-30"><SpiderIcon size={28} color="#fff" /></div>
          </div>
        )}
        {top.slice(1).map((t, i) => (
          <div key={t.id} onClick={() => onPlay(t)} className="flex items-center gap-3 px-2 py-1.5 rounded-xl cursor-pointer hover:bg-white/[0.06] active:scale-[0.99] transition">
            <span className="w-8 text-center text-2xl font-black italic tabular-nums" style={outline}>{i + 2}</span>
            <img src={t.cover} alt={t.title} className="w-11 h-11 rounded-lg object-cover shrink-0 border border-white/10" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{t.title}</div>
              <div className="text-[11px] text-neutral-400 truncate">{t.artist}</div>
            </div>
            {currentTrack?.id === t.id && isPlaying && <SpiderIcon size={16} color={suit.primary} />}
          </div>
        ))}
      </div>
    </div>
  );
}

const SPIDEY_QUOTES = [
  'Jaring lirik putus di tengah jalan. Tenang, tetangga ramahmu lagi mencari!',
  'Liriknya sembunyi di atas gedung pencakar langit. Nikmati beat-nya dulu!',
  'Indra laba-labaku bilang: lagu ini enak, liriknya menyusul.',
  'Misi hari ini: dengarkan, goyang, ayun!',
  'Lirik belum ketemu, tapi vibes-nya sudah nyangkut di jaring.',
  'Tidak ada lirik? Berarti panggung ini milik instrumennya!',
];

function ChibiSpidey({ color }) {
  return (
    <svg viewBox="0 0 120 130" className="w-28 h-28" aria-hidden="true">
      <path d="M60 0 V16" stroke="#e2e8f0" strokeWidth="1.5" />
      <ellipse cx="60" cy="108" rx="22" ry="17" fill="#2563eb" stroke="#111" strokeWidth="3" />
      <ellipse cx="60" cy="108" rx="9" ry="10" fill={color} />
      <circle cx="35" cy="112" r="7" fill={color} stroke="#111" strokeWidth="3" />
      <circle cx="88" cy="96" r="7" fill={color} stroke="#111" strokeWidth="3" />
      <circle cx="60" cy="56" r="38" fill={color} stroke="#111" strokeWidth="3.5" />
      <path d="M60 18 V94 M24 44 Q60 58 96 44 M30 72 Q60 84 90 72 M42 24 Q48 56 40 90 M78 24 Q72 56 80 90" stroke="#111" strokeWidth="1.2" fill="none" opacity="0.45" />
      <path d="M26 52 Q42 40 56 58 Q40 68 26 52Z" fill="#fff" stroke="#111" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M94 52 Q78 40 64 58 Q80 68 94 52Z" fill="#fff" stroke="#111" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

function NoLyrics({ suit, loading, seed }) {
  const idx = String(seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % SPIDEY_QUOTES.length;
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4 px-3">
      <ChibiSpidey color={suit.primary} />
      <div className="relative px-4 py-3 rounded-2xl border-2 bg-white text-black max-w-xs" style={{ borderColor: '#111' }}>
        <p className="text-sm font-black italic leading-snug">
          {loading ? 'Mencari lirik di jaring...' : SPIDEY_QUOTES[idx]}
        </p>
      </div>
      {!loading && (
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: suit.primary }}>
          Lirik tidak ditemukan
        </span>
      )}
    </div>
  );
}

function SettingsView({ suit, suitId, setSuitId, playbackMode, setPlaybackMode, backendConnected }) {
  return (
    <div className="space-y-4 pb-4">
      <div>
        <h3 className="text-sm font-black italic text-white mb-2">Kostum</h3>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(SUITS).map((x) => (
            <button key={x.id} type="button" onClick={() => setSuitId(x.id)} className="rounded-xl px-2 py-3 text-xs font-bold text-white active:scale-95 transition border-2" style={{ background: `${x.primary}33`, borderColor: suitId === x.id ? x.primary : 'transparent' }}>
              <span className="block w-4 h-4 rounded-full mx-auto mb-1.5" style={{ background: x.primary }} />
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-black italic text-white mb-2">Mode putar</h3>
        <div className="grid grid-cols-2 gap-2">
          {['audio', 'video'].map((m) => (
            <button key={m} type="button" onClick={() => setPlaybackMode(m)} className="rounded-xl py-2.5 text-xs font-bold capitalize text-white border" style={playbackMode === m ? { background: suit.primary, borderColor: suit.primary } : { background: 'rgba(255,255,255,0.06)', borderColor: 'transparent' }}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-white/[0.05] p-3 text-[11px] text-neutral-300 space-y-1">
        <div className="font-bold text-white">Status</div>
        <div>{backendConnected ? 'Terhubung ke pencarian YouTube Music.' : 'Memakai katalog bawaan (pencarian belum terhubung).'}</div>
        <div className="text-neutral-400">Lagu diputar lewat pemutar resmi YouTube, jadi berhenti saat layar mati.</div>
      </div>
    </div>
  );
}

export default function MusicPlayer() {
  // Suit & macOS window state
  const [suitId, setSuitId] = useState('classic');
  const [windowMode, setWindowMode] = useState('normal'); // 'normal' | 'fullscreen' | 'minimized' | 'closed'
  const [activeCatalogTab, setActiveCatalogTab] = useState('home'); // 'home' | 'songs' | 'albums' | 'artists' | 'playlists'
  const [mobilePane, setMobilePane] = useState('catalog'); // 'catalog' | 'lyrics'
  const [clockText, setClockText] = useState('12:00');

  // Catalog & /api/ytmusic connection state
  const [searchQuery, setSearchQuery] = useState('');
  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [backendConnected, setBackendConnected] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Siap dengan katalog bawaan (otomatis terhubung ke /api/ytmusic)');
  const [likedIds, setLikedIds] = useState(['ApXoWvfEYVU', 'Y88LVU7MAe4']);

  // Playback state (Audio mode uses Web Audio / synced timer fallback; Video mode uses YouTube IFrame)
  const [currentTrack, setCurrentTrack] = useState(FALLBACK_CATALOG.songs[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState('audio'); // 'audio' | 'video'
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(FALLBACK_CATALOG.songs[0].durationSec);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  // Synced lyrics state
  const [lyrics, setLyrics] = useState(FALLBACK_CATALOG.songs[0].lyrics);
  const [lyricsSource, setLyricsSource] = useState('Synced Lyrics');
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestSkipRef = useRef(false);

  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const ytApiReadyRef = useRef(false);
  const lyricsScrollRef = useRef(null);
  const activeLineRef = useRef(null);
  const seekBarRef = useRef(null);
  const searchInputRef = useRef(null);

  const suit = SUITS[suitId] || SUITS.classic;

  // Refs agar callback YouTube selalu membaca nilai terbaru
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(80);
  const stepNextRef = useRef(null);
  isPlayingRef.current = isPlaying;
  volumeRef.current = isMuted ? 0 : volume;

  // Live macOS menubar clock
  useEffect(() => {
    const update = () => {
      setClockText(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      ytApiReadyRef.current = true;
      return;
    }
    const existing = document.getElementById('yt-iframe-api-script');
    if (existing) return;

    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.body.appendChild(tag);

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      ytApiReadyRef.current = true;
      if (typeof prevCallback === 'function') prevCallback();
    };
  }, []);

  // Initialize or update YouTube player when switching to Video mode or changing track in Video mode
  useEffect(() => {
    if (!currentTrack?.videoId) return;

    const mountPlayer = () => {
      if (!window.YT || !window.YT.Player || !ytContainerRef.current) return;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        const args = { videoId: currentTrack.videoId, startSeconds: 0 };
        if (isPlayingRef.current) ytPlayerRef.current.loadVideoById(args);
        else ytPlayerRef.current.cueVideoById(args);
        return;
      }

      const mountEl = document.createElement('div');
      mountEl.style.width = '100%';
      mountEl.style.height = '100%';
      ytContainerRef.current.innerHTML = '';
      ytContainerRef.current.appendChild(mountEl);
      ytPlayerRef.current = new window.YT.Player(mountEl, {
        width: '100%',
        height: '100%',
        videoId: currentTrack.videoId,
        playerVars: {
          autoplay: isPlayingRef.current ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (ev) => {
            ev.target.setVolume(volumeRef.current);
            const d = ev.target.getDuration();
            if (d > 0) setDuration(d);
            if (isPlayingRef.current) ev.target.playVideo();
          },
          onStateChange: (ev) => {
            if (ev.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (ev.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (ev.data === window.YT.PlayerState.ENDED) {
              if (stepNextRef.current) stepNextRef.current();
            }
          },
          onError: (ev) => {
            const blocked = ev.data === 101 || ev.data === 150;
            setStatusMessage(
              blocked
                ? 'Lagu ini tidak boleh diputar di luar YouTube, lanjut ke lagu berikutnya'
                : 'Lagu gagal dimuat, lanjut ke lagu berikutnya'
            );
            if (stepNextRef.current) stepNextRef.current();
          },
        },
      });
    };

    if (ytApiReadyRef.current) {
      mountPlayer();
    } else {
      const poll = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(poll);
          mountPlayer();
        }
      }, 250);
      return () => clearInterval(poll);
    }
  }, [currentTrack?.videoId]);

  // Keep YouTube volume synced
  useEffect(() => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      ytPlayerRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Playback progress & YouTube time sync interval
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (
        ytPlayerRef.current &&
        typeof ytPlayerRef.current.getCurrentTime === 'function'
      ) {
        const ytCur = ytPlayerRef.current.getCurrentTime() || 0;
        const ytDur = ytPlayerRef.current.getDuration() || duration;
        setCurrentTime(ytCur);
        if (ytDur > 0) setDuration(ytDur);
      } else {
        setCurrentTime((prev) => {
          const next = prev + 0.5;
          if (next >= duration) {
            return 0;
          }
          return next;
        });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, playbackMode, duration]);

  // Compute active lyric line index based on currentTime
  useEffect(() => {
    if (!lyrics.length) {
      setActiveLineIndex(-1);
      return;
    }
    let idx = 0;
    for (let i = 0; i < lyrics.length; i += 1) {
      if (currentTime >= lyrics[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    setActiveLineIndex(idx);
  }, [currentTime, lyrics]);

  // Smooth auto-scroll active lyric line into view
  useEffect(() => {
    if (activeLineRef.current && lyricsScrollRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  // Fetch synced lyrics from LRCLIB with graceful fallback
  const loadLyricsForTrack = useCallback(async (track) => {
    if (!track) return;
    if (Array.isArray(track.lyrics) && track.lyrics.length > 0) {
      setLyrics(track.lyrics);
      setLyricsSource('Synced Lyrics');
      return;
    }

    setLyrics([]);
    setLyricsSource('Searching LRCLIB...');
    try {
      const cleanTitle = String(track.title || '').replace(/\(.*?\)|\[.*?\]/g, '').trim();
      const firstArtist = String(track.artist || '').split(',')[0].trim();
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(firstArtist)}`;
      const res = await fetch(url);
      if (res.ok) {
        const raw = await res.json();
        const durSec = Number(track.durationSec) || 0;
        const items = Array.isArray(raw)
          ? raw.filter((i) => durSec > 0 && durSec <= 600 && i.duration && Math.abs(Number(i.duration) - durSec) <= 8)
          : [];
        if (items.length > 0) {
          const syncedItem = items.find((i) => i.syncedLyrics);
          const plainItem = items.find((i) => i.plainLyrics);
          if (syncedItem?.syncedLyrics) {
            const parsed = parseLrcText(syncedItem.syncedLyrics);
            if (parsed.length) {
              setLyrics(parsed);
              setLyricsSource('LRCLIB Synced');
              return;
            }
          }
          if (plainItem?.plainLyrics) {
            setLyrics(buildPlainLyrics(plainItem.plainLyrics));
            setLyricsSource('Lyrics');
            return;
          }
        }
      }
    } catch {
      // Fallback below
    }

    setLyrics([]);
    setLyricsSource('Tanpa lirik');
  }, []);

  // Query Vercel Serverless Proxy (/api/ytmusic) with graceful fallback
  const fetchFromYtMusicProxy = useCallback(async (queryText = '') => {
    setIsLoadingCatalog(true);
    const trimmed = queryText.trim();
    setStatusMessage(
      trimmed
        ? `Menghubungi /api/ytmusic untuk "${trimmed}"...`
        : 'Menghubungi /api/ytmusic untuk katalog YouTube Music...'
    );

    try {
      const endpoint = trimmed
        ? `/api/ytmusic?q=${encodeURIComponent(trimmed)}`
        : '/api/ytmusic';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Proxy status ${res.status}`);
      }
      const data = await res.json();
      const normalized = normalizeApiPayload(data);

      setCatalog(normalized);
      setBackendConnected(true);
      setStatusMessage(
        trimmed
          ? `Terhubung ke /api/ytmusic • Hasil untuk "${trimmed}"`
          : 'Terhubung ke /api/ytmusic (YouTube Music Proxy)'
      );
      if (normalized.songs.length > 0) {
        setCurrentTrack((prev) => prev || normalized.songs[0]);
      }
    } catch {
      setBackendConnected(false);
      if (!trimmed) {
        setCatalog(FALLBACK_CATALOG);
        setStatusMessage('Mode Katalog Bawaan aktif (deploy /api/ytmusic ke Vercel untuk live YouTube Music)');
      } else {
        const qLower = trimmed.toLowerCase();
        const filteredSongs = FALLBACK_CATALOG.songs.filter(
          (s) =>
            s.title.toLowerCase().includes(qLower) ||
            s.artist.toLowerCase().includes(qLower) ||
            s.album.toLowerCase().includes(qLower)
        );
        const filteredAlbums = FALLBACK_CATALOG.albums.filter(
          (a) =>
            a.title.toLowerCase().includes(qLower) ||
            a.artist.toLowerCase().includes(qLower)
        );
        const filteredArtists = FALLBACK_CATALOG.artists.filter((ar) =>
          ar.name.toLowerCase().includes(qLower)
        );
        const filteredPlaylists = FALLBACK_CATALOG.playlists.filter((pl) =>
          pl.title.toLowerCase().includes(qLower)
        );

        setCatalog({
          songs: filteredSongs.length ? filteredSongs : FALLBACK_CATALOG.songs,
          albums: filteredAlbums.length ? filteredAlbums : FALLBACK_CATALOG.albums,
          artists: filteredArtists.length ? filteredArtists : FALLBACK_CATALOG.artists,
          playlists: filteredPlaylists.length ? filteredPlaylists : FALLBACK_CATALOG.playlists,
        });
        setStatusMessage(
          `Filter katalog bawaan untuk "${trimmed}" (/api/ytmusic belum terhubung)`
        );
      }
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    fetchFromYtMusicProxy('');
  }, [fetchFromYtMusicProxy]);

  // Saran pencarian + hasil langsung saat mengetik
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    if (suggestSkipRef.current) {
      suggestSkipRef.current = false;
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ytmusic?suggest=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('suggest');
        const data = await res.json();
        setSuggestions((data.suggestions || []).slice(0, 6));
      } catch {
        const ql = q.toLowerCase();
        setSuggestions(
          FALLBACK_CATALOG.songs
            .filter((x) => x.title.toLowerCase().includes(ql) || x.artist.toLowerCase().includes(ql))
            .map((x) => x.title)
            .slice(0, 6)
        );
      }
      fetchFromYtMusicProxy(q);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchFromYtMusicProxy]);

  useEffect(() => {
    if (currentTrack) {
      loadLyricsForTrack(currentTrack);
    }
  }, [currentTrack, loadLyricsForTrack]);

  const handleSelectTrack = useCallback((track, autoPlay = true) => {
    if (!track) return;
    if (currentTrack && track.id === currentTrack.id) {
      setMobilePane('lyrics');
      return;
    }
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.durationSec || 180);
    setActiveLineIndex(0);
    if (autoPlay) {
      setIsPlaying(true);
    }
  }, [currentTrack]);

  const handleTogglePlayPause = useCallback(() => {
    const next = !isPlayingRef.current;
    const pl = ytPlayerRef.current;
    if (pl) {
      if (next && typeof pl.playVideo === 'function') pl.playVideo();
      else if (!next && typeof pl.pauseVideo === 'function') pl.pauseVideo();
    }
    setIsPlaying(next);
  }, []);

  const handleStepTrack = useCallback(
    (delta) => {
      const list = catalog.songs;
      if (!list.length) return;
      const idx = list.findIndex((t) => t.id === currentTrack?.id);
      const nextIdx = idx === -1 ? 0 : (idx + delta + list.length) % list.length;
      handleSelectTrack(list[nextIdx], true);
    },
    [catalog.songs, currentTrack?.id, handleSelectTrack]
  );

  stepNextRef.current = () => handleStepTrack(1);

  // Kontrol layar kunci / notifikasi (Media Session)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    const ms = navigator.mediaSession;
    ms.metadata = new window.MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || '',
      artwork: [{ src: currentTrack.cover, sizes: '480x360', type: 'image/jpeg' }],
    });
    ms.playbackState = isPlaying ? 'playing' : 'paused';
    try {
      ms.setActionHandler('play', () => { if (!isPlayingRef.current) handleTogglePlayPause(); });
      ms.setActionHandler('pause', () => { if (isPlayingRef.current) handleTogglePlayPause(); });
      ms.setActionHandler('nexttrack', () => handleStepTrack(1));
      ms.setActionHandler('previoustrack', () => handleStepTrack(-1));
    } catch {
      // browser tidak mendukung salah satu aksi
    }
  }, [currentTrack, isPlaying, handleTogglePlayPause, handleStepTrack]);

  const handleSeek = (e) => {
    if (!seekBarRef.current || duration <= 0) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = ratio * duration;
    setCurrentTime(targetSec);
    if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(targetSec, true);
    }
  };

  const handleToggleLike = (trackId, e) => {
    if (e) e.stopPropagation();
    setLikedIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const pickSuggestion = (sg) => {
    suggestSkipRef.current = true;
    setSearchQuery(sg);
    setSuggestions([]);
    setShowSuggest(false);
    setActiveCatalogTab('songs');
    fetchFromYtMusicProxy(sg);
  };

  const handleSearchSubmit = (e) => {
    setShowSuggest(false);
    e.preventDefault();
    fetchFromYtMusicProxy(searchQuery);
  };

  const handleCollectionClick = (sampleTrackId) => {
    const match = catalog.songs.find((s) => s.id === sampleTrackId) || catalog.songs[0];
    if (match) {
      handleSelectTrack(match, true);
      setActiveCatalogTab('songs');
    }
  };

  const progressPct = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const isCurrentLiked = currentTrack ? likedIds.includes(currentTrack.id) : false;

  const themeVars = {
    '--suit-primary': suit.primary,
    '--suit-secondary': suit.secondary,
    '--suit-glow': suit.glow,
    '--suit-orb-a': suit.orbA,
    '--suit-orb-b': suit.orbB,
  };

  const windowClass = useMemo(() => {
    const base =
      'w-full h-full flex flex-col overflow-hidden border border-white/15 bg-[#121218]/80 backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.82)] transition-all duration-500';
    if (windowMode === 'fullscreen') {
      return `${base} max-w-none max-h-none rounded-xl`;
    }
    if (windowMode === 'minimized') {
      return `${base} max-w-5xl max-h-[760px] rounded-2xl translate-y-[42vh] scale-[0.16] opacity-0 pointer-events-none`;
    }
    if (windowMode === 'closed') {
      return `${base} max-w-5xl max-h-[760px] rounded-2xl scale-[0.88] opacity-0 pointer-events-none`;
    }
    return `${base} max-w-6xl max-h-[780px] rounded-2xl`;
  }, [windowMode]);

  return (
    <div
      style={themeVars}
      className="relative w-screen h-screen overflow-hidden bg-[#060609] text-neutral-100 select-none flex flex-col"
    >
      {/* Spider-Verse Ambient Backdrop */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-all duration-700"
        style={{
          background: `radial-gradient(circle at 16% 18%, var(--suit-orb-a), transparent 46%), radial-gradient(circle at 84% 82%, var(--suit-orb-b), transparent 50%), linear-gradient(145deg, #06060a 0%, #0e1019 55%, #060609 100%)`,
        }}
      />

      {/* Subtle Web Grid Accent */}
      <svg
        className="pointer-events-none fixed top-0 left-0 w-72 h-72 opacity-35 z-0"
        viewBox="0 0 220 220"
        fill="none"
      >
        <g stroke="var(--suit-primary)" strokeWidth="1" strokeOpacity="0.45">
          <line x1="0" y1="0" x2="210" y2="34" />
          <line x1="0" y1="0" x2="175" y2="110" />
          <line x1="0" y1="0" x2="110" y2="175" />
          <line x1="0" y1="0" x2="34" y2="210" />
          <path d="M52 0 Q55 32 0 42" />
          <path d="M110 0 Q112 72 60 105 Q25 122 0 118" />
          <path d="M168 0 Q166 112 102 162 Q52 190 0 186" />
        </g>
      </svg>

      {/* macOS Top Menu Bar */}
      <header className="relative z-20 h-7 px-3.5 flex items-center justify-between bg-[#0b0b10]/75 backdrop-blur-xl border-b border-white/[0.08] text-[11.5px] font-medium text-neutral-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: suit.primary, boxShadow: `0 0 10px ${suit.glow}` }}
          />
          <span className="font-bold tracking-tight">SpideyFy</span>
          <span className="hidden sm:inline text-neutral-400">• {suit.fullName}</span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
              backendConnected ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {backendConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{backendConnected ? '/api/ytmusic Live' : 'Fallback Catalog'}</span>
          </span>
          <span className="tabular-nums text-neutral-300">{clockText}</span>
        </div>
      </header>

      {/* Main macOS Desktop Stage */}
      <main className="relative z-10 flex-1 min-h-0 flex items-center justify-center p-2.5 sm:p-4 pb-20">
        {(windowMode === 'minimized' || windowMode === 'closed') && (
          <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-3 shadow-2xl"
              style={{ backgroundColor: suit.primary, boxShadow: `0 12px 32px ${suit.glow}` }}
            >
              <Sparkles className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-white">SpideyFy is in the Dock</p>
            <p className="text-xs text-neutral-400 mt-1">Click the SpideyFy dock icon to restore</p>
          </div>
        )}

        <section className={windowClass} aria-label="SpideyFy Window">
          {/* Window Titlebar: Traffic Lights | Suit Switcher */}
          <div className="px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 bg-white/[0.03] border-b border-white/[0.08] shrink-0">
            <div className="flex items-center gap-2 group">
              <button
                type="button"
                onClick={() => setWindowMode('closed')}
                title="Close to Dock"
                aria-label="Close to Dock"
                className="w-3.5 h-3.5 rounded-full bg-[#ff5f57] hover:scale-110 active:scale-90 transition-transform flex items-center justify-center text-[#4a0000]"
              >
                <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                type="button"
                onClick={() => setWindowMode('minimized')}
                title="Minimize to Dock"
                aria-label="Minimize to Dock"
                className="w-3.5 h-3.5 rounded-full bg-[#febc2e] hover:scale-110 active:scale-90 transition-transform flex items-center justify-center text-[#5c3d00]"
              >
                <Minimize2 className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                type="button"
                onClick={() => setWindowMode(windowMode === 'fullscreen' ? 'normal' : 'fullscreen')}
                title="Toggle Fullscreen"
                aria-label="Toggle Fullscreen"
                className="w-3.5 h-3.5 rounded-full bg-[#28c840] hover:scale-110 active:scale-90 transition-transform flex items-center justify-center text-[#004209]"
              >
                <Maximize2 className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>

            {/* Suit Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-black/45 border border-white/10">
              {Object.values(SUITS).map((item) => {
                const active = suitId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSuitId(item.id)}
                    style={
                      active
                        ? { backgroundColor: item.primary, boxShadow: `0 2px 12px ${item.glow}` }
                        : undefined
                    }
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-300 active:scale-95 ${
                      active ? 'text-white' : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main 3-Column Content Area */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1.2fr)_minmax(0,1fr)] overflow-hidden">
            {/* Left Sidebar: Structured YouTube Music Views */}
            <aside className="hidden lg:flex flex-col justify-between p-3.5 bg-black/30 border-r border-white/[0.08] overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 px-1.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: suit.primary, boxShadow: `0 4px 16px ${suit.glow}` }}
                  >
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold tracking-tight text-white truncate">
                      Spidey<span style={{ color: suit.primary }}>Fy</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 font-medium truncate">
                      ytmusic-api proxy
                    </div>
                  </div>
                </div>

                <nav className="space-y-1" aria-label="Catalog Views">
                  {[
                    { id: 'home', label: 'Beranda', icon: Sparkles, count: catalog.songs.length },
                    { id: 'songs', label: 'Songs', icon: Music, count: catalog.songs.length },
                    { id: 'albums', label: 'Albums', icon: Disc3, count: catalog.albums.length },
                    { id: 'artists', label: 'Artists', icon: Mic2, count: catalog.artists.length },
                    { id: 'playlists', label: 'Playlists', icon: ListMusic, count: catalog.playlists.length },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeCatalogTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveCatalogTab(tab.id);
                          setMobilePane('catalog');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                          active
                            ? 'bg-white/12 text-white border border-white/15'
                            : 'text-neutral-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4" style={{ color: active ? suit.primary : undefined }} />
                          <span>{tab.label}</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-neutral-300 tabular-nums">
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] text-neutral-300 space-y-1">
                <div className="font-bold text-white">Liked Tracks</div>
                <div className="text-neutral-400">{likedIds.length} songs saved in session</div>
              </div>
            </aside>

            {/* Center Pane: Search + Structured Songs / Albums / Artists / Playlists */}
            <section
              className={`${
                mobilePane === 'lyrics' ? 'hidden lg:flex' : 'flex'
              } flex-col min-h-0 min-w-0 bg-black/15 lg:border-r border-white/[0.08]`}
            >
              <div className="p-3.5 pb-2.5 space-y-2.5 border-b border-white/[0.07] shrink-0">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSuggest(true);
                        if (activeCatalogTab === 'home' || activeCatalogTab === 'settings') setActiveCatalogTab('songs');
                      }}
                      onFocus={() => setShowSuggest(true)}
                      onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                      placeholder="Search songs, albums, artists, or playlists..."
                      className="w-full bg-black/45 focus:bg-black/65 text-xs sm:text-sm text-white placeholder-neutral-400 rounded-xl pl-9 pr-3 py-2 outline-none border border-white/10 focus:border-white/30 transition"
                    />
                    {showSuggest && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl bg-[#14141c] border border-white/15 shadow-2xl overflow-hidden">
                        {suggestions.map((sg) => (
                          <button
                            key={sg}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickSuggestion(sg)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs text-neutral-200 hover:bg-white/10"
                          >
                            <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate">{sg}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isLoadingCatalog}
                    style={{ backgroundColor: suit.primary, boxShadow: `0 4px 14px ${suit.glow}` }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-white hover:brightness-110 active:scale-95 transition shrink-0 disabled:opacity-60"
                  >
                    {isLoadingCatalog ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
                  </button>
                </form>

                {/* Mobile View Switcher (Songs / Albums / Artists / Playlists + Lyrics) */}
                <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-0.5">
                  {['home', 'songs', 'albums', 'artists', 'playlists'].map((t) => {
                    const active = activeCatalogTab === t && mobilePane === 'catalog';
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setActiveCatalogTab(t);
                          setMobilePane('catalog');
                        }}
                        style={active ? { backgroundColor: suit.primary } : undefined}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold capitalize shrink-0 transition ${
                          active ? 'text-white' : 'bg-white/10 text-neutral-300'
                        }`}
                      >
                        {t === 'home' ? 'Beranda' : t}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setMobilePane('lyrics')}
                    className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-neutral-200 shrink-0"
                  >
                    Lyrics
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
                  <span className="truncate">{statusMessage}</span>
                  <span className="capitalize font-semibold text-neutral-300 shrink-0">{activeCatalogTab === 'home' ? 'Beranda' : activeCatalogTab === 'settings' ? 'Setelan' : activeCatalogTab}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {activeCatalogTab === 'settings' && (
                  <SettingsView
                    suit={suit}
                    suitId={suitId}
                    setSuitId={setSuitId}
                    playbackMode={playbackMode}
                    setPlaybackMode={setPlaybackMode}
                    backendConnected={backendConnected}
                  />
                )}

                {activeCatalogTab === 'home' && (
                  <HomeView
                    songs={catalog.songs}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    suit={suit}
                    onPlay={(t) => handleSelectTrack(t, true)}
                  />
                )}

                {activeCatalogTab === 'songs' &&
                  catalog.songs.map((track, idx) => {
                    const isSelected = currentTrack?.id === track.id;
                    const isLiked = likedIds.includes(track.id);
                    return (
                      <div
                        key={track.id}
                        onClick={() => handleSelectTrack(track, true)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all duration-200 hover:translate-x-0.5 active:scale-[0.99] ${
                          isSelected
                            ? 'bg-white/12 border-white/25'
                            : 'bg-white/[0.03] border-transparent hover:bg-white/[0.07]'
                        }`}
                      >
                        <span className="w-5 text-center text-[11px] font-bold text-neutral-400 tabular-nums shrink-0">
                          {isSelected && isPlaying ? (
                            <span style={{ color: suit.primary }}>▶</span>
                          ) : (
                            idx + 1
                          )}
                        </span>

                        <img
                          src={track.cover}
                          alt={track.title}
                          className="w-11 h-11 rounded-lg object-cover bg-neutral-900 border border-white/10 shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div
                            className="text-xs sm:text-sm font-bold truncate"
                            style={{ color: isSelected ? suit.primary : '#ffffff' }}
                          >
                            {track.title}
                          </div>
                          <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {track.artist} • {track.album}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleLike(track.id, e)}
                          aria-label="Like song"
                          className={`p-1.5 rounded-full transition active:scale-90 ${
                            isLiked ? 'text-rose-500' : 'text-neutral-500 hover:text-white'
                          }`}
                        >
                          <Heart className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} />
                        </button>

                        <span className="text-[11px] text-neutral-400 tabular-nums shrink-0">
                          {track.durationLabel}
                        </span>
                      </div>
                    );
                  })}

                {activeCatalogTab === 'albums' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {catalog.albums.map((alb) => (
                      <div
                        key={alb.id}
                        onClick={() => handleCollectionClick(alb.sampleTrackId)}
                        className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] cursor-pointer transition flex items-center gap-3 group"
                      >
                        <img
                          src={alb.cover}
                          alt={alb.title}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate group-hover:underline">
                            {alb.title}
                          </div>
                          <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {alb.artist}
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-1">
                            {alb.year} • {alb.trackCount} tracks
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {activeCatalogTab === 'artists' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {catalog.artists.map((art) => (
                      <div
                        key={art.id}
                        onClick={() => handleCollectionClick(art.sampleTrackId)}
                        className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] cursor-pointer transition flex items-center gap-3"
                      >
                        <img
                          src={art.cover}
                          alt={art.name}
                          className="w-14 h-14 rounded-full object-cover shrink-0 border-2"
                          style={{ borderColor: suit.primary }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">{art.name}</div>
                          <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {art.subtitle}
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-1">{art.subscribers}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeCatalogTab === 'playlists' && (
                  <div className="space-y-2">
                    {catalog.playlists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => handleCollectionClick(pl.sampleTrackId)}
                        className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] cursor-pointer transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={pl.cover}
                            alt={pl.title}
                            className="w-12 h-12 rounded-lg object-cover shrink-0 border border-white/10"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{pl.title}</div>
                            <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                              {pl.owner} • {pl.trackCount} songs
                            </div>
                          </div>
                        </div>
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: suit.primary }}
                        >
                          Play
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Right Pane: Now Playing + Audio/Video Player + Synced Auto-Scrolling Lyrics */}
            <section
              className={`${
                mobilePane === 'catalog' ? 'hidden lg:flex' : 'flex'
              } flex-col min-h-0 min-w-0 p-4 gap-3.5 overflow-hidden`}
              style={{
                background: `radial-gradient(circle at 50% 15%, ${suit.orbA}, transparent 72%)`,
              }}
            >
              <div className="lg:hidden flex items-center justify-between">
                <span className="text-xs font-bold text-white">Now Playing &amp; Lyrics</span>
                <button
                  type="button"
                  onClick={() => setMobilePane('catalog')}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-neutral-200"
                >
                  Back to Catalog
                </button>
              </div>

              {/* Audio Cover OR YouTube Video Embed */}
              <div
                className={
                  playbackMode === 'video'
                    ? 'w-full aspect-video max-h-44 rounded-xl overflow-hidden bg-black border border-white/15 shadow-xl shrink-0'
                    : 'w-px h-px overflow-hidden opacity-0 pointer-events-none absolute'
                }
              >
                <div ref={ytContainerRef} className="w-full h-full" />
              </div>
              {playbackMode !== 'video' && (
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-black/40 border border-white/10 shrink-0">
                  <img
                    src={currentTrack?.cover || FALLBACK_CATALOG.songs[0].cover}
                    alt={currentTrack?.title || 'Cover'}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 border border-white/15 shadow-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: suit.primary }}
                      />
                      <span>{lyricsSource}</span>
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
                      {currentTrack?.title || 'Select a Track'}
                    </h2>
                    <p className="text-xs text-neutral-400 truncate">
                      {currentTrack?.artist || 'SpideyFy'}
                    </p>
                  </div>
                </div>
              )}

              {/* Synced Auto-Scrolling Lyrics Panel */}
              <div
                ref={lyricsScrollRef}
                className="flex-1 overflow-y-auto px-2 py-6 space-y-3.5 scroll-smooth"
                style={{
                  maskImage: 'linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%)',
                  WebkitMaskImage:
                    'linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%)',
                }}
              >
                {lyrics.length === 0 && (
                  <NoLyrics suit={suit} loading={lyricsSource === 'Searching LRCLIB...'} seed={currentTrack?.id} />
                )}
                {lyrics.map((line, i) => {
                  const isActive = i === activeLineIndex;
                  const isPassed = i < activeLineIndex;
                  return (
                    <p
                      key={`${line.time}-${i}`}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => {
                        setCurrentTime(line.time);
                        if (
                          playbackMode === 'video' &&
                          ytPlayerRef.current &&
                          typeof ytPlayerRef.current.seekTo === 'function'
                        ) {
                          ytPlayerRef.current.seekTo(line.time, true);
                        }
                      }}
                      style={
                        isActive
                          ? {
                              color: '#ffffff',
                              textShadow: `0 0 18px ${suit.glow}, 0 0 34px ${suit.glow}`,
                            }
                          : undefined
                      }
                      className={`text-lg sm:text-xl font-extrabold leading-snug tracking-tight cursor-pointer transition-all duration-300 ${
                        isActive
                          ? 'scale-[1.03] opacity-100'
                          : isPassed
                          ? 'opacity-45 hover:opacity-80 text-neutral-200'
                          : 'opacity-28 hover:opacity-75 text-neutral-300'
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })}
                <div className="h-16" />
              </div>
            </section>
          </div>

          {/* Bottom Player Bar: Track Info | Controls & Seekbar | Audio/Video Toggle & Volume */}
          <footer className="px-3.5 sm:px-5 py-2.5 bg-black/85 border-t border-white/[0.09] grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1.45fr_1fr] items-center gap-3 shrink-0">
            {/* Track Info (tap untuk buka lagu dan lirik) */}
            <div className="flex items-center gap-2.5 min-w-0 cursor-pointer" onClick={() => setMobilePane('lyrics')}>
              <img
                src={currentTrack?.cover || FALLBACK_CATALOG.songs[0].cover}
                alt="Now playing"
                className="w-10 h-10 rounded-lg object-cover border border-white/15 shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white truncate">
                  {currentTrack?.title || 'SpideyFy'}
                </div>
                <div className="text-[11px] text-neutral-400 truncate">
                  {currentTrack?.artist || 'Select a song'}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => currentTrack && handleToggleLike(currentTrack.id, e)}
                aria-label="Toggle favorite"
                className={`hidden sm:inline-flex p-1.5 rounded-full transition ${
                  isCurrentLiked ? 'text-rose-500' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Heart className="w-4 h-4" fill={isCurrentLiked ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Center Transport & Seekbar */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => handleStepTrack(-1)}
                  aria-label="Previous track"
                  className="p-1.5 rounded-full text-neutral-300 hover:text-white active:scale-90 transition"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  style={{ backgroundColor: suit.primary, boxShadow: `0 4px 16px ${suit.glow}` }}
                  className="w-9 h-9 rounded-full text-white flex items-center justify-center hover:scale-105 active:scale-90 transition-transform"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleStepTrack(1)}
                  aria-label="Next track"
                  className="p-1.5 rounded-full text-neutral-300 hover:text-white active:scale-90 transition"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 w-full max-w-md">
                <span className="text-[10.5px] text-neutral-400 tabular-nums w-8 text-right">
                  {formatDuration(currentTime)}
                </span>
                <div
                  ref={seekBarRef}
                  onClick={handleSeek}
                  role="slider"
                  aria-label="Playback progress"
                  className="relative flex-1 h-4 flex items-center cursor-pointer group"
                >
                  <div className="relative w-full h-4 flex items-center">
                    <div className="absolute inset-x-0 h-px bg-white/25" />
                    <div
                      className="absolute left-0 h-[3px] rounded-full transition-[width] duration-150"
                      style={{
                        width: `${progressPct}%`,
                        background: `linear-gradient(90deg, ${suit.secondary}, ${suit.primary})`,
                        boxShadow: `0 0 8px ${suit.glow}`,
                      }}
                    />
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pt) => (
                      <span
                        key={pt}
                        className="absolute w-1 h-1 rounded-full -translate-x-1/2"
                        style={{ left: `${pt}%`, background: progressPct >= pt ? suit.primary : 'rgba(255,255,255,0.25)' }}
                      />
                    ))}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-150"
                      style={{ left: `${progressPct}%` }}
                    >
                      <SpiderIcon size={18} color={suit.primary} />
                    </div>
                  </div>
                </div>
                <span className="text-[10.5px] text-neutral-400 tabular-nums w-8">
                  {formatDuration(duration)}
                </span>
              </div>
            </div>

            {/* Right: Audio / Video Toggle & Volume */}
            <div className="hidden md:flex items-center justify-end gap-2.5">
              <div className="inline-flex rounded-full bg-black/50 p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setPlaybackMode('audio')}
                  style={playbackMode === 'audio' ? { backgroundColor: suit.primary } : undefined}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition ${
                    playbackMode === 'audio' ? 'text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Headphones className="w-3 h-3" />
                  <span>Audio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlaybackMode('video')}
                  style={playbackMode === 'video' ? { backgroundColor: suit.primary } : undefined}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition ${
                    playbackMode === 'video' ? 'text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Tv className="w-3 h-3" />
                  <span>Video</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                aria-label="Toggle mute"
                className="p-1.5 text-neutral-300 hover:text-white transition"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (v > 0) setIsMuted(false);
                }}
                aria-label="Volume"
                className="w-20 accent-white cursor-pointer"
              />
            </div>
          </footer>
        </section>
      </main>

      {/* Navigasi bawah (HP) */}
      <nav aria-label="Navigasi" className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 flex items-stretch bg-[#0b0b10]/95 backdrop-blur-xl border-t border-white/10">
        {[
          { id: 'home', label: 'Beranda', icon: Home },
          { id: 'songs', label: 'Cari', icon: Search },
          { id: 'playlists', label: 'Playlist', icon: ListMusic },
          { id: 'lyrics', label: 'Lirik', icon: Mic2 },
          { id: 'settings', label: 'Setelan', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === 'lyrics' ? mobilePane === 'lyrics' : mobilePane === 'catalog' && activeCatalogTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (windowMode === 'minimized' || windowMode === 'closed') setWindowMode('normal');
                if (tab.id === 'lyrics') {
                  setMobilePane('lyrics');
                } else {
                  setActiveCatalogTab(tab.id);
                  setMobilePane('catalog');
                  if (tab.id === 'songs') setTimeout(() => searchInputRef.current?.focus(), 150);
                }
              }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition"
              style={{ color: active ? suit.primary : '#a3a3a3' }}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Floating macOS Dock (desktop) */}
      <nav
        aria-label="Floating Dock"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#16161e]/75 backdrop-blur-2xl border border-white/15 shadow-[0_16px_42px_rgba(0,0,0,0.75)]"
      >
        <button
          type="button"
          onClick={() =>
            setWindowMode(
              windowMode === 'minimized' || windowMode === 'closed' ? 'normal' : 'minimized'
            )
          }
          title="SpideyFy Window"
          style={{ backgroundColor: suit.primary, boxShadow: `0 4px 16px ${suit.glow}` }}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:-translate-y-1.5 hover:scale-110 active:scale-95 transition-all duration-200"
        >
          <Music className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (windowMode === 'minimized' || windowMode === 'closed') setWindowMode('normal');
            setActiveCatalogTab('songs');
            setMobilePane('catalog');
            setTimeout(() => searchInputRef.current?.focus(), 150);
          }}
          title="Search Catalog"
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white hover:-translate-y-1.5 hover:scale-110 active:scale-95 transition-all duration-200"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (windowMode === 'minimized' || windowMode === 'closed') setWindowMode('normal');
            setMobilePane('lyrics');
          }}
          title="Synced Lyrics"
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white hover:-translate-y-1.5 hover:scale-110 active:scale-95 transition-all duration-200"
        >
          <Clock className="w-4 h-4" />
        </button>

        {(windowMode === 'minimized' || windowMode === 'closed') && currentTrack && (
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-white/15">
            <img
              src={currentTrack.cover}
              alt={currentTrack.title}
              onClick={() => setWindowMode('normal')}
              className="w-8 h-8 rounded-lg object-cover cursor-pointer"
            />
            <div
              onClick={() => setWindowMode('normal')}
              className="max-w-[120px] cursor-pointer"
            >
              <div className="text-[11px] font-bold text-white truncate">{currentTrack.title}</div>
              <div className="text-[9.5px] text-neutral-400 truncate">{currentTrack.artist}</div>
            </div>
            <button
              type="button"
              onClick={handleTogglePlayPause}
              style={{ backgroundColor: suit.primary }}
              className="w-7 h-7 rounded-full text-white flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}