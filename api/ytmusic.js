import YTMusic from 'ytmusic-api';

let ytm = null;
// Pilih thumbnail terbesar yang valid; seragamkan ukuran gambar Google (lh3) jadi 544px.
// Kalau tidak ada sama sekali, pakai thumbnail YouTube dari videoId.
const thumb = (t, videoId) => {
  const list = Array.isArray(t) ? t.filter((x) => x && typeof x.url === 'string' && x.url.startsWith('http')) : [];
  list.sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0));
  let url = list.length ? list[0].url : undefined;
  if (url && /googleusercontent\.com|ggpht\.com/.test(url)) url = url.replace(/=w\d+-h\d+/, '=w544-h544');
  if (!url && videoId) url = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return url;
};

export default async function handler(req, res) {
  // Izinkan APK Android (asal localhost) memanggil API ini
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  try {
    if (!ytm) {
      ytm = new YTMusic();
      await ytm.initialize();
    }

    const sg = String(req.query.suggest || '').trim();
    if (sg) {
      const suggestions = await ytm.getSearchSuggestions(sg);
      res.status(200).json({ suggestions });
      return;
    }

    const q = String(req.query.q || '').trim() || 'lagu terbaru 2026';

    // Mode cadangan: cari versi lain dari sebuah lagu (video biasa + lagu) untuk yang diblokir YouTube
    if (req.query.alt) {
      const [songs, videos] = await Promise.all([ytm.searchSongs(q), ytm.searchVideos(q)]);
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      res.status(200).json({
        alternatives: [...videos, ...songs].map((v) => ({
          videoId: v.videoId,
          title: v.name,
          artist: v.artist?.name,
          durationSec: v.duration,
        })),
      });
      return;
    }
    const [songs, albums, artists, playlists] = await Promise.all([
      ytm.searchSongs(q),
      ytm.searchAlbums(q),
      ytm.searchArtists(q),
      ytm.searchPlaylists(q),
    ]);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      songs: songs.map((s) => ({
        videoId: s.videoId,
        title: s.name,
        artist: s.artist?.name,
        album: s.album?.name,
        durationSec: s.duration,
        cover: thumb(s.thumbnails, s.videoId),
      })),
      albums: albums.map((a) => ({
        id: a.albumId,
        title: a.name,
        artist: a.artist?.name,
        year: a.year,
        cover: thumb(a.thumbnails),
      })),
      artists: artists.map((a) => ({
        id: a.artistId,
        name: a.name,
        cover: thumb(a.thumbnails),
      })),
      playlists: playlists.map((p) => ({
        id: p.playlistId,
        title: p.name,
        owner: p.artist?.name,
        cover: thumb(p.thumbnails),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'ytmusic failed' });
  }
}
