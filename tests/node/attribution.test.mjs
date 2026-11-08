import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSourcePath, readUtm } from '../../server/fields.js';

test('source provenance accepts only explicit public canonical paths', () => {
  for (const path of ['/', '/privacy', '/hvac-optimization', '/hvac-optimization-pilot', '/hvac-optimization-companies', '/about', '/hvac-optimization-evidence']) assert.equal(readSourcePath(path), path);
  for (const path of ['//evil.example', '/admin', '/not-a-page', '/hvac-optimization/../about', '/about?email=secret', '/about#secret', '/%2f%2fevil.example', '/\\evil.example', 'https://evil.example', ['/about'], null, '/' + 'a'.repeat(201)]) assert.equal(readSourcePath(path), '/', JSON.stringify(path));
});
test('ambiguous or oversized campaign values are dropped, never truncated into valid attribution', () => {
  assert.deepEqual(readUtm('?utm_source=one&utm_source=two&utm_campaign=valid'), { utm_campaign: 'valid' });
  assert.deepEqual(readUtm('?utm_source=&utm_source=second'), {});
  assert.deepEqual(readUtm('?utm_source=' + 'a'.repeat(101)), {});
  assert.deepEqual(readUtm('?utm_source=valid&ignored=' + 'x'.repeat(2000)), {});
  assert.deepEqual(readUtm('?utm_source=valid&utm_medium=organic&email=private&_vercel_share=secret'), { utm_source: 'valid', utm_medium: 'organic' });
});

import { readAttribution, contactUrl } from '../../attribution.js';
test('home consumes a single approved source; links use their own page and only current tags', () => {
  assert.deepEqual(readAttribution('/', '?source_path=%2Fabout&utm_source=search&email=secret'), { sourcePath: '/about', utm: 'utm_source=search' });
  for (const search of ['?source_path=//evil.example', '?source_path=/about&source_path=/privacy', '?source_path=/about&x=' + 'x'.repeat(2000)]) assert.equal(readAttribution('/', search).sourcePath, '/');
  assert.equal(contactUrl('/hvac-optimization-pilot', '?source_path=/about&utm_source=search&x=secret'), '/?source_path=%2Fhvac-optimization-pilot&utm_source=search#contact');
  assert.equal(contactUrl('/about/', ''), '/?source_path=%2Fabout#contact');
  assert.equal(contactUrl('/about.html', ''), '/?source_path=%2Fabout#contact');
  assert.equal(contactUrl('/about', '?utm_source=one&utm_source=two'), '/?source_path=%2Fabout#contact');
});
