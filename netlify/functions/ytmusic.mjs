import YTMusic from 'ytmusic-api';

let ytm = null;
const headers = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
};
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

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    if (!ytm) {
      ytm = new YTMusic();
      await ytm.initialize();
    }
    const params = new URL(req.url).searchParams;
    const sg = (params.get('suggest') || '').trim();
    if (sg) {
      const suggestions = await ytm.getSearchSuggestions(sg);
      return new Response(JSON.stringify({ suggestions }), { headers });
    }
    const q = (params.get('q') || '').trim() || 'lagu terbaru 2026';
    const [songs, albums, artists, playlists] = await Promise.all([
      ytm.searchSongs(q),
      ytm.searchAlbums(q),
      ytm.searchArtists(q),
      ytm.searchPlaylists(q),
    ]);
    const body = {
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
    };
    return new Response(JSON.stringify(body), {
      headers: { ...headers, 'cache-control': 'public, max-age=300' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'ytmusic failed' }), { status: 500, headers });
  }
};

export const config = { path: '/api/ytmusic' };
