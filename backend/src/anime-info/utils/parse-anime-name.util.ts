/**
 * Strip fansub group tags, quality tags, and episode numbers from a
 * typical anime torrent filename to produce a clean search query.
 *
 * e.g. "[HorribleSubs] Demon Slayer - 01 [1080p].mkv" -> "Demon Slayer"
 */
export function parseAnimeName(filename: string): string {
  let name = filename.replace(/\.[^.]+$/, ''); // drop file extension
  name = name.replace(/^\[.*?\]\s*/, ''); // drop leading [Group]
  name = name.replace(/\s*[\[(][^\])]+[\])]/g, ''); // drop remaining [tags] / (tags)
  name = name.replace(/[-_\s]+(?:S\d+E\d+|\d{2,3}v?\d?).*$/i, ''); // drop episode numbers
  name = name.replace(/\bEpisodes?\s*\d+.*/i, '');
  name = name.replace(/[._]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return name;
}
