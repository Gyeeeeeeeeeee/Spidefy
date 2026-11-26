export function downloadToPhoneStorage(rawStreamUrl, songTitle) {
  const downloadUrl = `/api/download?url=${encodeURIComponent(rawStreamUrl)}&title=${encodeURIComponent(songTitle)}`;
  
  // Memicu download manager bawaan HP Android
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', `${songTitle}.m4a`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
