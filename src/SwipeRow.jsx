import React, { useRef, useState } from 'react';
import { ListMusic } from 'lucide-react';

// Baris lagu yang bisa digeser ke kanan untuk menambah ke antrean (seperti Spotify)
export default function SwipeRow({ onSwipe, color, className, onClick, disabled = false, children }) {
  const [dx, setDx] = useState(0);
  const st = useRef(null);
  const moved = useRef(false);
  const THRESH = 70;
  const down = (e) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    st.current = { x: e.clientX, y: e.clientY, lock: false };
    moved.current = false;
  };
  const move = (e) => {
    const s0 = st.current;
    if (!s0 || disabled) return;
    const ddx = e.clientX - s0.x;
    const ddy = e.clientY - s0.y;
    if (!s0.lock) {
      if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
        s0.lock = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
      } else {
        return;
      }
    }
    moved.current = true;
    setDx(Math.max(0, Math.min(110, ddx * 0.8)));
  };
  const end = () => {
    const s0 = st.current;
    st.current = null;
    if (!s0) return;
    if (s0.lock && dx >= THRESH) {
      onSwipe();
      navigator.vibrate?.(10);
    }
    setDx(0);
  };
  return (
    <div className="relative rounded-xl overflow-hidden">
      <div
        className="absolute inset-0 flex items-center gap-2 pl-4 text-xs font-bold text-white"
        style={{ background: color, opacity: Math.min(1, dx / THRESH) }}
        aria-hidden="true"
      >
        <ListMusic className="w-4 h-4" /> {dx >= THRESH ? 'Lepas untuk tambah ke antrean' : 'Geser: tambah ke antrean'}
      </div>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onClickCapture={(e) => {
          if (moved.current) {
            e.stopPropagation();
            moved.current = false;
          }
        }}
        onClick={onClick}
        className={className}
        style={{
          touchAction: 'pan-y',
          transform: `translate3d(${dx}px, 0, 0)`,
          transition: st.current ? 'none' : 'transform 220ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

