export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return new Response('videoId tidak ditemukan', { status: 400 });
  }

  // Daftar instance publik Piped API untuk mengambil stream audio m4a
  const instances = [
    'https://kavin.rocks',
    'https://private.coffee',
    'https://adminforge.de',
  ];

  for (const base of instances) {
    try {
      const infoRes = await fetch(`${base}/streams/${videoId}`);
      if (!infoRes.ok) continue;
      const data = await infoRes.json();

      // Cari stream audio m4a kualitas standar
      const audioStreams = (data.audioStreams || []).filter((s) =>
        s.mimeType?.includes('audio/mp4')
      );
      const bestAudio = audioStreams.sort((a, b) => a.bitrate - b.bitrate)[0] || data.audioStreams?.[0];

      if (bestAudio && bestAudio.url) {
        const audioRes = await fetch(bestAudio.url);
        if (!audioRes.ok) continue;

        return new Response(audioRes.body, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mp4',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch {
      // Coba instance berikutnya jika gagal
    }
  }

  return new Response('Gagal mengambil audio dari YouTube', { status: 502 });
}
