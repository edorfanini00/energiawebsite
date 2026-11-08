// Shared client/server normalization. URL provenance is visitor supplied, not
// verified acquisition data. No referrer, cookies or browser storage is read.
export const sourcePaths = ['/', '/privacy', '/hvac-optimization', '/hvac-optimization-pilot', '/hvac-optimization-companies', '/about', '/hvac-optimization-evidence'];
export const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

function parameters(search) {
  // Reject the whole oversized query: truncation could hide a duplicate tag.
  return new URLSearchParams(typeof search === 'string' && search.length <= 2000 ? search : '');
}
export function readSourcePath(value) {
  return typeof value === 'string' && sourcePaths.includes(value) ? value : '/';
}
export function readUtm(search) {
  const params = parameters(search);
  const utm = {};
  for (const key of utmKeys) {
    const values = params.getAll(key);
    if (values.length !== 1 || values[0].length > 100) continue;
    const value = values[0].replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[\t\r\n\u2028\u2029]/g, ' ').trim();
    if (value) utm[key] = value;
  }
  return utm;
}
export function readAttribution(pathname, search) {
  const sources = parameters(search).getAll('source_path');
  return {
    sourcePath: pathname === '/' && sources.length === 1 ? readSourcePath(sources[0]) : readSourcePath(pathname),
    utm: new URLSearchParams(readUtm(search)).toString(),
  };
}
export function contactUrl(pathname, search) {
  // Use the page hosting the contact link, never an inherited source_path.
  const canonical = pathname.replace(/\.html$|\/$/g, '') || '/';
  const params = new URLSearchParams({ source_path: readSourcePath(canonical), ...readUtm(search) });
  return '/?' + params.toString() + '#contact';
}
