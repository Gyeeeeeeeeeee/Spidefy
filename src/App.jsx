import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { MediaSession } from '@jofr/capacitor-media-session';
import { registerPlugin } from '@capacitor/core';
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
  ListPlus,
  Plus,
  Trash2,
  Check,
  Repeat,
  Repeat1,
  Shuffle,
  Moon,
} from 'lucide-react';
import { PlaylistLibrary, PlaylistDetail } from './PlaylistsView.jsx';
import CoverImg from './CoverImg.jsx';
import { seedQueries, fetchSongs, mergeAlternating, shuffle, artistOf, API_BASE } from './reco.js';

// Paksa YouTube IFrame & WebView mengira layar selalu aktif (tidak pernah hidden/pause)
if (typeof document !== 'undefined') {
  try {
    const realHidden = () => {
      try { return Object.getOwnPropertyDescriptor(Document.prototype, 'hidden').get.call(document); } catch { return false; }
    };
    let lastAway = 0;
    const markAway = () => { if (realHidden()) lastAway = Date.now(); };
    document.addEventListener('visibilitychange', markAway, true);
    window.addEventListener('pagehide', () => { lastAway = Date.now(); }, true);
    window.__spAway = () => {
      let noFocus = false;
      try { noFocus = !document.hasFocus(); } catch { /* abaikan */ }
      return realHidden() || noFocus || Date.now() - lastAway < 3000;
    };
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    const blockVisibility = (e) => {
      e.stopImmediatePropagation();
    };
    document.addEventListener('visibilitychange', blockVisibility, true);
    window.addEventListener('visibilitychange', blockVisibility, true);
    window.addEventListener('pagehide', blockVisibility, true);
    window.addEventListener('blur', blockVisibility, true);
  } catch {
    // abaikan jika tidak didukung
  }
}

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
 * Gaya tambahan per suit (kontras teks, efek judul, bentuk kartu, latar hero).
 */
const SUIT_FX = {
  classic: {
    light: '#ff7a7e',
    titleFx: '0 0 18px rgba(230,36,41,0.6)',
    cardRadius: '8px',
    cardShadow: 'none',
    heroBg: null,
  },
  miles: {
    light: '#67e8f9',
    titleFx: '3px 3px 0 #ef4444, 6px 6px 0 #0e7490',
    cardRadius: '4px',
    cardShadow: '3px 3px 0 #0e7490',
    heroBg: 'linear-gradient(135deg, rgba(6,182,212,0.38) 0%, #07101a 60%, rgba(239,68,68,0.32) 100%)',
  },
  symbiote: {
    light: '#d8b4fe',
    titleFx: '-2px 0 #a855f7, 2px 0 #e2e8f0, 0 0 22px rgba(168,85,247,0.6)',
    cardRadius: '12px',
    cardShadow: 'none',
    heroBg: 'radial-gradient(ellipse at 75% 115%, rgba(168,85,247,0.6) 0%, rgba(60,20,110,0.35) 35%, #05030a 75%)',
  },
};

const bannerPick = {};
const BANNER_MASK = { WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 55%)', maskImage: 'linear-gradient(to right, transparent 0%, #000 55%)' };

// Banner per kostum. Urutan dicoba: banner-<kostum>.mp4 / .webp / .gif / .jpg, lalu banner.jpg.
// MP4/GIF/WebP sudah bergerak sendiri; gambar diam digerakkan pelan (zoom + geser).
function BannerMedia({ suitId }) {
  const cands = [`/banner-${suitId}.mp4`, `/banner-${suitId}.webp`, `/banner-${suitId}.gif`, `/banner-${suitId}.jpg`, '/banner.jpg'];
  const [i, setI] = useState(() => bannerPick[suitId] || 0);
  useEffect(() => { setI(bannerPick[suitId] || 0); }, [suitId]);
  const next = () => {
    bannerPick[suitId] = (bannerPick[suitId] || 0) + 1;
    setI(bannerPick[suitId]);
  };
  if (i >= cands.length) return null;
  const src = cands[i];
  const box = 'absolute right-0 inset-y-0 w-[68%] overflow-hidden pointer-events-none';
  if (src.endsWith('.mp4')) {
    return (
      <div className={box} style={BANNER_MASK}>
        <video
          key={src}
          src={src}
          className="w-full h-full object-cover object-center"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          ref={(el) => { if (el) { el.muted = true; el.play?.().catch(() => {}); } }}
          onError={next}
        />
      </div>
    );
  }
  const animated = src.endsWith('.gif') || src.endsWith('.webp');
  return (
    <div className={box} style={BANNER_MASK}>
      <img key={src} src={src} alt="" className={`w-full h-full object-cover object-center ${animated ? '' : 'hero-drift'}`} onError={next} />
    </div>
  );
}

function SuitHeroArt({ suitId }) {
  if (suitId === 'miles') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 350 190" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <defs>
          <pattern id="mdots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.6" fill="#67e8f9" /></pattern>
        </defs>
        <path className="hero-slide-a" d="M200 0H290L170 190H80z" fill="#ef4444" opacity="0.9" />
        <path className="hero-slide-b" d="M270 0H350V50L240 190H150z" fill="#06b6d4" opacity="0.85" />
        <rect className="hero-pulse" x="200" y="120" width="150" height="70" fill="url(#mdots)" opacity="0.7" />
        <circle className="hero-twinkle" cx="318" cy="24" r="4" fill="#fff" /><circle className="hero-twinkle" style={{ animationDelay: '0.7s' }} cx="300" cy="44" r="2.5" fill="#fff" /><circle className="hero-twinkle" style={{ animationDelay: '1.4s' }} cx="334" cy="52" r="2" fill="#fff" />
        <g transform="rotate(-6 300 150)"><g className="hero-wiggle"><rect x="236" y="138" width="96" height="26" fill="#fde047" /><text x="284" y="156" textAnchor="middle" fontWeight="800" fontSize="13" fill="#0b0f1a">NEW DROP</text></g></g>
      </svg>
    );
  }
  if (suitId === 'symbiote') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 350 190" preserveAspectRatio="xMaxYMid slice" fill="none" aria-hidden="true">
        <rect width="350" height="14" fill="#05030a" />
        <g fill="#05030a">
          {[[26, 30], [78, 16], [136, 46], [196, 22], [250, 40], [304, 18]].map(([x, h]) => (
            <g key={x} className="hero-drip" style={{ animationDelay: `${(x % 7) * 0.35}s` }}><rect x={x - 4} y="8" width="8" height={h} rx="4" /><circle cx={x} cy={8 + h + 3} r="5.5" /></g>
          ))}
        </g>
        <g stroke="#e2e8f0" strokeLinecap="round">
          <path className="hero-draw" pathLength="1" d="M350 190C300 180 290 130 250 126S200 150 170 130" strokeWidth="3" opacity="0.9" />
          <path className="hero-draw" style={{ animationDelay: '0.5s' }} pathLength="1" d="M250 126C255 100 235 90 220 70" strokeWidth="2" opacity="0.7" />
          <path className="hero-draw" style={{ animationDelay: '1s' }} pathLength="1" d="M300 160C330 140 330 110 350 100" strokeWidth="2.2" opacity="0.8" />
        </g>
        <g stroke="#a855f7" strokeWidth="1"><circle className="hero-ring" cx="330" cy="170" r="30" /><circle className="hero-ring" style={{ animationDelay: '1.3s' }} cx="330" cy="170" r="60" /><circle className="hero-ring" style={{ animationDelay: '2.6s' }} cx="330" cy="170" r="90" /></g>
      </svg>
    );
  }
  return null;
}

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
  const raw = String(lrcText || '');
  // tag [offset:+/-ms] dari file LRC (positif = lirik tampil lebih awal)
  const offM = raw.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
  const fileOffset = offM ? parseInt(offM[1], 10) / 1000 : 0;
  const stamp = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  raw.split(/\r?\n/).forEach((line) => {
    const stamps = [...line.matchAll(stamp)];
    if (!stamps.length) return;
    const text = line.replace(stamp, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
    if (!text) return;
    stamps.forEach((m) => {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
      out.push({ time: Math.max(0, min * 60 + sec + ms - fileOffset), text });
    });
  });
  out.sort((a, b) => a.time - b.time);
  return out;
}

// ---- Pencocokan lirik yang ketat (supaya lagu instrumental tidak dapat lirik lagu lain) ----
const normLyr = (x) =>
  String(x || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function wordsOverlap(a, b) {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((w) => {
    if (B.has(w)) n += 1;
  });
  return n / Math.max(A.size, B.size);
}

const rawNorm = (x) =>
  String(x || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Penanda versi lagu (hanya dibaca dari kurung / setelah tanda "-", supaya judul seperti "Live Forever" tidak salah)
const VERSION_TAGS = ['taylor s version', 'from the vault', '10 minute version', 'radio edit', 'album version', 'single version', 'acoustic', 'live', 'remix', 'sped up', 'speed up', 'slowed', 'reverb', 'nightcore', 'piano', 'unplugged', 'demo', 'extended', '8d', 'lofi', 'lo fi', 'cover'];

function titleExtras(title) {
  const t = String(title || '');
  const parts = [];
  (t.match(/\([^)]*\)|\[[^\]]*\]/g) || []).forEach((m) => parts.push(m));
  const dash = t.split(/\s[-\u2013\u2014]\s/);
  if (dash.length > 1) parts.push(dash.slice(1).join(' '));
  return ` ${rawNorm(parts.join(' '))} `;
}

function versionTags(title) {
  const ex = titleExtras(title);
  return VERSION_TAGS.filter((tag) => ex.includes(` ${tag} `));
}

// Judul bisa punya embel-embel film / versi: "Sunflower - Spider-Man: Into the Spider-Verse", "Artis - Judul (Official Video)"
function titleVariants(title, artist) {
  let noParen = String(title || '').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim();
  const noNoise = noParen
    .replace(/\s+[-|\u2013]?\s*(official(\s+(music|lyric|audio|video))*|lyric\s+video|music\s+video|lyrics?|visuali[sz]er)\b.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (noNoise) noParen = noNoise;
  const out = [];
  const add = (v) => {
    const t = String(v || '').replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/i, '').replace(/\s+/g, ' ').trim();
    if (t && !out.includes(t)) out.push(t);
  };
  // "Nama Artis - Judul": buang nama artis di depan, ini yang paling sering bikin lirik tidak ketemu
  const parts = noParen.split(/\s[-\u2013\u2014]\s/);
  if (parts.length > 1 && artist) {
    const left = normLyr(parts[0]);
    const a = normLyr(artist);
    if (left && a && (a.includes(left) || left.includes(a) || wordsOverlap(left, a) >= 0.5)) {
      add(parts.slice(1).join(' - '));
      add(parts[1]);
    }
  }
  add(noParen);
  add(parts[0]);
  add(noParen.split(/\s\|\s/)[0]);
  return out;
}

function firstArtistOf(artist) {
  return String(artist || '')
    .split(/,|&|\sx\s|\sfeat\.?\s|\sft\.?\s/i)[0]
    .trim();
}

// Skor kecocokan kandidat LRCLIB. -1 = tidak cocok. Makin tinggi makin baik.
// durSec <= 0 berarti durasi lagu belum diketahui -> filter durasi dimatikan.
function lyricsScore(item, track, variants, durSec, tol = 3, relaxed = false) {
  if (!item) return -1;
  const t1 = normLyr(item.trackName || item.name);
  if (!t1) return -1;
  const itemBase = normLyr(String(item.trackName || item.name || '').split(/\s[-\u2013\u2014]\s/)[0]);
  let titleExact = false;
  const titleOk = variants.some((v) => {
    const t2 = normLyr(v);
    if (!t2) return false;
    if (t1 === t2 || itemBase === t2) {
      titleExact = true;
      return true;
    }
    return wordsOverlap(t1, t2) >= 0.8;
  });
  if (!titleOk) return -1;
  const a1 = normLyr(item.artistName);
  const a2 = normLyr(track.artist);
  if (a1 && a2 && !(relaxed && titleExact)) {
    const words2 = a2.split(' ');
    const hit = a1.split(' ').some((w) => w.length > 2 && words2.includes(w));
    if (!hit && !a2.includes(a1) && !a1.includes(a2)) return -1;
  }
  let d = 2;
  if (durSec > 0 && item.duration) {
    d = Math.abs(Number(item.duration) - durSec);
    if (d > tol) return -1;
  }
  let score = 100 - d * (relaxed ? 5 : 12);
  if (item.syncedLyrics) score += 15;
  const want = versionTags(track.title).join('|');
  const got = versionTags(item.trackName || item.name).join('|');
  if (want !== got) score -= 60; // versi lain (mis. acoustic vs studio): boleh dipakai, tapi paling akhir
  return score;
}

// Hasil pencarian lirik disimpan di memori supaya lagu yang diputar ulang langsung muncul liriknya
const LYRICS_CACHE = new Map();

// Kompensasi jeda render + audio: baris lirik dimajukan sedikit supaya terasa pas dengan suara
const LYRIC_LEAD = 0.35;

function activeLyricIndex(lyrics, t) {
  let idx = -1;
  for (let i = 0; i < lyrics.length; i += 1) {
    if (t >= lyrics[i].time) idx = i;
    else break;
  }
  return idx;
}

const INSTRUMENTAL_TITLE = /\b(instrumental|karaoke|inst\.?)\b/i;

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
      const rawSec = Number(item.durationSec ?? item.duration_seconds);
      const sec = rawSec > 0 ? rawSec : 180;
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
        durationGuess: !(rawSec > 0),
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

function ShuffleButton({ on, onClick, suit, big }) {
  const label = on ? 'Acak lagu: hidup' : 'Acak lagu: mati';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={on}
      style={on ? { color: suit.primary, filter: `drop-shadow(0 0 6px ${suit.glow})` } : undefined}
      className={`${big ? 'w-10 h-10' : 'p-1.5'} rounded-full flex items-center justify-center transition active:scale-90 ${
        on ? '' : 'text-neutral-400 hover:text-white'
      }`}
    >
      <Shuffle className={big ? 'w-5 h-5' : 'w-4 h-4'} />
    </button>
  );
}

function RepeatButton({ mode, onClick, suit, big }) {
  const active = mode !== 'off';
  const Icon = mode === 'one' ? Repeat1 : Repeat;
  const label = mode === 'off' ? 'Ulangi: mati' : mode === 'all' ? 'Ulangi semua lagu' : 'Ulangi satu lagu';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={active ? { color: suit.primary } : undefined}
      className={`${big ? 'w-10 h-10' : 'p-1.5'} rounded-full flex items-center justify-center transition active:scale-90 ${
        active ? '' : 'text-neutral-400 hover:text-white'
      }`}
    >
      <Icon className={big ? 'w-6 h-6' : 'w-4 h-4'} />
    </button>
  );
}

function readSaved(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeSaved(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // penyimpanan tidak tersedia
  }
}

const SAVED_LAST = readSaved('spideyfy-last', null);
// Dynamic Island = overlay native Android (hanya aktif di APK), muncul saat app ditinggal lewat tombol Home
const Island = registerPlugin('Island');
const IS_NATIVE =
  typeof window !== 'undefined' &&
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const ISLAND_OK =
  IS_NATIVE &&
  !!(window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Island'));

const SAVED_PREFS = readSaved('spideyfy-prefs', null) || {};
const SAVED_HISTORY_RAW = readSaved('spideyfy-history', []);
const SAVED_HISTORY = Array.isArray(SAVED_HISTORY_RAW) ? SAVED_HISTORY_RAW.filter((x) => x && x.videoId) : [];
const RESTORED_TRACK =
  SAVED_LAST && SAVED_LAST.track && SAVED_LAST.track.videoId ? SAVED_LAST.track : null;
const RESTORED_TIME = RESTORED_TRACK ? Number(SAVED_LAST.time) || 0 : 0;

function slimTrack(t) {
  return {
    id: t.id,
    videoId: t.videoId,
    title: t.title,
    artist: t.artist,
    album: t.album,
    durationSec: t.durationSec,
    durationGuess: t.durationGuess,
    durationLabel: t.durationLabel,
    cover: t.cover,
    lyrics: null,
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

// Rekomendasi di beranda: mengikuti lagu yang kamu putar dan kamu masukkan ke playlist
function RecoRow({ songs, seeds, ownedIds, currentTrack, isPlaying, suit, onPlay }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const seedKey = seeds.slice(0, 8).map((x) => x.id).join(',');
  const ownedRef = useRef(ownedIds);
  ownedRef.current = ownedIds;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      let out = [];
      const qs = seedQueries(seeds, 3);
      if (qs.length) {
        try {
          const lists = await Promise.all(qs.map((q) => fetchSongs(q, controller.signal).catch(() => null)));
          out = mergeAlternating(lists, 40).filter((x) => !ownedRef.current.has(x.id));
          if (nonce > 0) out = shuffle(out);
        } catch { /* pakai cadangan di bawah */ }
      }
      if (cancelled) return;
      if (!out.length) out = shuffle(songs.filter((x) => !ownedRef.current.has(x.id)));
      setList(out.slice(0, 12));
      setLoading(false);
    })();
    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, nonce]);

  const names = [...new Set(seeds.map(artistOf).filter(Boolean))].slice(0, 2);
  if (!list.length && !loading) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-black italic text-white flex items-center gap-1.5"><SpiderIcon size={14} color={suit.primary} /> Rekomendasi</h3>
        <button type="button" onClick={() => setNonce((n) => n + 1)} aria-label="Segarkan rekomendasi" className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white active:scale-95 transition">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Segarkan
        </button>
      </div>
      {names.length > 0 && <p className="text-[11px] text-neutral-400 -mt-1 mb-2 truncate">Karena kamu suka {names.join(' & ')}</p>}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {list.map((t) => (
          <button key={t.id} type="button" onClick={() => onPlay(t)} className="w-28 shrink-0 text-left active:scale-95 transition">
            <CoverImg src={t.cover} videoId={t.videoId || t.id} alt={t.title} className="w-28 h-28 rounded-xl object-cover" style={{ border: currentTrack?.id === t.id && isPlaying ? `2px solid ${suit.primary}` : '1px solid rgba(255,255,255,0.12)' }} />
            <div className="text-[11px] font-bold text-white truncate mt-1.5">{t.title}</div>
            <div className="text-[10px] text-neutral-400 truncate">{t.artist}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- RECAP: statistik lagu yang sering diputar ----------------
const STATS_KEY = 'spideyfy-stats';

function loadStats() {
  const st = readSaved(STATS_KEY, null);
  if (st && typeof st === 'object' && st.tracks && typeof st.tracks === 'object') return st;
  return { since: Date.now(), total: 0, tracks: {} };
}

// Catat lama & jumlah putar tiap lagu (disimpan di HP). 1 putaran = didengarkan minimal 30 detik.
function useListeningStats(track, playing) {
  const statsRef = useRef(null);
  if (statsRef.current === null) statsRef.current = loadStats();
  const sessRef = useRef({ id: null, secs: 0 });
  const trackId = track && track.id;
  useEffect(() => {
    if (!playing || !trackId) return undefined;
    if (sessRef.current.id !== trackId) sessRef.current = { id: trackId, secs: 0 };
    let last = Date.now();
    const per = Math.max(60, Number(track.durationSec) || 180);
    const playsFor = (secs) => (secs < 30 ? 0 : 1 + Math.floor((secs - 30) / per));
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(15, (now - last) / 1000);
      last = now;
      if (dt <= 0) return;
      const st = statsRef.current;
      const t = st.tracks[trackId] || { id: trackId, plays: 0, secs: 0 };
      t.videoId = track.videoId;
      t.title = track.title;
      t.artist = track.artist;
      t.album = track.album;
      t.cover = track.cover;
      t.durationSec = track.durationSec;
      t.durationLabel = track.durationLabel;
      t.secs = (t.secs || 0) + dt;
      st.total = (st.total || 0) + dt;
      const before = sessRef.current.secs;
      sessRef.current.secs += dt;
      t.plays = (t.plays || 0) + (playsFor(sessRef.current.secs) - playsFor(before));
      st.tracks[trackId] = t;
    };
    const flush = () => {
      const st = statsRef.current;
      const ids = Object.keys(st.tracks);
      if (ids.length > 400) {
        ids
          .sort((a, b) => (st.tracks[b].secs || 0) - (st.tracks[a].secs || 0))
          .slice(300)
          .forEach((k) => {
            delete st.tracks[k];
          });
      }
      writeSaved(STATS_KEY, st);
    };
    const iv = setInterval(tick, 1000);
    const fl = setInterval(flush, 10000);
    return () => {
      tick();
      flush();
      clearInterval(iv);
      clearInterval(fl);
    };
  }, [playing, trackId]);
}

function recapList(stats) {
  return Object.values((stats && stats.tracks) || {})
    .filter((t) => t && t.title && (t.plays > 0 || t.secs >= 45))
    .map((t) => ({ ...t, plays: Math.max(1, t.plays || 0) }))
    .sort((a, b) => b.plays - a.plays || (b.secs || 0) - (a.secs || 0));
}

function recapArtists(list) {
  const m = {};
  list.forEach((t) => {
    const name = firstArtistOf(t.artist) || 'Tidak diketahui';
    const x = m[name] || (m[name] = { name, plays: 0, secs: 0, cover: t.cover, videoId: t.videoId, id: t.id });
    x.plays += t.plays;
    x.secs += t.secs || 0;
  });
  return Object.values(m).sort((a, b) => b.plays - a.plays || b.secs - a.secs);
}

function useCountUp(target, run, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) {
      setV(0);
      return undefined;
    }
    let raf;
    let t0 = 0;
    const step = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

const RECAP_CSS = `
@keyframes rcRise{from{opacity:0;transform:translate3d(0,22px,0)}to{opacity:1;transform:none}}
@keyframes rcPop{0%{opacity:0;transform:scale(.55) rotate(-6deg)}60%{opacity:1;transform:scale(1.07) rotate(1deg)}100%{opacity:1;transform:none}}
@keyframes rcBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes rcSpin{to{transform:rotate(360deg)}}
@keyframes rcEq{0%,100%{transform:scaleY(.22)}50%{transform:scaleY(1)}}
@keyframes rcFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-12px,0)}}
@keyframes rcRing{0%{transform:scale(.55);opacity:.7}100%{transform:scale(1.5);opacity:0}}
@keyframes rcFade{from{opacity:0}to{opacity:1}}
`;

function RecapBars({ color, n = 5, h = 28 }) {
  return (
    <div className="flex items-end gap-1" style={{ height: h }}>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: '100%',
            borderRadius: 2,
            background: color,
            transformOrigin: 'bottom',
            animation: `rcEq ${0.7 + (i % 3) * 0.22}s ${i * 0.11}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
  );
}

const RECAP_SLIDE_MS = 5200;

function RecapModal({ stats, suit, onClose, onPlay }) {
  const list = useMemo(() => recapList(stats), [stats]);
  const artists = useMemo(() => recapArtists(list), [list]);
  const minutes = Math.round((stats.total || 0) / 60);
  const top = list[0];
  const slides = list.length ? 4 : 1;
  const [slide, setSlide] = useState(0);
  const minCount = useCountUp(minutes, slide === 0);
  const playCount = useCountUp(top ? top.plays : 0, slide === 1, 1300);

  useEffect(() => {
    if (slide >= slides - 1) return undefined;
    const t = setTimeout(() => setSlide((x) => Math.min(slides - 1, x + 1)), RECAP_SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide, slides]);

  const go = (d) => setSlide((x) => Math.max(0, Math.min(slides - 1, x + d)));
  const top5 = list.slice(0, 5);
  const maxPlays = top5.length ? top5[0].plays : 1;
  const topArtist = artists[0];

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col text-white overflow-hidden"
      style={{ zIndex: 300, background: '#07070d', animation: 'rcFade .25s both', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <style>{RECAP_CSS}</style>
      <div aria-hidden="true" className="absolute -top-24 -left-20 w-72 h-72 rounded-full blur-3xl opacity-50" style={{ background: suit.primary, animation: 'rcFloat 6s infinite ease-in-out' }} />
      <div aria-hidden="true" className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full blur-3xl opacity-40" style={{ background: suit.secondary, animation: 'rcFloat 7.5s infinite ease-in-out' }} />

      <div className="relative flex gap-1.5 px-4 pt-3 shrink-0">
        {Array.from({ length: slides }).map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden">
            <div
              key={`${i}-${slide}`}
              className="h-full rounded-full bg-white"
              style={{
                transformOrigin: 'left',
                transform: i < slide ? 'scaleX(1)' : 'scaleX(0)',
                animation: i === slide && slide < slides - 1 ? `rcBar ${RECAP_SLIDE_MS}ms linear forwards` : undefined,
                ...(i === slide && slide === slides - 1 ? { transform: 'scaleX(1)' } : null),
              }}
            />
          </div>
        ))}
      </div>
      <div className="relative flex items-center justify-between px-4 pt-3 shrink-0">
        <div className="text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: suit.secondary }}>SpideyFy Recap</div>
        <button type="button" onClick={onClose} aria-label="Tutup recap" className="p-2 rounded-full bg-white/10 active:scale-90 transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center" key={slide}>
        {list.length === 0 && (
          <div style={{ animation: 'rcRise .6s both' }}>
            <div className="mx-auto mb-5 w-24 h-24 rounded-full flex items-center justify-center" style={{ background: `${suit.primary}33`, border: `2px solid ${suit.primary}` }}>
              <Headphones className="w-10 h-10" />
            </div>
            <div className="text-xl font-black">Recap-mu masih kosong</div>
            <p className="text-sm text-neutral-300 mt-2">Putar beberapa lagu dulu. Setelah itu lagu yang paling sering kamu dengar akan muncul di sini.</p>
          </div>
        )}

        {list.length > 0 && slide === 0 && (
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44 flex items-center justify-center mb-6">
              {[0, 1, 2].map((i) => (
                <span key={i} className="absolute inset-0 rounded-full" style={{ border: `2px solid ${suit.primary}`, animation: `rcRing 2.6s ${i * 0.85}s infinite ease-out` }} />
              ))}
              <RecapBars color={suit.primary} n={7} h={64} />
            </div>
            <div className="text-xs font-black tracking-[0.3em] uppercase" style={{ color: suit.secondary, animation: 'rcRise .6s both' }}>Recap kamu</div>
            <div className="text-7xl font-black mt-2 tabular-nums" style={{ animation: 'rcPop .8s .15s both' }}>{minCount}</div>
            <div className="text-lg font-bold" style={{ animation: 'rcRise .6s .45s both' }}>menit mendengarkan</div>
            <div className="text-sm text-neutral-300 mt-3" style={{ animation: 'rcRise .6s .7s both' }}>dari {list.length} lagu berbeda</div>
          </div>
        )}

        {list.length > 0 && slide === 1 && top && (
          <div className="flex flex-col items-center w-full">
            <div className="text-xs font-black tracking-[0.3em] uppercase mb-4" style={{ color: suit.secondary, animation: 'rcRise .5s both' }}>Lagu favoritmu</div>
            <div className="relative w-56 h-56 mb-5" style={{ animation: 'rcPop .9s .1s both' }}>
              <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 50px ${suit.glow}`, animation: 'rcSpin 14s linear infinite' }}>
                <CoverImg src={top.cover} videoId={top.videoId || top.id} alt={top.title} className="w-full h-full rounded-full object-cover" style={{ border: `4px solid ${suit.primary}` }} />
              </div>
              <div className="absolute left-1/2 top-1/2 w-8 h-8 -ml-4 -mt-4 rounded-full" style={{ background: '#07070d', border: '3px solid rgba(255,255,255,0.35)' }} />
              <div className="absolute -top-2 -right-2 w-14 h-14 flex items-center justify-center font-black text-lg -rotate-12" style={{ background: suit.primary, clipPath: BURST }}>#1</div>
            </div>
            <div className="text-2xl font-black leading-tight line-clamp-2 max-w-full" style={{ animation: 'rcRise .6s .4s both' }}>{top.title}</div>
            <div className="text-sm text-neutral-300 mt-1 truncate max-w-full" style={{ animation: 'rcRise .6s .55s both' }}>{top.artist}</div>
            <div className="mt-4 flex items-baseline gap-2" style={{ animation: 'rcRise .6s .7s both' }}>
              <span className="text-5xl font-black tabular-nums" style={{ color: suit.primary }}>{playCount}</span>
              <span className="text-base font-bold">kali diputar</span>
            </div>
            <div className="text-xs text-neutral-400 mt-1" style={{ animation: 'rcRise .6s .85s both' }}>{Math.max(1, Math.round((top.secs || 0) / 60))} menit kamu habiskan bareng lagu ini</div>
          </div>
        )}

        {list.length > 0 && slide === 2 && (
          <div className="w-full max-w-sm">
            <div className="text-xs font-black tracking-[0.3em] uppercase mb-4" style={{ color: suit.secondary, animation: 'rcRise .5s both' }}>Top {top5.length} lagu</div>
            <div className="space-y-3 text-left">
              {top5.map((t, i) => (
                <div key={t.id} style={{ animation: `rcRise .5s ${0.1 + i * 0.14}s both` }}>
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-center text-lg font-black" style={{ color: i === 0 ? suit.primary : 'rgba(255,255,255,0.6)' }}>{i + 1}</span>
                    <CoverImg src={t.cover} videoId={t.videoId || t.id} alt={t.title} className="w-11 h-11 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">{t.title}</div>
                      <div className="text-[11px] text-neutral-400 truncate">{t.artist}</div>
                    </div>
                    <span className="text-xs font-black tabular-nums shrink-0">{t.plays}x</span>
                  </div>
                  <div className="mt-1.5 ml-8 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(8, (t.plays / maxPlays) * 100)}%`, background: i === 0 ? suit.primary : suit.secondary, transformOrigin: 'left', animation: `rcBar .9s ${0.35 + i * 0.14}s cubic-bezier(.2,.8,.2,1) both` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {list.length > 0 && slide === 3 && topArtist && (
          <div className="flex flex-col items-center w-full max-w-sm">
            <div className="text-xs font-black tracking-[0.3em] uppercase mb-4" style={{ color: suit.secondary, animation: 'rcRise .5s both' }}>Artis teratas</div>
            <CoverImg src={topArtist.cover} videoId={topArtist.videoId || topArtist.id} alt={topArtist.name} className="w-32 h-32 rounded-full object-cover" style={{ border: `4px solid ${suit.primary}`, boxShadow: `0 0 40px ${suit.glow}`, animation: 'rcPop .8s .1s both' }} />
            <div className="text-3xl font-black mt-4 leading-tight line-clamp-2" style={{ animation: 'rcRise .6s .4s both' }}>{topArtist.name}</div>
            <div className="text-sm text-neutral-300 mt-1" style={{ animation: 'rcRise .6s .55s both' }}>{topArtist.plays} kali diputar · {Math.max(1, Math.round(topArtist.secs / 60))} menit</div>
            {artists.length > 1 && (
              <div className="mt-5 w-full space-y-1.5 text-left">
                {artists.slice(1, 4).map((a, i) => (
                  <div key={a.name} className="flex items-center justify-between rounded-xl bg-white/[0.07] px-3 py-2" style={{ animation: `rcRise .5s ${0.7 + i * 0.12}s both` }}>
                    <span className="text-sm font-bold truncate">{i + 2}. {a.name}</span>
                    <span className="text-xs text-neutral-300 shrink-0 ml-2">{a.plays}x</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex gap-2 w-full" style={{ animation: 'rcRise .6s 1.1s both' }}>
              <button type="button" onClick={() => { onClose(); if (top) onPlay(top); }} className="flex-1 rounded-full py-3 text-sm font-black active:scale-95 transition" style={{ background: suit.primary }}>
                Putar lagu #1
              </button>
              <button type="button" onClick={onClose} className="flex-1 rounded-full py-3 text-sm font-black bg-white/10 active:scale-95 transition">Selesai</button>
            </div>
          </div>
        )}
      </div>

      {list.length > 0 && (
        <>
          <button type="button" aria-label="Sebelumnya" onClick={() => go(-1)} className="absolute left-0 top-28 bottom-28 w-1/4" style={{ background: 'transparent' }} />
          <button type="button" aria-label="Berikutnya" onClick={() => go(1)} className="absolute right-0 top-28 bottom-28 w-1/4" style={{ background: 'transparent' }} />
        </>
      )}
    </div>,
    document.body
  );
}

function RecapCard({ suit, onPlay }) {
  const [stats, setStats] = useState(() => loadStats());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setStats(loadStats()), 15000);
    return () => clearInterval(iv);
  }, []);
  const list = recapList(stats);
  const top3 = list.slice(0, 3);
  const openRecap = () => {
    setStats(loadStats());
    setOpen(true);
  };
  return (
    <>
      <style>{RECAP_CSS}</style>
      <button
        type="button"
        onClick={openRecap}
        className="w-full text-left relative overflow-hidden rounded-2xl p-3 active:scale-[0.99] transition"
        style={{ border: `1px solid ${suit.primary}88`, background: `linear-gradient(120deg, ${suit.orbA} 0%, rgba(8,8,16,0.92) 70%)`, boxShadow: `0 0 18px ${suit.glow}` }}
      >
        {top3.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${suit.primary}33` }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: suit.primary }}>Recap kamu</div>
              <div className="text-xs text-neutral-300">Putar beberapa lagu, nanti lagu favoritmu muncul di sini.</div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex shrink-0">
              {top3.map((t, i) => (
                <div key={t.id} className="relative" style={{ marginLeft: i === 0 ? 0 : -14, zIndex: 3 - i }}>
                  <CoverImg src={t.cover} videoId={t.videoId || t.id} alt={t.title} className="w-12 h-12 rounded-xl object-cover" style={{ border: '2px solid #0b0b10' }} />
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white" style={{ background: suit.primary }}>{i + 1}</span>
                </div>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: suit.primary }}>Recap kamu</div>
              <div className="text-sm font-black text-white truncate">{top3[0].title}</div>
              <div className="text-[11px] text-neutral-300 truncate">Paling sering diputar · {top3[0].plays}x</div>
            </div>
            <RecapBars color={suit.primary} n={4} h={24} />
            <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
          </div>
        )}
      </button>
      {open && <RecapModal stats={stats} suit={suit} onClose={() => setOpen(false)} onPlay={onPlay} />}
    </>
  );
}

function HomeView({ songs, currentTrack, isPlaying, suit, onPlay, history = [], seeds = [], ownedIds = new Set() }) {
  const h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const quick = songs.slice(0, 6);
  const cont = [
    ...history,
    ...songs.filter((x) => !history.some((h) => h.id === x.id)),
  ].filter(Boolean).slice(0, 12);
  const top = songs.slice(0, 10);
  const first = top[0];
  const outline = { WebkitTextStroke: `1px ${suit.primary}`, color: 'transparent' };
  const fx = SUIT_FX[suit.id] || SUIT_FX.classic;
  return (
    <div className="stagger space-y-5 pb-4">
      <div className="relative overflow-hidden rounded-3xl p-5 min-h-[190px] flex flex-col justify-center" style={{ border: `1px solid ${suit.primary}88`, boxShadow: `0 0 24px ${suit.glow}, inset 0 0 40px rgba(0,0,0,0.5)`, background: fx.heroBg || `linear-gradient(120deg, ${suit.orbA} 0%, rgba(8,8,16,0.95) 60%, ${suit.orbB} 100%)` }}>
        <SuitHeroArt suitId={suit.id} />
        <WebCorner color={suit.secondary} />
        <svg className="absolute inset-x-0 bottom-0 w-full h-16 pointer-events-none" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 60 V38 h14 V26 h10 V38 h8 V16 h12 V38 h10 V30 h14 V38 h12 V20 h10 V38 h16 V28 h12 V38 h10 V12 h14 V38 h12 V32 h10 V38 h16 V22 h12 V38 h14 V30 h10 V38 h12 V18 h12 V38 h14 V60 Z" fill="rgba(0,0,0,0.55)" />
        </svg>
        <BannerMedia suitId={suit.id} />
        <div aria-hidden="true" className="hero-shine absolute inset-y-0 left-0 w-1/3 pointer-events-none" style={{ background: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.16) 50%, transparent 100%)' }} />
        <div className="relative">
          <h2 className="font-black italic uppercase text-white leading-[0.95] text-[34px] drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]" style={{ transform: 'skewX(-4deg)', textShadow: fx.titleFx }}>
            {greet},<br />Spider-Fan!
          </h2>
          <p className="text-[13px] font-semibold mt-2" style={{ color: fx.light }}>Ayunan nada hari ini sudah siap.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {quick.map((t) => (
          <button key={t.id} type="button" onClick={() => onPlay(t)} className="flex items-center gap-2 rounded-lg bg-white/[0.08] overflow-hidden text-left active:scale-95 transition" style={{ border: `1px solid ${suit.secondary}66`, borderLeft: `3px solid ${suit.primary}`, borderRadius: fx.cardRadius, boxShadow: fx.cardShadow }}>
            <CoverImg src={t.cover} videoId={t.videoId || t.id} alt={t.title} className="w-11 h-11 object-cover shrink-0" />
            <span className="text-[11px] font-bold text-white line-clamp-2 flex-1">{t.title}</span>
            <span className="mr-2 w-5 h-5 shrink-0 rounded-full bg-white/90 flex items-center justify-center"><Play size={10} className="text-black ml-px" fill="currentColor" /></span>
          </button>
        ))}
      </div>

      <RecapCard suit={suit} onPlay={onPlay} />

      <div>
        <h3 className="text-sm font-black italic text-white mb-2 flex items-center gap-1.5"><SpiderIcon size={14} color={suit.primary} /> Lanjutkan</h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {cont.map((t) => (
            <button key={t.id} type="button" onClick={() => onPlay(t)} className="w-28 shrink-0 text-left active:scale-95 transition">
              <CoverImg src={t.cover} videoId={t.videoId || t.id} alt={t.title} className="w-28 h-28 rounded-xl object-cover" style={{ border: currentTrack?.id === t.id && isPlaying ? `2px solid ${suit.primary}` : '1px solid rgba(255,255,255,0.12)' }} />
              <div className="text-[11px] font-bold text-white truncate mt-1.5">{t.title}</div>
              <div className="text-[10px] text-neutral-400 truncate">{t.artist}</div>
            </button>
          ))}
        </div>
      </div>

      <RecoRow songs={songs} seeds={seeds} ownedIds={ownedIds} currentTrack={currentTrack} isPlaying={isPlaying} suit={suit} onPlay={onPlay} />

      <div>
        <h3 className="mb-2 flex items-center gap-2">
          <span className="px-2 py-0.5 -skew-x-6 text-sm font-black text-white" style={{ background: suit.primary }}>TOP 10</span>
          <span className="text-sm font-black italic text-white">Spider-Chart</span>
        </h3>
        {first && (
          <div onClick={() => onPlay(first)} className="relative overflow-hidden rounded-2xl p-3 mb-2 flex items-center gap-3 cursor-pointer border-2 active:scale-[0.99] transition" style={{ borderColor: suit.primary, boxShadow: `0 0 24px ${suit.glow}`, backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px)', backgroundSize: '8px 8px' }}>
            <div className="relative shrink-0">
              <CoverImg src={first.cover} videoId={first.videoId || first.id} alt={first.title} className="w-24 h-24 rounded-xl object-cover border-2 border-white" />
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
            <CoverImg src={t.cover} videoId={t.videoId || t.id} alt={t.title} className="w-11 h-11 rounded-lg object-cover shrink-0 border border-white/10" />
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

const HomeViewM = React.memo(HomeView);

function NoLyrics({ suit, loading, instrumental, seed }) {
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
          {instrumental ? 'Instrumental' : 'Lirik tidak ditemukan'}
        </span>
      )}
    </div>
  );
}

function askBackgroundPermission() {
  const bg = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundMode;
  if (!bg) return false;
  const call = async (name) => {
    try {
      if (typeof bg[name] === 'function') await bg[name]();
    } catch {
      // abaikan
    }
  };
  (async () => {
    await call('requestNotificationsPermission');
    await call('requestForegroundPermission');
    await call('requestDisableBatteryOptimizations');
    await call('disableBatteryOptimizations');
  })();
  return true;
}

const BACKUP_KEYS = ['spideyfy-playlists', 'spideyfy-prefs', 'spideyfy-history', 'spideyfy-stats', 'spideyfy-lyr-offset', 'spideyfy-lyr-pick', 'spideyfy-queue'];

function BackupSection({ suit }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  const makeBackup = async () => {
    const data = {};
    BACKUP_KEYS.forEach((k) => {
      try {
        const v = localStorage.getItem(k);
        if (v != null) data[k] = v;
      } catch {
        // abaikan
      }
    });
    const out = JSON.stringify({ app: 'spideyfy', v: 1, data });
    setText(out);
    try {
      await navigator.clipboard.writeText(out);
      setMsg('Backup sudah disalin. Tempel & simpan di Catatan / kirim ke chat sendiri.');
    } catch {
      setMsg('Salin teks di kotak ini secara manual (tekan lama, Pilih semua, Salin), lalu simpan.');
    }
  };

  const restore = () => {
    try {
      const obj = JSON.parse(text.trim());
      if (!obj || obj.app !== 'spideyfy' || !obj.data) throw new Error('bad');
      Object.keys(obj.data).forEach((k) => {
        if (BACKUP_KEYS.includes(k) && typeof obj.data[k] === 'string') localStorage.setItem(k, obj.data[k]);
      });
      setMsg('Berhasil dipulihkan. Memuat ulang...');
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setMsg('Teks backup tidak valid. Pastikan tertempel utuh.');
    }
  };

  return (
    <div>
      <h3 className="text-sm font-black italic text-white mb-2">Cadangan data</h3>
      <div className="rounded-xl bg-white/[0.05] p-3 space-y-2">
        <p className="text-[11px] text-neutral-400">Simpan playlist, suka, dan pengaturan sebelum install ulang APK, lalu pulihkan setelahnya.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Teks backup muncul di sini. Untuk memulihkan, tempel teks backup lalu tekan Pulihkan."
          className="w-full h-24 rounded-lg bg-black/40 text-[11px] text-white p-2 outline-none border border-white/10"
        />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={makeBackup} className="rounded-xl py-2.5 text-xs font-bold text-white" style={{ background: suit.primary }}>
            Buat backup
          </button>
          <button type="button" onClick={restore} className="rounded-xl py-2.5 text-xs font-bold text-white bg-white/10">
            Pulihkan
          </button>
        </div>
        {msg && <p className="text-[11px] text-neutral-300">{msg}</p>}
      </div>
    </div>
  );
}

function SettingsView({ suit, suitId, setSuitId, playbackMode, setPlaybackMode, backendConnected, islandOn, setIslandOn, islandLyrics, setIslandLyrics, notifLyrics, setNotifLyrics, islandTheme, setIslandTheme, lockLyrics, setLockLyrics, lockStyle, setLockStyle, sleepLeft = 0, sleepEot = false, onSleepStart, onSleepEot, onSleepAdd, onSleepCancel }) {
  const [sleepCustom, setSleepCustom] = useState('');
  return (
    <div className="stagger space-y-4 pb-4">
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
      <div>
        <h3 className="text-sm font-black italic text-white mb-2 flex items-center gap-1.5">
          <Moon className="w-4 h-4" style={{ color: suit.primary }} /> Sleep Timer
        </h3>
        {sleepLeft > 0 || sleepEot ? (
          <div className="fade-in rounded-xl bg-white/[0.05] p-3">
            <div className="text-[11px] text-neutral-400">Musik berhenti otomatis</div>
            <div className="text-2xl font-black text-white tabular-nums mt-0.5">
              {sleepEot ? 'Setelah lagu ini' : fmtSleep(sleepLeft)}
            </div>
            <div className="flex gap-2 mt-2.5">
              {!sleepEot && (
                <button type="button" onClick={() => onSleepAdd(10)} className="flex-1 rounded-xl py-2 text-xs font-bold text-white bg-white/10 active:scale-95 transition">
                  +10 menit
                </button>
              )}
              <button type="button" onClick={onSleepCancel} className="flex-1 rounded-xl py-2 text-xs font-bold text-white active:scale-95 transition" style={{ background: suit.primary }}>
                Batalkan
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 45, 60, 90].map((m) => (
                <button key={m} type="button" onClick={() => onSleepStart(m)} className="rounded-xl py-2.5 text-xs font-bold text-white bg-white/[0.06] border border-transparent active:scale-95 transition">
                  {m} menit
                </button>
              ))}
              <button type="button" onClick={onSleepEot} className="rounded-xl py-2.5 text-xs font-bold text-white bg-white/[0.06] border border-transparent active:scale-95 transition">
                Akhir lagu
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="600"
                value={sleepCustom}
                onChange={(e) => setSleepCustom(e.target.value)}
                placeholder="Menit kustom (1-600)"
                aria-label="Durasi sleep timer dalam menit"
                className="min-w-0 flex-1 rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none border border-white/10 focus:border-white/30 transition"
              />
              <button
                type="button"
                disabled={!(Number(sleepCustom) > 0)}
                onClick={() => { onSleepStart(sleepCustom); setSleepCustom(''); }}
                className="px-4 rounded-xl text-xs font-bold text-white active:scale-95 transition disabled:opacity-40"
                style={{ background: suit.primary }}
              >
                Mulai
              </button>
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-black italic text-white mb-2">Dynamic Island</h3>
        <div className="rounded-xl bg-white/[0.05] divide-y divide-white/10">
          {[
            ...(ISLAND_OK
              ? [
                  { label: 'Tampilkan Dynamic Island', sub: 'Pil melayang di atas layar saat kamu menekan Home. Butuh izin "Tampil di atas aplikasi lain". Ketuk pil untuk membuka kontrol.', on: islandOn, set: setIslandOn },
                  { label: 'Tampilkan lirik di Island', sub: 'Baris lirik yang sedang dinyanyikan muncul di dalam pil.', on: islandLyrics, set: setIslandLyrics, disabled: !islandOn },
                  { label: 'Lirik di layar kunci', sub: 'Saat layar menyala dan terkunci, lirik besar + kontrol musik tampil di atas layar kunci. Geser ke atas untuk membuka kunci.', on: lockLyrics, set: setLockLyrics, disabled: !islandOn },
                ]
              : []),
            { label: 'Lirik di notifikasi & layar kunci', sub: 'Baris lirik tampil di notifikasi musik, juga saat aplikasi ditutup atau layar dikunci.', on: notifLyrics, set: setNotifLyrics },
          ].map((row) => (
            <button
              key={row.label}
              type="button"
              disabled={row.disabled}
              onClick={() => row.set(!row.on)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left disabled:opacity-40"
              aria-pressed={row.on}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-white">{row.label}</span>
                <span className="block text-[11px] text-neutral-400 mt-0.5">{row.sub}</span>
              </span>
              <span
                className="relative w-11 h-6 rounded-full shrink-0 transition-colors"
                style={{ backgroundColor: row.on ? suit.primary : 'rgba(255,255,255,0.18)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: row.on ? 22 : 2 }}
                />
              </span>
            </button>
          ))}
        </div>
        {ISLAND_OK && (
          <div className="mt-2 rounded-xl bg-white/[0.05] p-3">
            <div className="text-xs font-bold text-white mb-0.5">Tema Island</div>
            <div className="text-[11px] text-neutral-400 mb-2">Ketuk pil untuk membuka kartu musik, ketuk lagi untuk menutup.</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'spidey', label: 'Spidey Chibi', sub: 'Merah-biru + maskot' },
                { id: 'dark', label: 'Dark', sub: 'Hitam polos' },
              ].map((t) => {
                const on = islandTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setIslandTheme(t.id)}
                    aria-pressed={on}
                    className="rounded-xl p-2.5 text-left border active:scale-95 transition"
                    style={{
                      borderColor: on ? suit.primary : 'rgba(255,255,255,0.12)',
                      background: t.id === 'spidey' ? 'linear-gradient(90deg,#E62429,#9B1B4A,#1F2A8F)' : '#000',
                      boxShadow: on ? `0 0 0 2px ${suit.primary}66` : 'none',
                    }}
                  >
                    <span className="block text-xs font-extrabold text-white">{t.label}</span>
                    <span className="block text-[10px] text-white/70">{t.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {ISLAND_OK && (
          <div className="mt-2 rounded-xl bg-white/[0.05] p-3">
            <div className="text-xs font-bold text-white mb-0.5">Gaya lirik layar kunci</div>
            <div className="text-[11px] text-neutral-400 mb-2">Berlaku kalau "Lirik di layar kunci" menyala.</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'classic', label: 'Klasik', sub: 'Default: 5 baris, baris aktif menyala', bg: 'linear-gradient(160deg,#4A0B14,#140A2E,#05060F)' },
                { id: 'webtype', label: 'Webtype', sub: 'Kata besar muncul satu-satu, hitam pekat', bg: '#000' },
              ].map((t) => {
                const on = lockStyle === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setLockStyle(t.id)}
                    aria-pressed={on}
                    className="rounded-xl p-2.5 text-left border active:scale-95 transition"
                    style={{
                      borderColor: on ? suit.primary : 'rgba(255,255,255,0.12)',
                      background: t.bg,
                      boxShadow: on ? `0 0 0 2px ${suit.primary}66` : 'none',
                    }}
                  >
                    {t.id === 'webtype' ? (
                      <span className="block leading-[0.95] font-black text-white text-[17px] tracking-tight mb-1">
                        the<br />cash<br />on
                      </span>
                    ) : (
                      <span className="block text-[11px] font-bold text-white/45 leading-tight mb-1">
                        baris lama<br /><span className="text-white text-[13px]">baris aktif</span><br />baris lama
                      </span>
                    )}
                    <span className="block text-xs font-extrabold text-white">{t.label}</span>
                    <span className="block text-[10px] text-white/70">{t.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-black italic text-white mb-2">Latar belakang</h3>
        <button type="button" onClick={() => askBackgroundPermission()} className="w-full rounded-xl py-2.5 text-xs font-bold text-white active:scale-95 transition" style={{ background: suit.primary }}>
          Izinkan musik di latar belakang
        </button>
        <p className="text-[11px] text-neutral-400 mt-1.5">Kalau musik berhenti saat layar mati: izinkan notifikasi, lalu pilih izinkan / "Tanpa batasan" pada penghematan baterai.</p>
      </div>
      <BackupSection suit={suit} />
      <div className="rounded-xl bg-white/[0.05] p-3 text-[11px] text-neutral-300 space-y-1">
        <div className="font-bold text-white">Status</div>
        <div>{backendConnected ? 'Terhubung ke pencarian YouTube Music.' : 'Memakai katalog bawaan (pencarian belum terhubung).'}</div>
        <div className="text-neutral-400">Di aplikasi Android (APK), musik tetap jalan saat layar mati atau app ditutup ke latar belakang. Di browser biasa bisa berhenti.</div>
      </div>
    </div>
  );
}

function fmtSleep(sec) {
  const p = (n) => String(n).padStart(2, '0');
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

const MOBILE_TABS = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'songs', label: 'Cari', icon: Search },
  { id: 'playlists', label: 'Playlist', icon: ListMusic },
  { id: 'lyrics', label: 'Lirik', icon: Mic2 },
  { id: 'settings', label: 'Setelan', icon: Settings },
];

export default function MusicPlayer() {
  // Suit & macOS window state
  const [suitId, setSuitId] = useState(SAVED_PREFS.suit || 'classic');
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
  const [likedIds, setLikedIds] = useState(
    Array.isArray(SAVED_PREFS.liked) ? SAVED_PREFS.liked : ['ApXoWvfEYVU', 'Y88LVU7MAe4']
  );
  const [history, setHistory] = useState(SAVED_HISTORY);
  const [repeatMode, setRepeatMode] = useState(
    ['off', 'all', 'one'].includes(SAVED_PREFS.repeatMode) ? SAVED_PREFS.repeatMode : 'all'
  );
  const [shuffleOn, setShuffleOn] = useState(SAVED_PREFS.shuffle === true);
  const shuffleRef = useRef(false);
  shuffleRef.current = shuffleOn;
  const shuffleBagRef = useRef([]);
  const shuffleHistoryRef = useRef([]);
  const [fullLyrics, setFullLyrics] = useState(false);
  const [lyricsClosing, setLyricsClosing] = useState(false);
  const closeFullLyrics = () => {
    if (lyricsClosing) return;
    setLyricsClosing(true);
    setTimeout(() => {
      setFullLyrics(false);
      setLyricsClosing(false);
    }, 320);
  };
  const fullLyricsRef = useRef(null);
  const scrubbingRef = useRef(false);
  const repeatRef = useRef('all');
  repeatRef.current = repeatMode;

  // Playback state (Audio mode uses Web Audio / synced timer fallback; Video mode uses YouTube IFrame)
  const [currentTrack, setCurrentTrack] = useState(RESTORED_TRACK || FALLBACK_CATALOG.songs[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [islandOn, setIslandOn] = useState(SAVED_PREFS.islandOn === true); // default MATI
  const [islandLyrics, setIslandLyrics] = useState(SAVED_PREFS.islandLyrics !== false);
  const [islandTheme, setIslandTheme] = useState(SAVED_PREFS.islandTheme === 'spidey' ? 'spidey' : 'dark');
  const [lockLyrics, setLockLyrics] = useState(SAVED_PREFS.lockLyrics === true); // default MATI
  const [lockStyle, setLockStyle] = useState(SAVED_PREFS.lockStyle === 'webtype' ? 'webtype' : 'classic');
  const [notifLyrics, setNotifLyrics] = useState(SAVED_PREFS.notifLyrics !== false);
  const [playbackMode, setPlaybackMode] = useState(SAVED_PREFS.mode === 'video' ? 'video' : 'audio'); // 'audio' | 'video'
  const [currentTime, setCurrentTime] = useState(RESTORED_TIME);
  const [duration, setDuration] = useState(
    (RESTORED_TRACK && RESTORED_TRACK.durationSec) || FALLBACK_CATALOG.songs[0].durationSec
  );
  const [volume, setVolume] = useState(
    typeof SAVED_PREFS.volume === 'number' ? SAVED_PREFS.volume : 80
  );
  const [isMuted, setIsMuted] = useState(false);

  // Playlist buatan sendiri (tersimpan di HP)
  const [userPlaylists, setUserPlaylists] = useState(() => {
    try {
      const raw = localStorage.getItem('spideyfy-playlists');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [pickerTrack, setPickerTrack] = useState(null);
  // Antrean buatan sendiri (lagu yang diputar lebih dulu sebelum lanjut ke daftar biasa)
  const [userQueue, setUserQueue] = useState(() => {
    const q = readSaved('spideyfy-queue', []);
    return Array.isArray(q) ? q.filter((t) => t && t.id && t.videoId).slice(0, 100) : [];
  });
  const userQueueRef = useRef([]);
  userQueueRef.current = userQueue;
  const ctxLastIdRef = useRef(null);
  const [showQueue, setShowQueue] = useState(false);
  const [queueToast, setQueueToast] = useState('');
  const queueToastTimer = useRef(null);
  // Pilihan versi lirik
  const [lyricCands, setLyricCands] = useState([]);
  const [lyricCurId, setLyricCurId] = useState(null);
  const [showLyricPick, setShowLyricPick] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [openPlaylistId, setOpenPlaylistId] = useState(null);
  const queueRef = useRef(null);
  const currentTimeRef = useRef(RESTORED_TIME);
  const currentTrackRef = useRef(null);
  const resumeSecRef = useRef(RESTORED_TIME);
  currentTimeRef.current = currentTime;
  currentTrackRef.current = currentTrack;

  // Synced lyrics state
  const [lyrics, setLyrics] = useState(FALLBACK_CATALOG.songs[0].lyrics);
  const [lyricsSource, setLyricsSource] = useState('Synced Lyrics');
  const [lyricsSynced, setLyricsSynced] = useState(true);
  const [lyricOffset, setLyricOffset] = useState(0);
  const lyricsReqRef = useRef(0);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
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
  const switchSuit = (id, ev) => {
    if (id === suitId) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce || !ev) { setSuitId(id); return; }
    navigator.vibrate?.(15);
    const x = ev.clientX, y = ev.clientY;
    const t = document.startViewTransition(() => flushSync(() => setSuitId(id)));
    t.ready.then(() => {
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      document.documentElement.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  };

  // Refs agar callback YouTube selalu membaca nilai terbaru
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(80);
  const stepNextRef = useRef(null);
  const errorStreakRef = useRef(0);
  const stuckRef = useRef(0);
  const awayPausedRef = useRef(0);
  const loadedVideoRef = useRef('');
  const tryAlternateRef = useRef(null);
  const triedVideosRef = useRef({});
  const videoFixRef = useRef(readSaved('spideyfy-video-fix', {}));
  isPlayingRef.current = isPlaying;
  const playbackModeRef = useRef('audio');
  playbackModeRef.current = playbackMode;
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

  // Audio senyap: bikin browser menganggap tab ini pemutar musik (tidak dibekukan saat layar mati)
  const keepAliveRef = useRef(null);
  useEffect(() => {
    try {
      // Di APK tidak perlu (sudah ada service latar belakang) dan malah bisa bentrok jadi suara pecah
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return;
      if (!keepAliveRef.current) {
        const sr = 8000;
        const n = sr * 2;
        const buf = new ArrayBuffer(44 + n);
        const v = new DataView(buf);
        const w = (o, t) => { for (let i = 0; i < t.length; i += 1) v.setUint8(o + i, t.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
        w(36, 'data'); v.setUint32(40, n, true);
        new Uint8Array(buf, 44).fill(128);
        const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
        a.loop = true;
        a.volume = 0.01;
        keepAliveRef.current = a;
      }
      const a = keepAliveRef.current;
      if (isPlaying) {
        const r = a.play();
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } else {
        a.pause();
      }
    } catch {
      // abaikan
    }
  }, [isPlaying]);

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
        // Sudah dimuat langsung saat lagu ditekan (supaya lolos aturan autoplay browser)
        if (loadedVideoRef.current === currentTrack.videoId) return;
        const args = { videoId: currentTrack.videoId, startSeconds: 0 };
        if (isPlayingRef.current) ytPlayerRef.current.loadVideoById(args);
        else ytPlayerRef.current.cueVideoById(args);
        loadedVideoRef.current = currentTrack.videoId;
        return;
      }
      loadedVideoRef.current = currentTrack.videoId;

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
          start: Math.floor(resumeSecRef.current || 0),
        },
        events: {
          onReady: (ev) => {
            ev.target.setVolume(volumeRef.current);
            resumeSecRef.current = 0;
            const d = ev.target.getDuration();
            if (d > 0) setDuration(d);
            if (isPlayingRef.current) ev.target.playVideo();
          },
          onStateChange: (ev) => {
            const S = window.YT.PlayerState;
            if (ev.data === S.ENDED) {
              if (stepNextRef.current) stepNextRef.current(false);
            } else if (ev.data === S.PAUSED && isPlayingRef.current) {
              // Tombol pause kita sendiri sudah mengubah isPlayingRef lebih dulu, jadi sampai sini
              // berarti dijeda sistem/browser (tombol home, layar mati) -> selalu lanjutkan.
              // Pengecualian: mode Video dan app sedang di depan (user pause dari kontrol video).
              setTimeout(() => {
                if (!isPlayingRef.current) return;
                const away = window.__spAway && window.__spAway();
                if (playbackModeRef.current === 'video' && !away) {
                  isPlayingRef.current = false;
                  setIsPlaying(false);
                  return;
                }
                try { ev.target.playVideo(); } catch { /* abaikan */ }
              }, 250);
            } else if (ev.data === S.PLAYING && !isPlayingRef.current) {
              errorStreakRef.current = 0;
              isPlayingRef.current = true;
              setIsPlaying(true);
            } else if (ev.data === S.PLAYING) {
              errorStreakRef.current = 0;
            }
          },
          onError: () => {
            const skip = () => {
              errorStreakRef.current += 1;
              if (errorStreakRef.current >= 5) {
                // Jangan loncat-loncat tanpa henti kalau banyak lagu berturut-turut gagal
                errorStreakRef.current = 0;
                isPlayingRef.current = false;
                setIsPlaying(false);
                setStatusMessage('Beberapa lagu berturut-turut gagal diputar. Cek koneksi atau coba lagu lain.');
                return;
              }
              setStatusMessage('Lagu ini tidak bisa diputar, lanjut ke lagu berikutnya');
              if (stepNextRef.current) stepNextRef.current(true);
            };
            const tr = currentTrackRef.current;
            if (tr && tryAlternateRef.current) {
              setStatusMessage('Lagu ini diblokir YouTube, mencari versi lain…');
              tryAlternateRef.current(tr).then((ok) => { if (!ok) skip(); }).catch(skip);
            } else {
              skip();
            }
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

  // Penjaga: kalau seharusnya memutar tapi pemutar berhenti sendiri saat app di belakang, lanjutkan lagi
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        if (!isPlayingRef.current) {
          stuckRef.current = 0;
          return;
        }
        const pl = ytPlayerRef.current;
        const ready = pl && typeof pl.getPlayerState === 'function';
        const st = ready ? pl.getPlayerState() : null;
        const away = window.__spAway && window.__spAway();
        // Terlihat "memutar" tapi pemutar tidak pernah mulai (autoplay diblokir / pemutar belum siap)
        if (!away && (!ready || st === -1 || st === 5)) {
          stuckRef.current += 1;
          if (stuckRef.current >= 6) {
            stuckRef.current = 0;
            isPlayingRef.current = false;
            setIsPlaying(false);
            setStatusMessage('Pemutar belum bisa mulai sendiri. Tekan tombol play sekali lagi.');
          }
        } else {
          stuckRef.current = 0;
        }
        // Di latar belakang YouTube sering menjeda sendiri dan menolak diputar lagi dari web.
        // Jangan pura-pura "memutar": tampilkan jeda di notifikasi supaya bisa ditekan play sekali.
        if (away && st === 2) {
          awayPausedRef.current += 1;
          if (awayPausedRef.current >= 4) {
            awayPausedRef.current = 0;
            isPlayingRef.current = false;
            setIsPlaying(false);
          }
        } else {
          awayPausedRef.current = 0;
        }
        if (!ready) return;
        if ((away || playbackModeRef.current === 'audio') && (st === 2 || st === 5 || st === -1)) {
          const now = Date.now();
          if (now - (window.__spLastResume || 0) > 800) {
            window.__spLastResume = now;
            pl.playVideo();
          }
        }
      } catch {
        // abaikan
      }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Keep YouTube volume synced
  useEffect(() => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      ytPlayerRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Catat statistik putar untuk fitur Recap
  useListeningStats(currentTrack, isPlaying);

  // Playback progress & YouTube time sync interval
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (scrubbingRef.current) return;
      if (
        ytPlayerRef.current &&
        typeof ytPlayerRef.current.getCurrentTime === 'function'
      ) {
        const ytCur = ytPlayerRef.current.getCurrentTime() || 0;
        const ytDur = ytPlayerRef.current.getDuration() || duration;
        setCurrentTime(ytCur);
        if (ytDur > 0) setDuration(ytDur);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying, playbackMode, duration]);

  // Pilih versi lirik lain untuk lagu ini (disimpan per lagu)
  const chooseLyricCand = (c) => {
    const id = currentTrack && currentTrack.id;
    if (!id) return;
    const lines = c.syncedLyrics ? parseLrcText(c.syncedLyrics) : buildPlainLyrics(c.plainLyrics);
    if (!lines.length) return;
    const picks = readSaved('spideyfy-lyr-pick', {}) || {};
    picks[id] = c.id;
    writeSaved('spideyfy-lyr-pick', picks);
    const offs = readSaved('spideyfy-lyr-offset', {}) || {};
    delete offs[id];
    writeSaved('spideyfy-lyr-offset', offs);
    const synced = !!c.syncedLyrics;
    setLyrics(lines);
    setLyricsSynced(synced);
    setLyricOffset(0);
    setLyricCurId(c.id);
    setLyricsSource(synced ? 'Pilihanmu' : 'Lirik (tanpa sinkron)');
    LYRICS_CACHE.set(id, { kind: synced ? 'synced' : 'plain', lines, source: synced ? 'Pilihanmu' : 'Lirik (tanpa sinkron)', itemId: c.id, cands: lyricCands });
    setShowLyricPick(false);
  };

  // Geser sinkron lirik lagu ini (disimpan per lagu)
  const adjustLyricOffset = (delta) => {
    const id = currentTrack && currentTrack.id;
    if (!id) return;
    const map = readSaved('spideyfy-lyr-offset', {}) || {};
    const next = Math.round(((Number(map[id]) || 0) + delta) * 10) / 10;
    if (next === 0) delete map[id];
    else map[id] = next;
    writeSaved('spideyfy-lyr-offset', map);
    setLyricOffset(next);
    setLyrics((prev) => prev.map((l) => ({ ...l, time: Math.max(0, (Number(l.time) || 0) + delta) })));
  };

  // Baris lirik aktif saat lagu DIJEDA / digeser (waktu dari state)
  useEffect(() => {
    if (!lyrics.length || !lyricsSynced) {
      setActiveLineIndex(-1);
      return;
    }
    if (isPlaying) return; // saat diputar, dipegang poll cepat di bawah
    setActiveLineIndex(activeLyricIndex(lyrics, currentTime + LYRIC_LEAD));
  }, [currentTime, lyrics, lyricsSynced, isPlaying]);

  // Poll cepat (100 ms) khusus lirik: baca waktu langsung dari pemutar, tanpa menunggu render ulang
  useEffect(() => {
    if (!isPlaying || !lyrics.length || !lyricsSynced) return undefined;
    const iv = setInterval(() => {
      let t = currentTimeRef.current;
      const pl = ytPlayerRef.current;
      if (!scrubbingRef.current && pl && typeof pl.getCurrentTime === 'function') {
        t = Number(pl.getCurrentTime()) || t;
      }
      setActiveLineIndex(activeLyricIndex(lyrics, t + LYRIC_LEAD));
    }, 100);
    return () => clearInterval(iv);
  }, [isPlaying, lyrics, lyricsSynced]);

  // Smooth auto-scroll active lyric line into view
  useEffect(() => {
    if (activeLineRef.current && lyricsScrollRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  // Fetch lyrics from LRCLIB (pencocokan ketat; instrumental = tanpa lirik)
  const loadLyricsForTrack = useCallback(async (track) => {
    if (!track) return;
    const reqId = ++lyricsReqRef.current;
    const isStale = () => reqId !== lyricsReqRef.current;

    if (Array.isArray(track.lyrics) && track.lyrics.length > 0) {
      setLyrics(track.lyrics);
      setLyricsSynced(true);
      setLyricsSource('Synced Lyrics');
      return;
    }

    setLyrics([]);
    setLyricsSynced(true);
    setLyricOffset(0);
    setLyricCands([]);
    setLyricCurId(null);

    // Judul menyebut instrumental/karaoke -> tidak ada lirik
    if (INSTRUMENTAL_TITLE.test(String(track.title || ''))) {
      setLyricsSource('Instrumental');
      return;
    }

    const applyResult = (res) => {
      const off = Number((readSaved('spideyfy-lyr-offset', {}) || {})[track.id]) || 0;
      if (res.kind === 'synced') {
        setLyrics(res.lines.map((l) => ({ ...l, time: Math.max(0, l.time + off) })));
        setLyricsSynced(true);
        setLyricOffset(off);
      } else if (res.kind === 'plain') {
        setLyrics(res.lines);
        setLyricsSynced(false);
      }
      setLyricsSource(res.source);
      setLyricCands(res.cands || []);
      setLyricCurId(res.itemId != null ? res.itemId : null);
    };
    const waitPlayerDuration = async (tr, ms) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const pl = ytPlayerRef.current;
        try {
          if (pl && typeof pl.getDuration === 'function') {
            const vd = typeof pl.getVideoData === 'function' ? pl.getVideoData() : null;
            const d = Number(pl.getDuration()) || 0;
            if (d > 30 && vd && (vd.video_id === tr.videoId || vd.video_id === tr.origVideoId)) return d;
          }
        } catch {
          // abaikan
        }
        await new Promise((r) => setTimeout(r, 250));
        if (isStale()) return 0;
      }
      return 0;
    };

    const cached = LYRICS_CACHE.get(track.id);
    if (cached) {
      applyResult(cached);
      return;
    }

    setLyricsSource('Searching LRCLIB...');
    try {
      const variants = titleVariants(track.title, track.artist);
      const firstArtist = firstArtistOf(track.artist);
      let durSec = Number(track.durationSec) || 0;
      if (track.durationGuess || !(durSec > 0)) {
        // Durasi dari server cuma tebakan: tunggu durasi asli dari pemutar supaya lirik versi yang benar terpilih
        const real = await waitPlayerDuration(track, 3500);
        if (isStale()) return;
        durSec = real;
      }
      if (variants.length) {
        const base = 'https://lrclib.net/api';
        const getJson = async (url) => {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const ctl = new AbortController();
            const to = setTimeout(() => ctl.abort(), 5000);
            try {
              const r = await fetch(url, { signal: ctl.signal });
              if (r.status === 404) return null;
              if (r.ok) return await r.json();
            } catch {
              // coba sekali lagi
            } finally {
              clearTimeout(to);
            }
            await new Promise((res) => setTimeout(res, 700));
            if (isStale()) return null;
          }
          return null;
        };
        const art = firstArtist ? `&artist_name=${encodeURIComponent(firstArtist)}` : '';
        const urls = [];
        variants.slice(0, 3).forEach((v, i) => {
          if (art && durSec > 0 && i < 2) urls.push(`${base}/get?track_name=${encodeURIComponent(v)}${art}&duration=${Math.round(durSec)}`);
          urls.push(`${base}/search?track_name=${encodeURIComponent(v)}${art}`);
        });
        urls.push(`${base}/search?q=${encodeURIComponent(`${variants[variants.length - 1]} ${firstArtist}`.trim())}`);
        urls.push(`${base}/search?q=${encodeURIComponent(variants[0])}`);

        const pool = [];
        const seen = new Set();
        const addItems = (raw) => {
          const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
          arr.forEach((it) => {
            if (!it) return;
            const key = it.id != null ? it.id : `${it.trackName}-${it.duration}`;
            if (seen.has(key)) return;
            seen.add(key);
            pool.push(it);
          });
        };
        const rank = (tol, relaxed) =>
          pool
            .map((it) => ({ it, sc: lyricsScore(it, track, variants, durSec, tol, relaxed) }))
            .filter((x) => x.sc >= 0)
            .sort((x, y) => y.sc - x.sc);

        // Tampil secepat mungkin: begitu ada lirik tersinkron yang pas sekali, langsung dipakai
        await new Promise((resolve) => {
          let pending = urls.length;
          urls.forEach((u) => {
            getJson(u).then((raw) => {
              addItems(raw);
              pending -= 1;
              const best = rank(3, false)[0];
              if ((best && best.sc >= 100 && best.it.syncedLyrics) || pending === 0) resolve();
            });
          });
        });
        if (isStale()) return;

        const cands = rank(10, true)
          .map((x) => x.it)
          .filter((i) => (i.syncedLyrics || i.plainLyrics) && !i.instrumental)
          .slice(0, 6)
          .map((i) => ({
            id: i.id,
            trackName: i.trackName || i.name,
            artistName: i.artistName,
            duration: i.duration,
            synced: !!i.syncedLyrics,
            syncedLyrics: i.syncedLyrics || '',
            plainLyrics: i.plainLyrics || '',
          }));
        const pickedId = (readSaved('spideyfy-lyr-pick', {}) || {})[track.id];
        const wantTags = versionTags(track.title).join('|');
        const otherVersion = (it) => versionTags(it.trackName || it.name).join('|') !== wantTags;
        const pick = (tol, relaxed) => {
          const valid = rank(tol, relaxed).map((x) => x.it);
          if (pickedId != null) {
            // Versi lirik yang pernah kamu pilih sendiri
            const pref = pool.find((i) => i.id === pickedId && (i.syncedLyrics || i.plainLyrics));
            if (pref) {
              const lines = pref.syncedLyrics ? parseLrcText(pref.syncedLyrics) : buildPlainLyrics(pref.plainLyrics);
              if (lines.length) return { kind: pref.syncedLyrics ? 'synced' : 'plain', lines, source: 'Pilihanmu', itemId: pref.id };
            }
          }
          const synced = valid.find((i) => i.syncedLyrics && !i.instrumental);
          if (synced) {
            const lines = parseLrcText(synced.syncedLyrics);
            if (lines.length) {
              return { kind: 'synced', lines, itemId: synced.id, source: otherVersion(synced) ? 'LRCLIB (versi lain, bisa kurang pas)' : 'LRCLIB Synced' };
            }
          }
          const plain = valid.find((i) => i.plainLyrics && !i.instrumental);
          if (plain) {
            // Tanpa timestamp: tampil apa adanya, tidak berpura-pura tersinkron
            const lines = buildPlainLyrics(plain.plainLyrics);
            if (lines.length) return { kind: 'plain', lines, itemId: plain.id, source: 'Lirik (tanpa sinkron)' };
          }
          if (valid.some((i) => i.instrumental)) return { kind: 'instrumental', source: 'Instrumental' };
          return null;
        };
        let res = pick(3, false);
        if (!res && durSec > 0) {
          // Tidak ada yang durasinya pas: coba yang agak beda (lirik tetap bisa dikoreksi pakai tombol sinkron)
          res = pick(10, true);
          if (res && res.kind === 'synced') res.source = 'LRCLIB (durasi beda, bisa kurang pas)';
        }
        if (res) {
          res.cands = cands;
          LYRICS_CACHE.set(track.id, res);
          applyResult(res);
          return;
        }
      }
    } catch {
      // Fallback below
    }
    if (isStale()) return;

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
        ? `${API_BASE}/api/ytmusic?q=${encodeURIComponent(trimmed)}`
        : `${API_BASE}/api/ytmusic`;
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
        const res = await fetch(`${API_BASE}/api/ytmusic?suggest=${encodeURIComponent(q)}`);
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

  const handleSelectTrack = useCallback((rawTrack, autoPlay = true, queue = null) => {
    if (!rawTrack) return;
    // Kalau lagu ini pernah diblokir, langsung pakai versi pengganti yang sudah ketemu
    const fixedId = videoFixRef.current[rawTrack.origVideoId || rawTrack.videoId];
    const track =
      fixedId && fixedId !== rawTrack.videoId
        ? { ...rawTrack, videoId: fixedId, origVideoId: rawTrack.origVideoId || rawTrack.videoId }
        : rawTrack;
    if (queue !== queueRef.current) {
      shuffleBagRef.current = [];
      shuffleHistoryRef.current = [];
    }
    queueRef.current = queue;
    if (!currentTrack || track.id !== currentTrack.id) resumeSecRef.current = 0;
    if (currentTrack && track.id === currentTrack.id) {
      // Lagu yang sama tapi sedang jeda / baru dibuka: tekan lagi harus langsung memutar
      if (autoPlay && !isPlayingRef.current) {
        isPlayingRef.current = true;
        const player = ytPlayerRef.current;
        if (player && typeof player.playVideo === 'function') player.playVideo();
        setIsPlaying(true);
      }
      setMobilePane('lyrics');
      return;
    }
    setCurrentTrack(track);
    try {
      const pl = ytPlayerRef.current;
      if (autoPlay && pl && typeof pl.loadVideoById === 'function' && track.videoId) {
        isPlayingRef.current = true;
        pl.loadVideoById({ videoId: track.videoId, startSeconds: 0 });
        loadedVideoRef.current = track.videoId;
      }
    } catch {
      // abaikan, efek pemuat akan mencoba lagi
    }
    setCurrentTime(0);
    setDuration(track.durationSec || 180);
    setActiveLineIndex(0);
    if (autoPlay) {
      setIsPlaying(true);
    }
  }, [currentTrack]);

  // Lagu diblokir / gagal diputar: cari versi lain (video biasa, lyric video, dll) lalu coba lagi
  tryAlternateRef.current = async (tr) => {
    const key = tr.origVideoId || tr.videoId;
    if (!triedVideosRef.current[key]) triedVideosRef.current[key] = new Set([key]);
    const tried = triedVideosRef.current[key];
    tried.add(tr.videoId);
    const swap = (videoId) => {
      tried.add(videoId);
      videoFixRef.current[key] = videoId;
      writeSaved('spideyfy-video-fix', videoFixRef.current);
      setCurrentTrack((prev) => (prev && prev.id === tr.id ? { ...prev, videoId, origVideoId: key } : prev));
    };
    const giveUp = () => {
      delete videoFixRef.current[key];
      writeSaved('spideyfy-video-fix', videoFixRef.current);
      triedVideosRef.current[key] = new Set([key]);
      return false;
    };
    const saved = videoFixRef.current[key];
    if (saved && !tried.has(saved)) {
      swap(saved);
      return true;
    }
    if (tried.size > 6) return giveUp();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `${API_BASE}/api/ytmusic?alt=1&q=${encodeURIComponent(`${tr.title} ${tr.artist}`)}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) return giveUp();
      const data = await res.json();
      const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const title = norm(tr.title);
      const artist = norm(String(tr.artist || '').split(',')[0]);
      const bad = ['cover', 'karaoke', 'live', 'remix', 'instrumental', 'slowed', 'sped', 'nightcore', 'reverb', 'reaction'];
      const cands = (data.alternatives || [])
        .filter((c) => c && c.videoId && !tried.has(c.videoId) && norm(c.title).includes(title))
        .map((c) => {
          const t = norm(c.title);
          let score = Math.abs((Number(c.durationSec) || 0) - (Number(tr.durationSec) || 0));
          if (artist && !norm(c.artist).includes(artist) && !t.includes(artist)) score += 60;
          if (bad.some((w) => t.includes(w) && !title.includes(w))) score += 200;
          return { c, score };
        })
        .sort((a, b) => a.score - b.score);
      if (!cands.length) return giveUp();
      swap(cands[0].c.videoId);
      return true;
    } catch {
      return giveUp();
    }
  };

  const playFromListRef = useRef(null);
  playFromListRef.current = (t) => handleSelectTrack(t, true);
  const playFromList = useCallback((t) => playFromListRef.current(t), []);

  const handleTogglePlayPause = useCallback(() => {
    const next = !isPlayingRef.current;
    isPlayingRef.current = next;
    const pl = ytPlayerRef.current;
    if (pl) {
      if (next && typeof pl.playVideo === 'function') pl.playVideo();
      else if (!next && typeof pl.pauseVideo === 'function') pl.pauseVideo();
    }
    setIsPlaying(next);
  }, []);

  // ===== Sleep Timer =====
  const [sleepAt, setSleepAt] = useState(null); // waktu berhenti (epoch ms)
  const [sleepLeft, setSleepLeft] = useState(0); // sisa detik untuk tampilan
  const [sleepEot, setSleepEot] = useState(false); // berhenti setelah lagu ini selesai
  const sleepEotRef = useRef(false);
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;

  const restorePlayerVolume = useCallback(() => {
    const pl = ytPlayerRef.current;
    if (pl && typeof pl.setVolume === 'function') pl.setVolume(isMutedRef.current ? 0 : volumeRef.current);
  }, []);

  const stopPlaybackForSleep = useCallback(() => {
    const pl = ytPlayerRef.current;
    isPlayingRef.current = false;
    if (pl && typeof pl.pauseVideo === 'function') pl.pauseVideo();
    restorePlayerVolume();
    setIsPlaying(false);
  }, [restorePlayerVolume]);

  useEffect(() => {
    if (!sleepAt) {
      setSleepLeft(0);
      return undefined;
    }
    const FADE_MS = 8000; // volume turun halus di 8 detik terakhir
    const tick = () => {
      const left = sleepAt - Date.now();
      if (left <= 0) {
        stopPlaybackForSleep();
        setSleepAt(null);
        setSleepLeft(0);
        navigator.vibrate?.(30);
        return;
      }
      setSleepLeft(Math.ceil(left / 1000));
      if (left <= FADE_MS) {
        const pl = ytPlayerRef.current;
        if (pl && typeof pl.setVolume === 'function' && !isMutedRef.current) {
          pl.setVolume(Math.max(0, Math.round(volumeRef.current * (left / FADE_MS))));
        }
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [sleepAt, stopPlaybackForSleep]);

  const startSleep = (minutes) => {
    const m = Math.max(1, Math.min(600, Math.round(Number(minutes) || 0)));
    sleepEotRef.current = false;
    setSleepEot(false);
    restorePlayerVolume();
    setSleepAt(Date.now() + m * 60000);
    navigator.vibrate?.(15);
  };
  const startSleepEot = () => {
    setSleepAt(null);
    sleepEotRef.current = true;
    setSleepEot(true);
    navigator.vibrate?.(15);
  };
  const addSleep = (minutes) => setSleepAt((a) => (a ? a + minutes * 60000 : a));
  const cancelSleep = () => {
    sleepEotRef.current = false;
    setSleepEot(false);
    setSleepAt(null);
    setSleepLeft(0);
    restorePlayerVolume();
  };

  useEffect(() => {
    writeSaved('spideyfy-queue', userQueue.slice(0, 100));
  }, [userQueue]);

  const flashQueue = (msg) => {
    setQueueToast(msg);
    clearTimeout(queueToastTimer.current);
    queueToastTimer.current = setTimeout(() => setQueueToast(''), 1800);
  };
  const addToQueue = (track, next = false) => {
    if (!track || !track.id) return;
    const t = slimTrack(track);
    setUserQueue((q) => {
      const rest = q.filter((x) => x.id !== t.id);
      return next ? [t, ...rest] : [...rest, t];
    });
    flashQueue(next ? 'Diputar berikutnya' : 'Ditambahkan ke antrean');
    navigator.vibrate?.(10);
  };
  const removeFromQueue = (id) => setUserQueue((q) => q.filter((x) => x.id !== id));
  const moveInQueue = (id, dir) =>
    setUserQueue((q) => {
      const i = q.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= q.length) return q;
      const c = q.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const clearQueue = () => setUserQueue([]);
  const playQueueItem = (id) => {
    const item = userQueueRef.current.find((x) => x.id === id);
    if (!item) return;
    setUserQueue((q) => q.filter((x) => x.id !== id));
    handleSelectTrack(item, true, queueRef.current);
  };

  const handleStepTrack = useCallback(
    (delta) => {
      // Antrean buatan sendiri didahulukan saat lanjut ke lagu berikutnya
      if (delta > 0 && userQueueRef.current.length) {
        const [nxt, ...rest] = userQueueRef.current;
        userQueueRef.current = rest;
        setUserQueue(rest);
        if (nxt.id === currentTrack?.id) {
          const plq = ytPlayerRef.current;
          setCurrentTime(0);
          if (plq && typeof plq.seekTo === 'function') plq.seekTo(0, true);
          if (plq && typeof plq.playVideo === 'function') plq.playVideo();
          isPlayingRef.current = true;
          setIsPlaying(true);
        } else {
          handleSelectTrack(nxt, true, queueRef.current);
        }
        return;
      }
      const list = queueRef.current && queueRef.current.length ? queueRef.current : catalog.songs;
      if (!list.length) return;
      if (list.some((t) => t.id === currentTrack?.id)) ctxLastIdRef.current = currentTrack.id;
      if (shuffleRef.current && list.length > 1) {
        if (delta < 0) {
          // kembali ke lagu yang tadi diputar (riwayat acak)
          while (shuffleHistoryRef.current.length) {
            const prevId = shuffleHistoryRef.current.pop();
            const prev = list.find((t) => t.id === prevId);
            if (prev && prev.id !== currentTrack?.id) {
              handleSelectTrack(prev, true, queueRef.current);
              return;
            }
          }
        } else {
          const ids = new Set(list.map((t) => t.id));
          let bag = shuffleBagRef.current.filter((id) => ids.has(id) && id !== currentTrack?.id);
          if (!bag.length) bag = list.map((t) => t.id).filter((id) => id !== currentTrack?.id);
          const pickIdx = Math.floor(Math.random() * bag.length);
          const pickId = bag[pickIdx];
          bag.splice(pickIdx, 1);
          shuffleBagRef.current = bag;
          if (currentTrack?.id) shuffleHistoryRef.current.push(currentTrack.id);
          if (shuffleHistoryRef.current.length > 50) shuffleHistoryRef.current.shift();
          const pick = list.find((t) => t.id === pickId);
          if (pick) {
            handleSelectTrack(pick, true, queueRef.current);
            return;
          }
        }
      }
      let idx = list.findIndex((t) => t.id === currentTrack?.id);
      // sedang memutar lagu dari antrean: lanjut dari posisi terakhir di daftar asal
      if (idx === -1 && ctxLastIdRef.current) idx = list.findIndex((t) => t.id === ctxLastIdRef.current);
      const nextIdx = idx === -1 ? 0 : (idx + delta + list.length) % list.length;
      handleSelectTrack(list[nextIdx], true, queueRef.current);
    },
    [catalog.songs, currentTrack?.id, handleSelectTrack]
  );

  // Dipanggil saat lagu selesai (atau gagal dimuat)
  const handleTrackEnded = useCallback(
    (fromError) => {
      if (!fromError && sleepEotRef.current) {
        sleepEotRef.current = false;
        setSleepEot(false);
        const plStop = ytPlayerRef.current;
        isPlayingRef.current = false;
        if (plStop && typeof plStop.pauseVideo === 'function') plStop.pauseVideo();
        setIsPlaying(false);
        return;
      }
      const mode = repeatRef.current;
      const pl = ytPlayerRef.current;
      if (!fromError && mode === 'one') {
        setCurrentTime(0);
        if (pl && typeof pl.seekTo === 'function') pl.seekTo(0, true);
        if (pl && typeof pl.playVideo === 'function') pl.playVideo();
        return;
      }
      if (!fromError && mode === 'off' && !shuffleRef.current && !userQueueRef.current.length) {
        const list = queueRef.current && queueRef.current.length ? queueRef.current : catalog.songs;
        const idx = list.findIndex((t) => t.id === currentTrack?.id);
        if (list.length && idx === list.length - 1) {
          // lagu terakhir dan ulangi mati: berhenti
          isPlayingRef.current = false;
          if (pl && typeof pl.pauseVideo === 'function') pl.pauseVideo();
          if (pl && typeof pl.seekTo === 'function') pl.seekTo(0, true);
          setCurrentTime(0);
          setIsPlaying(false);
          return;
        }
      }
      handleStepTrack(1);
    },
    [catalog.songs, currentTrack?.id, handleStepTrack]
  );

  stepNextRef.current = (fromError) => handleTrackEnded(fromError === true);

  const handleToggleShuffle = () => {
    shuffleBagRef.current = [];
    setShuffleOn((v) => !v);
  };

  const handleCycleRepeat = () => {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  };

  // ---- Dynamic Island (overlay native, muncul saat app di-Home) ----
  const handleSetIsland = useCallback(async (v) => {
    if (v && ISLAND_OK) {
      try {
        const r = await Island.hasPermission();
        if (!r || !r.granted) await Island.requestPermission();
      } catch (e) {
        // abaikan
      }
    }
    setIslandOn(v);
  }, []);

  const seekRef = useRef(null);

  const handleSetLock = useCallback(async (v) => {
    if (v && ISLAND_OK) {
      try {
        const r = await Island.hasPermission();
        if (!r || !r.granted) await Island.requestPermission();
      } catch (e) {
        // abaikan
      }
    }
    setLockLyrics(v);
  }, []);

  const islandLine =
    islandLyrics && Array.isArray(lyrics) && activeLineIndex >= 0 && lyrics.length > 0
      ? String(lyrics[activeLineIndex]?.text || '').trim()
      : '';

  useEffect(() => {
    if (!ISLAND_OK) return;
    Island.setEnabled({ enabled: islandOn }).catch(() => {});
  }, [islandOn]);

  useEffect(() => {
    if (!ISLAND_OK) return;
    Island.setTheme({ theme: islandTheme }).catch(() => {});
  }, [islandTheme]);

  useEffect(() => {
    if (!ISLAND_OK) return;
    Island.setLockLyrics({ enabled: lockLyrics && islandOn }).catch(() => {});
  }, [lockLyrics, islandOn]);

  useEffect(() => {
    if (!ISLAND_OK) return;
    Island.setLockStyle({ style: lockStyle }).catch(() => {});
  }, [lockStyle]);

  // lirik bertimestamp khusus layar kunci (gaya Webtype menghitung baris & animasinya sendiri di native)
  useEffect(() => {
    if (!ISLAND_OK) return;
    const ok = lockLyrics && lockStyle === 'webtype' && lyricsSynced && Array.isArray(lyrics) && lyrics.length > 0;
    Island.setLockLyricData({
      times: ok ? lyrics.map((l) => Number(l.time) || 0) : [],
      texts: ok ? lyrics.map((l) => String(l.text || '').trim()) : [],
    }).catch(() => {});
  }, [lyrics, lyricsSynced, lockLyrics, lockStyle, currentTrack]);

  // 5 baris lirik (2 sebelum, sekarang, 2 sesudah) untuk layar kunci
  const lockLines =
    lockLyrics && Array.isArray(lyrics) && lyrics.length > 0 && activeLineIndex >= 0
      ? [-2, -1, 0, 1, 2].map((d) => String(lyrics[activeLineIndex + d]?.text || '').trim())
      : ['', '', '', '', ''];
  const lockLinesKey = lockLines.join('\n');

  // posisi lagu untuk progress bar di Island (native menghitung sendiri selama lagu diputar)
  const islandTimeRef = useRef(0);
  islandTimeRef.current = currentTime;
  const durRef = useRef(0);
  durRef.current = duration;
  const islandSentRef = useRef({ pos: 0, at: 0 });
  const pushIsland = () => {
    if (!ISLAND_OK) return;
    islandSentRef.current = { pos: islandTimeRef.current, at: Date.now() };
    Island.update({
      title: currentTrack?.title || '',
      artist: currentTrack?.artist || '',
      cover: currentTrack?.cover || '',
      line: islandLine,
      lines: lockLines,
      playing: !!isPlaying,
      active: !!currentTrack,
      position: Number(islandTimeRef.current) || 0,
      duration: Number(durRef.current) || 0,
      lineMs: (() => {
        const a = Array.isArray(lyrics) ? lyrics[activeLineIndex] : null;
        const b = Array.isArray(lyrics) ? lyrics[activeLineIndex + 1] : null;
        return a && b && b.time > a.time ? Math.round((b.time - a.time) * 1000) : 0;
      })(),
    }).catch(() => {});
  };
  const pushIslandRef = useRef(pushIsland);
  pushIslandRef.current = pushIsland;

  useEffect(() => {
    pushIslandRef.current();
  }, [currentTrack, islandLine, lockLinesKey, isPlaying, duration]);

  // kirim lirik bertimestamp ke native: pil Island menghitung baris aktif sendiri,
  // jadi lirik tetap jalan walau JavaScript ditahan saat app di-Home
  useEffect(() => {
    if (!ISLAND_OK) return;
    const ok = islandLyrics && lyricsSynced && Array.isArray(lyrics) && lyrics.length > 0;
    Island.setLyrics({
      times: ok ? lyrics.map((l) => Number(l.time) || 0) : [],
      texts: ok ? lyrics.map((l) => String(l.text || '').trim()) : [],
    }).catch(() => {});
  }, [lyrics, lyricsSynced, islandLyrics, currentTrack]);

  // kalau posisi lompat (seek), kabari Island supaya progress-nya ikut
  useEffect(() => {
    if (!ISLAND_OK || !isPlaying) return;
    const s = islandSentRef.current;
    const expected = s.pos + (Date.now() - s.at) / 1000;
    if (Math.abs(currentTime - expected) > 2) pushIslandRef.current();
  }, [currentTime, isPlaying]);

  useEffect(() => {
    if (!ISLAND_OK) return undefined;
    let handle = null;
    let cancelled = false;
    Island.addListener('action', (e) => {
      const a = e && e.action;
      if (a === 'toggle') handleTogglePlayPause();
      else if (a === 'next') handleStepTrack(1);
      else if (a === 'prev') handleStepTrack(-1);
      else if (typeof a === 'string' && a.startsWith('seek:')) {
        const f = parseFloat(a.slice(5));
        if (f >= 0 && f <= 1 && durRef.current > 0 && seekRef.current) seekRef.current(f * durRef.current);
      }
    })
      .then((h) => {
        if (cancelled) h.remove();
        else handle = h;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (handle) handle.remove();
    };
  }, [handleTogglePlayPause, handleStepTrack]);

  // Judul + artis di notifikasi / layar kunci; baris lirik yang sedang dinyanyikan ikut tampil di sana
  const notifLine =
    notifLyrics && isPlaying && Array.isArray(lyrics) && activeLineIndex >= 0 && lyrics.length > 0
      ? String(lyrics[activeLineIndex]?.text || '').trim()
      : '';
  useEffect(() => {
    if (!currentTrack) return;
    (async () => {
      try {
        await MediaSession.setMetadata({
          title: currentTrack.title || '',
          artist: notifLine ? `♪ ${notifLine}` : currentTrack.artist || '',
          album: notifLine ? currentTrack.artist || '' : currentTrack.album || '',
          artwork: currentTrack.cover ? [{ src: currentTrack.cover, sizes: '512x512', type: 'image/jpeg' }] : [],
        });
      } catch {
        // plugin / browser tidak mendukung, abaikan
      }
    })();
  }, [currentTrack, notifLine]);

  // Kontrol layar kunci / notifikasi ala Spotify (Media Session)
  const timeRef = useRef(0);
  timeRef.current = currentTime;
  useEffect(() => {
    if (!currentTrack) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        await MediaSession.setActionHandler({ action: 'play' }, () => {
          if (!isPlayingRef.current) handleTogglePlayPause();
        });
        await MediaSession.setActionHandler({ action: 'pause' }, () => {
          if (isPlayingRef.current) handleTogglePlayPause();
        });
        await MediaSession.setActionHandler({ action: 'nexttrack' }, () => handleStepTrack(1));
        await MediaSession.setActionHandler({ action: 'previoustrack' }, () => handleStepTrack(-1));
        await MediaSession.setActionHandler({ action: 'seekto' }, (d) => {
          if (d && d.seekTime != null && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            ytPlayerRef.current.seekTo(d.seekTime, true);
            setCurrentTime(d.seekTime);
          }
        });
        await MediaSession.setPlaybackState({ playbackState: isPlaying ? 'playing' : 'paused' });
        if (duration > 0) {
          await MediaSession.setPositionState({
            duration,
            position: Math.max(0, Math.min(duration, timeRef.current || 0)),
            playbackRate: 1,
          });
        }
      } catch {
        // plugin / browser tidak mendukung, abaikan
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrack, isPlaying, duration, handleTogglePlayPause, handleStepTrack]);

  const handleSeek = (e) => {
    if (!e.currentTarget || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = ratio * duration;
    setCurrentTime(targetSec);
    if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(targetSec, true);
    }
  };

  // Simpan aktivitas: riwayat putar, suka, tema, volume, mode
  useEffect(() => {
    writeSaved('spideyfy-prefs', {
      liked: likedIds,
      suit: suitId,
      volume,
      mode: playbackMode,
      repeatMode,
      shuffle: shuffleOn,
      islandOn,
      islandLyrics,
      islandTheme,
      lockLyrics,
      lockStyle,
      notifLyrics,
    });
  }, [likedIds, suitId, volume, playbackMode, repeatMode, shuffleOn, islandOn, islandLyrics, islandTheme, lockLyrics, lockStyle, notifLyrics]);

  useEffect(() => {
    writeSaved('spideyfy-history', history);
  }, [history]);

  // Catat lagu ke riwayat setiap kali diputar
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    setHistory((prev) =>
      [slimTrack(currentTrack), ...prev.filter((x) => x.id !== currentTrack.id)].slice(0, 30)
    );
  }, [isPlaying, currentTrack?.id]);

  // Simpan lagu terakhir + posisi detik
  const saveLast = useCallback(() => {
    const t = currentTrackRef.current;
    if (!t) return;
    writeSaved('spideyfy-last', { track: slimTrack(t), time: Math.floor(currentTimeRef.current) });
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      saveLast();
      return undefined;
    }
    const iv = setInterval(saveLast, 3000);
    return () => clearInterval(iv);
  }, [isPlaying, currentTrack, saveLast]);

  useEffect(() => {
    const onHide = () => saveLast();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [saveLast]);

  // Simpan playlist ke HP
  useEffect(() => {
    try {
      localStorage.setItem('spideyfy-playlists', JSON.stringify(userPlaylists));
    } catch {
      // penyimpanan tidak tersedia
    }
  }, [userPlaylists]);

  const createPlaylist = (name, track) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const pl = { id: `up-${Date.now()}`, name: trimmed, tracks: track ? [slimTrack(track)] : [] };
    setUserPlaylists((prev) => [...prev, pl]);
    setNewPlaylistName('');
  };

  const toggleTrackInPlaylist = (plId, track) => {
    setUserPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== plId) return pl;
        const has = pl.tracks.some((t) => t.id === track.id);
        return {
          ...pl,
          tracks: has ? pl.tracks.filter((t) => t.id !== track.id) : [...pl.tracks, slimTrack(track)],
        };
      })
    );
  };

  const deletePlaylist = (plId) => {
    setUserPlaylists((prev) => prev.filter((pl) => pl.id !== plId));
    setOpenPlaylistId((cur) => (cur === plId ? null : cur));
  };

  // Buat playlist lengkap (nama, deskripsi, foto dari galeri) lalu langsung dibuka
  const createPlaylistFull = ({ name, desc, cover, coverVideoId }) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const pl = { id: `up-${Date.now()}`, name: trimmed, desc: desc || '', cover: cover || null, coverVideoId: coverVideoId || null, tracks: [] };
    setUserPlaylists((prev) => [...prev, pl]);
    setOpenPlaylistId(pl.id);
  };

  const updatePlaylist = (plId, patch) => {
    setUserPlaylists((prev) => prev.map((pl) => (pl.id === plId ? { ...pl, ...patch } : pl)));
  };

  // Dari halaman playlist: lagu yang ditekan diputar apa adanya,
  // tombol putar besar mulai dari lagu pertama (atau acak kalau acak menyala)
  const playFromPlaylistPage = (pl, track) => {
    if (!pl.tracks.length) return;
    let start = track;
    if (!start) {
      start = shuffleRef.current
        ? pl.tracks[Math.floor(Math.random() * pl.tracks.length)]
        : pl.tracks[0];
    }
    handleSelectTrack(start, true, pl.tracks);
  };

  const openPlaylist = userPlaylists.find((pl) => pl.id === openPlaylistId) || null;
  // Selera untuk rekomendasi beranda: lagu terakhir di playlist (terbaru dulu) lalu riwayat putar
  const tasteSeeds = useMemo(
    () => [...userPlaylists.flatMap((pl) => (pl.tracks || []).slice(-3).reverse()), ...history].filter((x) => x && x.artist),
    [userPlaylists, history]
  );
  const ownedIds = useMemo(
    () => new Set([...history.map((x) => x.id), ...userPlaylists.flatMap((pl) => (pl.tracks || []).map((x) => x.id))]),
    [userPlaylists, history]
  );

  // ===== Rekomendasi "Untukmu" di tab Cari (saat kolom cari kosong) =====
  const [recentSearches, setRecentSearches] = useState(() => readSaved('spideyfy-recent-searches', []));
  const [forYou, setForYou] = useState([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const forYouRef = useRef([]);
  forYouRef.current = forYou;
  const forYouAtRef = useRef(0);
  const searchQueryRef = useRef('');
  searchQueryRef.current = searchQuery;
  const noQuery = !searchQuery.trim();
  const showForYou = noQuery && activeCatalogTab === 'songs' && (forYou.length > 0 || forYouLoading);
  const songsView = showForYou ? forYou : catalog.songs;

  const rememberSearch = useCallback((q) => {
    const t = String(q || '').trim();
    if (t.length < 2) return;
    setRecentSearches((prev) => {
      const next = [t, ...prev.filter((x) => String(x).toLowerCase() !== t.toLowerCase())].slice(0, 8);
      try { localStorage.setItem('spideyfy-recent-searches', JSON.stringify(next)); } catch { /* abaikan */ }
      return next;
    });
  }, []);

  // Ingat pencarian yang benar-benar berujung memutar lagu
  useEffect(() => {
    if (currentTrack && searchQueryRef.current.trim().length >= 2) rememberSearch(searchQueryRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  const loadForYou = useCallback(async (force = false) => {
    if (!force && forYouRef.current.length && Date.now() - forYouAtRef.current < 30000) return;
    forYouAtRef.current = Date.now();
    setForYouLoading(true);
    try {
      const SUF = ['populer', 'terbaru', 'mix', 'hits', 'lainnya', 'pilihan'];
      const DISCOVER = ['lagu indonesia terbaru', 'lagu viral', 'top hits', 'lagu santai', 'lagu galau', 'lagu semangat', 'indie indonesia', 'lagu pop terbaik'];
      const qs = [];
      recentSearches.slice(0, 2).forEach((q) => qs.push(`${q} ${SUF[Math.floor(Math.random() * SUF.length)]}`));
      seedQueries(tasteSeeds, 2).forEach((q) => qs.push(q));
      if (qs.length < 3) shuffle(DISCOVER).slice(0, 3 - qs.length).forEach((q) => qs.push(q));
      const lists = await Promise.all(qs.slice(0, 4).map((q) => fetchSongs(q).catch(() => null)));
      const out = shuffle(mergeAlternating(lists, 30));
      if (out.length) setForYou(out);
    } catch {
      /* biarkan daftar lama / bawaan */
    } finally {
      setForYouLoading(false);
    }
  }, [recentSearches, tasteSeeds]);

  useEffect(() => {
    if (activeCatalogTab === 'songs' && noQuery) loadForYou(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCatalogTab, noQuery]);

  const playUserPlaylist = (pl, startTrack) => {
    if (!pl.tracks.length) return;
    handleSelectTrack(startTrack || pl.tracks[0], true, pl.tracks);
  };

  // Musik tetap jalan di latar belakang & layar mati (aplikasi Android)
  useEffect(() => {
    try {
      const bg = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundMode;
      if (!bg) return;
      const run = (name, arg) => {
        try {
          const fn = bg[name];
          const r = typeof fn === 'function' ? fn.call(bg, arg) : null;
          if (r && typeof r.catch === 'function') r.catch(() => {});
        } catch {
          // abaikan
        }
      };
      if (isPlaying) {
        run('requestNotificationsPermission');
        run('requestForegroundPermission');
        run('enable', { title: 'SpideyFy', text: 'Musik sedang diputar', channelName: 'SpideyFy Player' });
        run('disableWebViewOptimizations');
      } else {
        run('enableWebViewOptimizations');
        run('disable');
      }
    } catch {
      // abaikan
    }
  }, [isPlaying]);

  // Minta izin latar belakang sekali saat pertama dibuka (aplikasi Android)
  useEffect(() => {
    let timer;
    try {
      if (localStorage.getItem('spideyfy-bg-asked')) return undefined;
      timer = setTimeout(() => {
        if (askBackgroundPermission()) {
          try { localStorage.setItem('spideyfy-bg-asked', '1'); } catch { /* abaikan */ }
        }
      }, 2500);
    } catch {
      // abaikan
    }
    return () => clearTimeout(timer);
  }, []);

  // Lompat ke detik tertentu
  const seekToSec = (sec) => {
    setCurrentTime(sec);
    const pl = ytPlayerRef.current;
    if (pl && typeof pl.seekTo === 'function') pl.seekTo(sec, true);
  };
  seekRef.current = seekToSec;

  // Geser bar durasi (layar lirik penuh)
  const scrubFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const sec = ratio * (duration || 0);
    setCurrentTime(sec);
    return sec;
  };
  const onScrubDown = (e) => {
    if (!(duration > 0)) return;
    scrubbingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // abaikan
    }
    scrubFromEvent(e);
  };
  const onScrubMove = (e) => {
    if (!scrubbingRef.current) return;
    scrubFromEvent(e);
  };
  const onScrubUp = (e) => {
    if (!scrubbingRef.current) return;
    const sec = scrubFromEvent(e);
    scrubbingRef.current = false;
    seekToSec(sec);
  };

  // Lirik penuh: baris aktif selalu di tengah layar
  useEffect(() => {
    if (!fullLyrics) return;
    const box = fullLyricsRef.current;
    const el = document.getElementById(`full-line-${activeLineIndex}`);
    if (!box || !el) return;
    box.scrollTo({
      top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2,
      behavior: scrubbingRef.current ? 'auto' : 'smooth',
    });
  }, [fullLyrics, activeLineIndex]);

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
    rememberSearch(sg);
    fetchFromYtMusicProxy(sg);
  };

  const handleSearchSubmit = (e) => {
    setShowSuggest(false);
    e.preventDefault();
    rememberSearch(searchQuery);
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
      'w-full h-full flex flex-col overflow-hidden max-lg:rounded-none! max-lg:border-0! border border-white/15 bg-[#121218]/80 lg:backdrop-blur-2xl max-lg:shadow-none shadow-[0_30px_90px_rgba(0,0,0,0.82)] transition-all duration-500';
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
      className="relative w-full h-[100dvh] overflow-hidden bg-[#060609] text-neutral-100 select-none flex flex-col"
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
      <header className="relative z-20 h-7 px-3.5 flex items-center justify-between bg-[#0b0b10]/90 lg:bg-[#0b0b10]/60 lg:backdrop-blur-2xl lg:backdrop-saturate-150 border-b border-white/[0.09] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] text-[11.5px] font-medium text-neutral-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: suit.primary, boxShadow: `0 0 10px ${suit.glow}` }}
          />
          <span className="font-bold tracking-tight">SpideyFy</span>
          <span className="hidden sm:inline text-neutral-400">• {suit.fullName}</span>
        </div>

        <div className="flex items-center gap-3">
          {!backendConnected && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Fallback Catalog</span>
            </span>
          )}
          <span className="tabular-nums text-neutral-300">{clockText}</span>
        </div>
      </header>

      {/* Main macOS Desktop Stage */}
      <main className="relative z-10 flex-1 min-h-0 flex items-center justify-center p-0 sm:p-4 pb-14 lg:pb-20">
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
          <div className="px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-center lg:justify-between gap-2.5 bg-white/[0.03] border-b border-white/[0.08] shrink-0">
            <div className="hidden lg:flex items-center gap-2 group">
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
            <div className="flex items-center gap-1 p-1 rounded-full bg-black/45 border border-white/10 w-full lg:w-auto">
              {Object.values(SUITS).map((item) => {
                const active = suitId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => switchSuit(item.id, e)}
                    style={
                      active
                        ? { backgroundColor: item.primary, boxShadow: `0 2px 12px ${item.glow}` }
                        : undefined
                    }
                    className={`flex-1 lg:flex-none px-3 py-2 lg:py-1 rounded-full text-[12px] lg:text-[11px] font-bold transition-all duration-300 active:scale-95 ${
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
                mobilePane === 'lyrics' ? 'hidden lg:flex' : 'flex pane-swap'
              } flex-col min-h-0 min-w-0 bg-black/15 lg:border-r border-white/[0.08]`}
            >
              <div className="p-3.5 pb-2.5 space-y-2.5 border-b border-white/[0.07] shrink-0">
                {activeCatalogTab === 'songs' && (
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
                )}

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

                <div className="flex items-center justify-end gap-2 text-[11px] text-neutral-400">
                  {showForYou && (
                    <button
                      type="button"
                      onClick={() => loadForYou(true)}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white active:scale-95 transition"
                    >
                      <RefreshCw className={`w-3 h-3 ${forYouLoading ? 'animate-spin' : ''}`} /> Segarkan
                    </button>
                  )}
                  <span className="capitalize font-semibold text-neutral-300 shrink-0">{activeCatalogTab === 'home' ? 'Beranda' : activeCatalogTab === 'settings' ? 'Setelan' : showForYou ? 'Untukmu' : activeCatalogTab}</span>
                </div>
              </div>

              <div
                key={`${activeCatalogTab}${openPlaylist ? ':open' : ''}`}
                className={`${['songs', 'albums', 'artists', 'playlists'].includes(activeCatalogTab) ? 'stagger' : 'pane-enter'} flex-1 overflow-y-auto p-3 space-y-2`}
              >
                {activeCatalogTab === 'settings' && (
                  <SettingsView
                    suit={suit}
                    suitId={suitId}
                    setSuitId={setSuitId}
                    playbackMode={playbackMode}
                    setPlaybackMode={setPlaybackMode}
                    backendConnected={backendConnected}
                    islandOn={islandOn}
                    setIslandOn={handleSetIsland}
                    islandLyrics={islandLyrics}
                    setIslandLyrics={setIslandLyrics}
                    islandTheme={islandTheme}
                    setIslandTheme={setIslandTheme}
                    lockLyrics={lockLyrics}
                    setLockLyrics={handleSetLock}
                    lockStyle={lockStyle}
                    setLockStyle={setLockStyle}
                    notifLyrics={notifLyrics}
                    setNotifLyrics={setNotifLyrics}
                    sleepLeft={sleepLeft}
                    sleepEot={sleepEot}
                    onSleepStart={startSleep}
                    onSleepEot={startSleepEot}
                    onSleepAdd={addSleep}
                    onSleepCancel={cancelSleep}
                  />
                )}

                {activeCatalogTab === 'home' && (
                  <HomeViewM
                    songs={catalog.songs}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    suit={suit}
                    onPlay={playFromList}
                    history={history}
                    seeds={tasteSeeds}
                    ownedIds={ownedIds}
                  />
                )}

                {activeCatalogTab === 'songs' && showForYou && forYou.length === 0 && (
                  <div className="text-center text-xs text-neutral-400 py-10">Menyiapkan rekomendasi untukmu…</div>
                )}
                {activeCatalogTab === 'songs' &&
                  songsView.map((track, idx) => {
                    const isSelected = currentTrack?.id === track.id;
                    const isLiked = likedIds.includes(track.id);
                    return (
                      <div
                        key={track.id}
                        onClick={() => handleSelectTrack(track, true, showForYou ? forYou : null)}
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

                        <CoverImg
                          src={track.cover}
                          videoId={track.videoId || track.id}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setPickerTrack(track);
                          }}
                          aria-label="Tambah ke playlist"
                          className="p-1.5 rounded-full text-neutral-500 hover:text-white transition active:scale-90"
                        >
                          <ListPlus className="w-4 h-4" />
                        </button>

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
                        <CoverImg
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
                        <CoverImg
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

                {activeCatalogTab === 'playlists' && openPlaylist && (
                  <PlaylistDetail
                    suit={suit}
                    pl={openPlaylist}
                    songs={catalog.songs}
                    currentTrackId={currentTrack?.id}
                    isPlaying={isPlaying}
                    onBack={() => setOpenPlaylistId(null)}
                    onPlay={playFromPlaylistPage}
                    shuffleOn={shuffleOn}
                    onToggleShuffle={handleToggleShuffle}
                    onUpdate={updatePlaylist}
                    onDelete={deletePlaylist}
                    onToggleTrack={toggleTrackInPlaylist}
                  />
                )}

                {activeCatalogTab === 'playlists' && !openPlaylist && (
                  <div className="space-y-2">
                    <PlaylistLibrary
                      suit={suit}
                      playlists={userPlaylists}
                      onOpen={setOpenPlaylistId}
                      onCreate={createPlaylistFull}
                    />
                    <div className="text-xs font-extrabold text-white pt-3">Playlist YouTube Music</div>
                    {catalog.playlists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => handleCollectionClick(pl.sampleTrackId)}
                        className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] cursor-pointer transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CoverImg
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
                mobilePane === 'catalog' ? 'hidden lg:flex' : 'flex pane-swap'
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
                <div className="hidden lg:flex items-center gap-3.5 p-3 rounded-2xl bg-black/40 border border-white/10 shrink-0">
                  <CoverImg
                    src={currentTrack?.cover || FALLBACK_CATALOG.songs[0].cover}
                    videoId={currentTrack?.videoId || currentTrack?.id}
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

              {/* Panel pemutar besar (HP) */}
              <div className="lg:hidden shrink-0 relative isolate overflow-hidden rounded-3xl p-3.5 space-y-2.5" style={{ border: `1px solid ${suit.primary}99`, boxShadow: `0 0 22px ${suit.glow}, inset 0 0 30px rgba(0,0,0,0.6)`, background: `linear-gradient(120deg, rgba(10,6,10,0.96) 0%, ${suit.orbA} 100%)` }}>
                <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden="true">
                  <WebCorner color={suit.primary} />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.12]"><SpiderIcon size={170} color={suit.primary} /></div>
                  <img src="/banner.png" alt="" className="absolute right-0 bottom-0 h-[115%] object-contain opacity-40" style={{ WebkitMaskImage: 'linear-gradient(to left, #000 35%, transparent 95%)', maskImage: 'linear-gradient(to left, #000 35%, transparent 95%)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${suit.primary}, transparent)` }} />
                </div>
                <div className="flex items-center gap-3">
                  <CoverImg
                    src={currentTrack?.cover || FALLBACK_CATALOG.songs[0].cover}
                    videoId={currentTrack?.videoId || currentTrack?.id}
                    alt={currentTrack?.title || 'Cover'}
                    className="w-20 h-20 rounded-xl object-cover shrink-0 border border-white/15 shadow-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-extrabold text-white truncate">
                      {currentTrack?.title || 'Select a Track'}
                    </h2>
                    <p className="text-xs text-neutral-400 truncate">{currentTrack?.artist || 'SpideyFy'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => currentTrack && handleToggleLike(currentTrack.id, e)}
                      aria-label="Suka"
                      className={`p-2.5 rounded-full bg-white/10 active:scale-90 transition ${
                        isCurrentLiked ? 'text-rose-500' : 'text-neutral-200'
                      }`}
                    >
                      <Heart className="w-5 h-5" fill={isCurrentLiked ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={() => currentTrack && setPickerTrack(currentTrack)}
                      aria-label="Tambah ke playlist"
                      className="p-2.5 rounded-full bg-white/10 text-neutral-200 active:scale-90 transition"
                    >
                      <ListPlus className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQueue(true)}
                      aria-label="Antrean"
                      className="relative p-2.5 rounded-full bg-white/10 text-neutral-200 active:scale-90 transition"
                    >
                      <ListMusic className="w-5 h-5" />
                      {userQueue.length > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white" style={{ background: suit.primary }}>{userQueue.length}</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] text-neutral-400 tabular-nums w-9 text-right">
                    {formatDuration(currentTime)}
                  </span>
                  <div
                    onClick={handleSeek}
                    role="slider"
                    aria-label="Playback progress"
                    className="relative flex-1 h-9 flex items-center cursor-pointer"
                  >
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/20" />
                    <div
                      className="absolute left-0 h-1.5 rounded-full"
                      style={{
                        width: `${progressPct}%`,
                        background: `linear-gradient(90deg, ${suit.secondary}, ${suit.primary})`,
                        boxShadow: `0 0 8px ${suit.glow}`,
                      }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                      style={{ left: `${progressPct}%` }}
                    >
                      <SpiderIcon size={24} color={suit.primary} />
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-400 tabular-nums w-9">{formatDuration(duration)}</span>
                </div>

                <div className="flex items-center justify-between px-1">
                  <RepeatButton mode={repeatMode} onClick={handleCycleRepeat} suit={suit} big />
                  <button
                    type="button"
                    onClick={() => handleStepTrack(-1)}
                    aria-label="Lagu sebelumnya"
                    className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition"
                  >
                    <SkipBack className="w-6 h-6" fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={handleTogglePlayPause}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    style={{ backgroundColor: suit.primary, boxShadow: `0 6px 22px ${suit.glow}` }}
                    className="w-16 h-16 rounded-full text-white flex items-center justify-center active:scale-90 transition-transform"
                  >
                    {isPlaying ? (
                      <Pause className="w-8 h-8" fill="currentColor" />
                    ) : (
                      <Play className="w-8 h-8 ml-1" fill="currentColor" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepTrack(1)}
                    aria-label="Lagu berikutnya"
                    className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <SkipForward className="w-6 h-6" fill="currentColor" />
                  </button>
                  <ShuffleButton on={shuffleOn} onClick={handleToggleShuffle} suit={suit} big />
                </div>
              </div>

              <div className="shrink-0 self-end flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setActiveCatalogTab('settings'); setMobilePane('catalog'); }}
                  aria-label="Sleep Timer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white active:scale-95 transition tabular-nums"
                  style={{ background: sleepLeft > 0 || sleepEot ? suit.primary : 'rgba(255,255,255,0.1)' }}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{sleepEot ? 'Akhir lagu' : sleepLeft > 0 ? fmtSleep(sleepLeft) : 'Timer'}</span>
                </button>
                {lyrics.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFullLyrics(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-bold text-white active:scale-95 transition"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Lirik layar penuh</span>
                  </button>
                )}
              </div>

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
                  <NoLyrics suit={suit} loading={lyricsSource === 'Searching LRCLIB...'} instrumental={lyricsSource === 'Instrumental'} seed={currentTrack?.id} />
                )}
                {lyrics.map((line, i) => {
                  const isActive = i === activeLineIndex;
                  const isPassed = i < activeLineIndex;
                  return (
                    <p
                      key={`${line.time}-${i}`}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => { if (lyricsSynced) seekToSec(line.time); }}
                      style={
                        isActive
                          ? {
                              color: '#ffffff',
                              textShadow: `0 0 18px ${suit.glow}, 0 0 34px ${suit.glow}`,
                            }
                          : undefined
                      }
                      className={`text-lg sm:text-xl font-extrabold leading-snug tracking-tight cursor-pointer origin-left transition-all duration-500 ${
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
          <footer className={`${mobilePane === 'lyrics' ? 'max-lg:hidden ' : ''}px-3.5 sm:px-5 py-2.5 bg-black/85 border-t border-white/[0.09] grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1.45fr_1fr] items-center gap-3 shrink-0`}>
            {/* Track Info (tap untuk buka lagu dan lirik) */}
            <div className="flex items-center gap-2.5 min-w-0 cursor-pointer" onClick={() => setMobilePane('lyrics')}>
              <CoverImg
                src={currentTrack?.cover || FALLBACK_CATALOG.songs[0].cover}
                videoId={currentTrack?.videoId || currentTrack?.id}
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
                <ShuffleButton on={shuffleOn} onClick={handleToggleShuffle} suit={suit} />
                <RepeatButton mode={repeatMode} onClick={handleCycleRepeat} suit={suit} />
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

      {/* Lirik layar penuh */}
      {fullLyrics && createPortal(
        <div
          className={`flex flex-col ${lyricsClosing ? 'sheet-down' : 'sheet-up'}`}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            height: '100dvh',
            zIndex: 55,
            backgroundColor: '#07070b',
            backgroundImage: `radial-gradient(circle at 50% 0%, ${suit.orbA}, transparent 70%)`,
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          <div className="flex items-center gap-3 px-4 pt-3 pb-2 shrink-0">
            <CoverImg
              src={currentTrack?.cover || FALLBACK_CATALOG.songs[0].cover}
              videoId={currentTrack?.videoId || currentTrack?.id}
              alt={currentTrack?.title || 'Cover'}
              className="w-11 h-11 rounded-lg object-cover border border-white/15 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-white truncate">{currentTrack?.title}</div>
              <div className="text-[11px] text-neutral-400 truncate">{currentTrack?.artist}</div>
            </div>
            <button
              type="button"
              onClick={closeFullLyrics}
              aria-label="Tutup lirik penuh"
              className="p-2.5 rounded-full bg-white/10 text-white active:scale-90 transition"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          {lyricsSynced && lyrics.length > 0 && (
            <div className="flex items-center justify-center gap-2 px-4 pb-1 shrink-0 text-[11px] text-neutral-300">
              <span>Sinkron</span>
              <button type="button" onClick={() => adjustLyricOffset(-0.5)} className="px-3 py-1.5 rounded-full bg-white/10 font-bold text-white active:scale-90 transition">{'\u2212'}0.5s</button>
              <span className="min-w-[48px] text-center font-bold text-white">{lyricOffset > 0 ? '+' : ''}{lyricOffset.toFixed(1)}s</span>
              <button type="button" onClick={() => adjustLyricOffset(0.5)} className="px-3 py-1.5 rounded-full bg-white/10 font-bold text-white active:scale-90 transition">+0.5s</button>
              <span className="text-neutral-500">{'\u2212'} lebih cepat, + lebih lambat</span>
            </div>
          )}
          {lyricCands.length > 1 && (
            <div className="px-4 pb-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowLyricPick((v) => !v)}
                className="mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-bold text-white active:scale-95 transition"
              >
                <Mic2 className="w-3.5 h-3.5" /> Lirik tidak pas? Ganti versi ({lyricCands.length})
              </button>
              {showLyricPick && (
                <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl bg-white/[0.07] p-1.5 space-y-1">
                  {lyricCands.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => chooseLyricCand(c)}
                      className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left active:scale-[0.99] transition"
                      style={{ background: c.id === lyricCurId ? `${suit.primary}55` : 'transparent' }}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-white truncate">{c.trackName}</span>
                        <span className="block text-[10px] text-neutral-400 truncate">
                          {c.artistName} · {formatDuration(c.duration || 0)} · {c.synced ? 'tersinkron' : 'tanpa sinkron'}
                        </span>
                      </span>
                      {c.id === lyricCurId && <span className="text-[10px] font-black shrink-0" style={{ color: suit.primary }}>dipakai</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            ref={fullLyricsRef}
            className="relative flex-1 min-h-0 overflow-y-auto px-5 py-10 space-y-5"
            style={{
              maskImage: 'linear-gradient(180deg, transparent 0%, #000 10%, #000 90%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 10%, #000 90%, transparent 100%)',
            }}
          >
            {lyrics.length === 0 && (
              <NoLyrics suit={suit} loading={lyricsSource === 'Searching LRCLIB...'} instrumental={lyricsSource === 'Instrumental'} seed={currentTrack?.id} />
            )}
            {lyrics.map((line, i) => {
              const isActive = i === activeLineIndex;
              const isPassed = i < activeLineIndex;
              return (
                <p
                  id={`full-line-${i}`}
                  key={`full-${line.time}-${i}`}
                  onClick={() => { if (lyricsSynced) seekToSec(line.time); }}
                  style={
                    isActive
                      ? { color: '#ffffff', textShadow: `0 0 18px ${suit.glow}, 0 0 34px ${suit.glow}` }
                      : undefined
                  }
                  className={`text-2xl font-extrabold leading-snug tracking-tight cursor-pointer transition-all duration-500 ${
                    isActive
                      ? 'opacity-100'
                      : isPassed
                      ? 'opacity-45 text-neutral-200'
                      : 'opacity-30 text-neutral-300'
                  }`}
                >
                  {line.text}
                </p>
              );
            })}
            <div className="h-24" />
          </div>

          <div
            className="shrink-0 px-5 pt-3 space-y-2 bg-black/60 border-t border-white/10"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            <div
              role="slider"
              aria-label="Durasi lagu"
              onPointerDown={onScrubDown}
              onPointerMove={onScrubMove}
              onPointerUp={onScrubUp}
              onPointerCancel={onScrubUp}
              className="relative h-10 flex items-center cursor-pointer"
              style={{ touchAction: 'none' }}
            >
              <div className="absolute inset-x-0 h-2 rounded-full bg-white/20" />
              <div
                className="absolute left-0 h-2 rounded-full bg-white"
                style={{ width: `${progressPct}%`, boxShadow: `0 0 10px ${suit.glow}` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2"
                style={{ left: `${progressPct}%`, borderColor: suit.primary }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-300 tabular-nums">
              <span>{formatDuration(currentTime)}</span>
              <button
                type="button"
                onClick={() => setShowQueue(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-bold text-white active:scale-95 transition"
              >
                <ListMusic className="w-3.5 h-3.5" /> Antrean{userQueue.length > 0 ? ` (${userQueue.length})` : ''}
              </button>
              <span>{formatDuration(duration)}</span>
            </div>

            <div className="flex items-center justify-between px-1">
              <RepeatButton mode={repeatMode} onClick={handleCycleRepeat} suit={suit} big />
              <button
                type="button"
                onClick={() => handleStepTrack(-1)}
                aria-label="Lagu sebelumnya"
                className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition"
              >
                <SkipBack className="w-6 h-6" fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={handleTogglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                style={{ backgroundColor: suit.primary, boxShadow: `0 6px 22px ${suit.glow}` }}
                className="w-16 h-16 rounded-full text-white flex items-center justify-center active:scale-90 transition-transform"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" fill="currentColor" />
                ) : (
                  <Play className="w-8 h-8 ml-1" fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleStepTrack(1)}
                aria-label="Lagu berikutnya"
                className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-90 transition-transform"
              >
                <SkipForward className="w-6 h-6" fill="currentColor" />
              </button>
              <ShuffleButton on={shuffleOn} onClick={handleToggleShuffle} suit={suit} big />
            </div>
          </div>
        </div>,
        document.body
      )}

      {queueToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg"
          style={{ zIndex: 290, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)', background: suit.primary, animation: 'rcRise .25s both' }}
        >
          {queueToast}
        </div>
      )}

      {showQueue &&
        createPortal(
          <div className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/70" style={{ zIndex: 280 }} onClick={() => setShowQueue(false)}>
            <div
              className="w-full sm:max-w-sm max-h-[82dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#14141b] border border-white/15"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 p-4 pb-2 shrink-0">
                <div>
                  <div className="text-sm font-extrabold text-white">Antrean</div>
                  <div className="text-[11px] text-neutral-400">{userQueue.length ? `${userQueue.length} lagu berikutnya` : 'Masih kosong'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {userQueue.length > 0 && (
                    <button type="button" onClick={clearQueue} className="px-3 py-1.5 rounded-full bg-white/10 text-xs font-bold text-white active:scale-95 transition">Bersihkan</button>
                  )}
                  <button type="button" onClick={() => setShowQueue(false)} aria-label="Tutup antrean" className="p-2 rounded-full bg-white/10 text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto px-4 pb-4 space-y-2">
                {currentTrack && (
                  <>
                    <div className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Sedang diputar</div>
                    <div className="flex items-center gap-2.5 rounded-xl p-2" style={{ background: `${suit.primary}26`, border: `1px solid ${suit.primary}66` }}>
                      <CoverImg src={currentTrack.cover} videoId={currentTrack.videoId || currentTrack.id} alt={currentTrack.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{currentTrack.title}</div>
                        <div className="text-[11px] text-neutral-300 truncate">{currentTrack.artist}</div>
                      </div>
                    </div>
                  </>
                )}
                <div className="text-[11px] font-black uppercase tracking-widest text-neutral-400 pt-1">Berikutnya dari antrean</div>
                {userQueue.length === 0 && (
                  <p className="text-xs text-neutral-400">Belum ada lagu. Tekan ikon tambah di lagu mana pun, lalu pilih "Putar berikutnya" atau "Tambah ke antrean".</p>
                )}
                {userQueue.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] p-2">
                    <button
                      type="button"
                      onClick={() => { playQueueItem(t.id); setShowQueue(false); }}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <CoverImg src={t.cover} videoId={t.videoId || t.id} alt={t.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{t.title}</div>
                        <div className="text-[11px] text-neutral-400 truncate">{t.artist}</div>
                      </div>
                    </button>
                    <button type="button" onClick={() => moveInQueue(t.id, -1)} disabled={i === 0} aria-label="Naikkan" className="p-2 rounded-full bg-white/10 text-white disabled:opacity-30 active:scale-90 transition">
                      <ChevronRight className="w-4 h-4" style={{ transform: 'rotate(-90deg)' }} />
                    </button>
                    <button type="button" onClick={() => moveInQueue(t.id, 1)} disabled={i === userQueue.length - 1} aria-label="Turunkan" className="p-2 rounded-full bg-white/10 text-white disabled:opacity-30 active:scale-90 transition">
                      <ChevronRight className="w-4 h-4" style={{ transform: 'rotate(90deg)' }} />
                    </button>
                    <button type="button" onClick={() => removeFromQueue(t.id)} aria-label="Hapus dari antrean" className="p-2 rounded-full bg-white/10 text-white active:scale-90 transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Pilih playlist untuk menambah lagu */}
      {pickerTrack && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70"
          onClick={() => setPickerTrack(null)}
        >
          <div
            className="w-full sm:max-w-sm max-h-[80dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14141b] border border-white/15 p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white">Tambahkan lagu</div>
                <div className="text-[11px] text-neutral-400 truncate">{pickerTrack.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setPickerTrack(null)}
                aria-label="Tutup"
                className="p-2 rounded-full bg-white/10 text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { addToQueue(pickerTrack, true); setPickerTrack(null); }}
                className="rounded-xl py-2.5 text-xs font-bold text-white bg-white/10 active:scale-95 transition"
              >
                Putar berikutnya
              </button>
              <button
                type="button"
                onClick={() => { addToQueue(pickerTrack, false); setPickerTrack(null); }}
                className="rounded-xl py-2.5 text-xs font-bold text-white bg-white/10 active:scale-95 transition"
              >
                Tambah ke antrean
              </button>
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest text-neutral-400 pt-1">Atau simpan ke playlist</div>
            <div className="flex gap-2">
              <input
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Nama playlist baru"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => createPlaylist(newPlaylistName, pickerTrack)}
                style={{ backgroundColor: suit.primary }}
                className="px-3.5 py-2 rounded-xl text-sm font-bold text-white active:scale-95"
              >
                Buat
              </button>
            </div>
            {userPlaylists.length === 0 && (
              <p className="text-[11px] text-neutral-400">Belum ada playlist. Buat satu di atas.</p>
            )}
            {userPlaylists.map((pl) => {
              const has = pl.tracks.some((t) => t.id === pickerTrack.id);
              return (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => toggleTrackInPlaylist(pl.id, pickerTrack)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.05] active:scale-[0.99] text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-white truncate">{pl.name}</span>
                    <span className="block text-[11px] text-neutral-400">{pl.tracks.length} lagu</span>
                  </span>
                  {has && <Check className="w-5 h-5 shrink-0" style={{ color: suit.primary }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigasi bawah (HP) */}
      <nav aria-label="Navigasi" className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 flex items-stretch px-1.5 bg-[#0b0b10]/95 lg:bg-[#0b0b10]/70 lg:backdrop-blur-2xl lg:backdrop-saturate-150 border-t border-white/[0.12]">
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 rounded-2xl pointer-events-none"
          style={{
            left: '0.375rem',
            width: 'calc((100% - 0.75rem) / 5)',
            transform: `translate3d(${Math.max(0, MOBILE_TABS.findIndex((t) => t.id === (mobilePane === 'lyrics' ? 'lyrics' : activeCatalogTab))) * 100}%, 0, 0)`,
            opacity: MOBILE_TABS.some((t) => t.id === (mobilePane === 'lyrics' ? 'lyrics' : activeCatalogTab)) ? 1 : 0,
            backgroundColor: 'rgba(255,255,255,0.09)',
            transition: 'transform 460ms cubic-bezier(0.32,0.72,0,1), opacity 200ms ease',
          }}
        />
        {MOBILE_TABS.map((tab) => {
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
              className="relative flex-1 my-1.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-[transform,color] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]"
              style={{ color: active ? suit.primary : '#a3a3a3' }}
            >
              <Icon className="w-5 h-5 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]" style={{ transform: active ? 'translateY(-1px) scale(1.12)' : 'none' }} />
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
            <CoverImg
              src={currentTrack.cover}
              videoId={currentTrack.videoId || currentTrack.id}
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
