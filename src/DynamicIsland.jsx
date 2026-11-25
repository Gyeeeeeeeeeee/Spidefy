import React, { useEffect, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

function fmt(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Bars({ color, active }) {
  return (
    <span className="flex items-end gap-[2px] h-3.5 shrink-0" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[2.5px] rounded-full"
          style={{
            backgroundColor: color,
            height: active ? undefined : '35%',
            animation: active ? `spIslandBar 0.9s ease-in-out ${i * 0.15}s infinite` : 'none',
          }}
        />
      ))}
    </span>
  );
}

/**
 * Pulau mengambang ala Dynamic Island.
 * - Tertutup: pil hitam kecil (sampul + equalizer), kalau lirik tampil jadi pil lebih lebar berisi baris lirik.
 * - Ketuk: membesar jadi kartu berisi lirik, progres, dan tombol kontrol. Ketuk lagi untuk menutup.
 */
export default function DynamicIsland({
  suit,
  track,
  isPlaying,
  lyrics,
  activeIndex,
  currentTime,
  duration,
  showLyrics,
  onTogglePlay,
  onNext,
  onPrev,
}) {
  const [open, setOpen] = useState(false);

  // Tutup otomatis kalau lagu berganti
  useEffect(() => {
    setOpen(false);
  }, [track?.id]);

  if (!track) return null;

  const hasLyrics = showLyrics && Array.isArray(lyrics) && lyrics.length > 0 && activeIndex >= 0;
  const current = hasLyrics ? lyrics[activeIndex]?.text : '';
  const next = hasLyrics ? lyrics[activeIndex + 1]?.text : '';
  const prev = hasLyrics ? lyrics[activeIndex - 1]?.text : '';
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const showLine = !open && hasLyrics && isPlaying && current;

  const width = open ? 'min(94vw, 380px)' : showLine ? 'min(88vw, 340px)' : '150px';
  const height = open ? (hasLyrics ? 196 : 138) : 36;

  return (
    <div
      className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
    >
      <style>{`
        @keyframes spIslandBar { 0%,100% { height: 25%; } 50% { height: 100%; } }
        @keyframes spIslandLine { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        role="button"
        tabIndex={0}
        aria-label="Dynamic Island pemutar musik"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="pointer-events-auto relative overflow-hidden bg-black text-white cursor-pointer select-none"
        style={{
          width,
          height,
          borderRadius: open ? 28 : 999,
          border: `1px solid ${open ? `${suit.primary}66` : 'rgba(255,255,255,0.08)'}`,
          boxShadow: open
            ? `0 14px 40px rgba(0,0,0,0.65), 0 0 22px ${suit.glow}`
            : isPlaying
            ? `0 4px 16px rgba(0,0,0,0.6), 0 0 10px ${suit.glow}`
            : '0 4px 16px rgba(0,0,0,0.6)',
          transition:
            'width 0.45s cubic-bezier(0.32, 1.25, 0.4, 1), height 0.45s cubic-bezier(0.32, 1.25, 0.4, 1), border-radius 0.35s ease, box-shadow 0.35s ease',
        }}
      >
        {/* Bentuk tertutup */}
        <div
          className="absolute inset-0 flex items-center gap-2 px-1.5"
          style={{
            opacity: open ? 0 : 1,
            pointerEvents: open ? 'none' : 'auto',
            transition: 'opacity 0.2s ease',
          }}
        >
          <img src={track.cover} alt="" className="w-[26px] h-[26px] rounded-full object-cover shrink-0" />
          {showLine ? (
            <span
              key={activeIndex}
              className="flex-1 min-w-0 text-[12px] font-bold truncate text-center"
              style={{ animation: 'spIslandLine 0.3s ease both' }}
            >
              {current}
            </span>
          ) : (
            <span className="flex-1 min-w-0 text-[11px] font-bold truncate text-center text-neutral-200">
              {track.title}
            </span>
          )}
          <span className="pr-1.5">
            <Bars color={suit.primary} active={isPlaying} />
          </span>
        </div>

        {/* Bentuk terbuka */}
        <div
          className="absolute inset-0 p-3.5 flex flex-col"
          style={{
            opacity: open ? 1 : 0,
            pointerEvents: open ? 'auto' : 'none',
            transition: `opacity ${open ? '0.3s ease 0.12s' : '0.12s ease'}`,
          }}
        >
          <div className="flex items-center gap-3">
            <img src={track.cover} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold truncate">{track.title}</div>
              <div className="text-[11px] text-neutral-400 truncate">{track.artist}</div>
            </div>
            <Bars color={suit.primary} active={isPlaying} />
          </div>

          {hasLyrics && (
            <div className="mt-2.5 text-center leading-tight space-y-0.5 overflow-hidden">
              <div className="text-[10.5px] text-neutral-500 truncate h-[14px]">{prev || ''}</div>
              <div
                key={activeIndex}
                className="text-[14px] font-black truncate"
                style={{ color: '#fff', textShadow: `0 0 14px ${suit.glow}`, animation: 'spIslandLine 0.3s ease both' }}
              >
                {current || '♪'}
              </div>
              <div className="text-[10.5px] text-neutral-400 truncate h-[14px]">{next || ''}</div>
            </div>
          )}

          <div className="mt-auto">
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 tabular-nums">
              <span>{fmt(currentTime)}</span>
              <div className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: suit.primary }} />
              </div>
              <span>{fmt(duration)}</span>
            </div>
            <div className="flex items-center justify-center gap-6 mt-1.5">
              <button
                type="button"
                aria-label="Sebelumnya"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev();
                }}
                className="p-1.5 active:scale-90"
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </button>
              <button
                type="button"
                aria-label={isPlaying ? 'Jeda' : 'Putar'}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePlay();
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
                style={{ backgroundColor: suit.primary }}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" fill="currentColor" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                aria-label="Berikutnya"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="p-1.5 active:scale-90"
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
