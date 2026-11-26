export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const audioUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Spidefy-Audio';

  if (!audioUrl) {
    return new Response('URL tidak ditemukan', { status: 400 });
  }

  try {
    const response = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return new Response('Gagal mengambil audio', { status: response.status });
    }

    // Bersihkan nama file agar aman disimpan di Android
    const safeFilename = title.replace(/[^a-zA-Z0-9 \-_]/g, '').trim() + '.m4a';

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response('Server error: ' + error.message, { status: 500 });
  }
}
