// Factual metadata from an artist interview. Providers return this same result shape.
const catalog = [
  {
    title: 'Never Meant', artist: 'American Football', tuningId: 'facgce',
    source: 'https://lifeoftherecord.com/american-football-notes',
  },
  {
    title: 'For Sure', artist: 'American Football', tuningId: 'facgce',
    source: 'https://lifeoftherecord.com/american-football-notes',
  },
];
const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function searchSongs(query, provider = catalog) {
  const words = normalize(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return [];
  return provider.filter(song => {
    const searchable = normalize(song.title + ' ' + song.artist);
    return words.every(word => searchable.includes(word));
  });
}
