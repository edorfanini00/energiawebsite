import { contactUrl } from './attribution.js';

// Enhance native links in place; modified clicks, keyboard and no-JS navigation
// retain their normal behavior. Only a direct page → contact hop is recorded.
for (const link of document.querySelectorAll('a[data-contact-source]')) {
  link.setAttribute('href', contactUrl(location.pathname, location.search));
}
