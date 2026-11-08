// The only files the site serves. Shared by the local server and the Vercel
// build, so tooling, tests, docs and server code can never be published.
export const publicFile = /^\/(index\.html|privacy\.html|about\.html|hvac-optimization(?:-pilot|-companies|-evidence)?\.html|admin\.html|styles\.css|admin\.css|boot\.js|main\.js|attribution\.js|contact-links\.js|pixel\.js|admin\.js|robots\.txt|sitemap\.xml|assets\/[\w./-]+)$/;

// Clean URLs, as vercel.json's cleanUrls serves them.
export const cleanUrls = { "/": "/index.html", "/privacy": "/privacy.html", "/hvac-optimization": "/hvac-optimization.html", "/hvac-optimization-pilot": "/hvac-optimization-pilot.html", "/hvac-optimization-companies": "/hvac-optimization-companies.html", "/about": "/about.html", "/hvac-optimization-evidence": "/hvac-optimization-evidence.html", "/admin": "/admin.html" };
