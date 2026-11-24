import YTMusic from 'ytmusic-api';

let ytm = null;
const thumb = (t) => (Array.isArray(t) && t.length ? t[t.length - 1].url : undefined);

export default async function handler(req, res) {
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
        cover: thumb(s.thumbnails),
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
