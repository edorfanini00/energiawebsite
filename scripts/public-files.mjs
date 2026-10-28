// The only files the site serves. Shared by the local server and the Vercel
// build, so tooling, tests, docs and server code can never be published.
export const publicFile = /^\/(index\.html|privacy\.html|admin\.html|styles\.css|admin\.css|boot\.js|main\.js|pixel\.js|admin\.js|robots\.txt|sitemap\.xml|assets\/[\w./-]+)$/;

// Clean URLs, as vercel.json's cleanUrls serves them.
export const cleanUrls = { "/": "/index.html", "/privacy": "/privacy.html", "/admin": "/admin.html" };
