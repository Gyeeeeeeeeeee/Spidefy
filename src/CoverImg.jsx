import React, { useEffect, useState } from 'react';

// Gambar sampul yang tidak pernah "rusak": kalau URL utama gagal dimuat, otomatis coba
// thumbnail YouTube dari videoId, dan kalau semuanya gagal tampil kotak polos (bukan ikon gambar rusak + teks).
function buildChain(src, videoId) {
  const list = [];
  if (src) list.push(src);
  const vid = videoId ? String(videoId) : '';
  if (vid.length === 11) {
    list.push(
      `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
      `https://i.ytimg.com/vi/${vid}/default.jpg`
    );
  }
  return [...new Set(list)];
}

export default function CoverImg({ src, videoId, alt = '', className = '', style, ...rest }) {
  const chain = buildChain(src, videoId);
  const key = chain.join('|');
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
  }, [key]);

  if (i >= chain.length) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={className}
        style={{ ...style, background: 'linear-gradient(135deg, #2a2a35, #14141b)' }}
      />
    );
  }

  return (
    <img
      {...rest}
      src={chain[i]}
      alt={alt}
      className={className}
      style={style}
      referrerPolicy="no-referrer"
      onError={() => setI((n) => n + 1)}
    />
  );
}
