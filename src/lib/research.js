// Ground research from Wikipedia. Only shows information when a matching
// cricket-related article is found, always with a link to the source.
import { getJson } from './net.js';

export async function researchGround(groundName, location) {
  const fetchedAt = Date.now();
  if (!groundName?.trim()) return { status: 'missing', fetchedAt, message: 'Enter the ground name first.' };
  const q = `${groundName} ${location || ''} cricket`.trim();
  const search = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5&format=json&origin=*`
  );
  const hits = search?.query?.search || [];
  const nameWords = groundName.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !['the', 'oval', 'park', 'ground', 'field'].includes(w));
  for (const hit of hits) {
    const title = hit.title.toLowerCase();
    const matchesName = nameWords.length === 0 ? title.includes(groundName.toLowerCase()) : nameWords.some((w) => title.includes(w));
    if (!matchesName) continue;
    const summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`);
    const extract = summary?.extract || '';
    if (!/cricket/i.test(extract) && !/cricket/i.test(hit.snippet || '')) continue;
    return {
      status: 'ok',
      fetchedAt,
      query: q,
      title: summary.title,
      description: summary.description || '',
      extract,
      url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
      source: 'Wikipedia',
    };
  }
  return {
    status: 'not-found',
    fetchedAt,
    query: q,
    message:
      'No reliable published information was found for this ground. This is normal for club and local grounds — record what you know in the fields below.',
  };
}
