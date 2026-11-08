import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cleanUrls } from "../../scripts/public-files.mjs";
import { validateJsonLd } from "../../scripts/validate-jsonld.mjs";

const root = new URL("../../", import.meta.url);
const site = "https://predictivehvaccontrol.com";
const companyLinkedIn = "https://www.linkedin.com/company/energia-ai/";
const founderLinkedIn = "https://www.linkedin.com/in/edoardo-orfanini/";
const organizationId = site + "/#organization";
const founderId = site + "/about#founder";
const pages = Object.entries(cleanUrls).filter(([path]) => path !== "/admin");

function objects(value) {
  if (!value || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(objects)];
}

for (const [path, file] of pages) {
  test(`${path}: one consistent organization and verified founder, exact identity links`, async () => {
    const html = await readFile(new URL(file.slice(1), root), "utf8");
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(blocks.length, 1);
    const data = JSON.parse(blocks[0][1]);
    assert.equal(data["@context"], "https://schema.org");
    const [organization, website, page] = data["@graph"];
    assert.equal(data["@graph"].length, 3);
    assert.deepEqual(organization, {
      "@type": "Organization", "@id": organizationId,
      name: "Energia AI", url: site + "/",
      description: "AI control platform for commercial HVAC",
      sameAs: [companyLinkedIn],
      founder: {
        "@type": "Person", "@id": founderId,
        name: "Edoardo Orfanini", sameAs: [founderLinkedIn],
      },
    });
    assert.deepEqual(website, {
      "@type": "WebSite", "@id": site + "/#website",
      name: "Energia AI", url: site + "/", publisher: { "@id": organizationId },
    });
    assert.equal(page["@id"], site + path + "#webpage");
    assert.equal(page.url, site + path);
    assert.match(page.name, /Energia AI/);
    assert.deepEqual(page.isPartOf, { "@id": website["@id"] });
    if (path === "/hvac-optimization-evidence") {
      assert.equal(page["@type"], "Article");
      assert.deepEqual(page.publisher, { "@id": organizationId });
      assert.deepEqual(page.about, { "@type": "Thing", name: "Commercial building HVAC performance evidence" });
    } else {
      assert.equal(page["@type"], path === "/about" ? "AboutPage" : "WebPage");
      assert.deepEqual(page.about, { "@id": organizationId });
    }
    const nodes = objects(data);
    assert.equal(nodes.filter(node => node["@type"] === "Organization").length, 1);
    assert.equal(nodes.filter(node => node["@type"] === "Person").length, 1);
    const definitions = nodes.filter(node => node["@id"] && Object.keys(node).length > 1);
    assert.equal(new Set(definitions.map(node => node["@id"])).size, definitions.length);
    assert.deepEqual(nodes.flatMap(node => node.sameAs ?? []), [companyLinkedIn, founderLinkedIn]);
    for (const node of nodes) {
      for (const key of ["alternateName", "legalName", "address", "hasCredential", "award", "author", "reviewedBy"]) {
        assert.ok(!(key in node), `unverified property: ${key}`);
      }
      if (node["@id"]) assert.ok(definitions.some(definition => definition["@id"] === node["@id"]), `unresolved identity: ${node["@id"]}`);
    }
  });
}

test("seven public pages retain valid CSP hashes and visibly supported identity links", async () => {
  assert.equal(pages.length, 7);
  const about = await readFile(new URL("about.html", root), "utf8");
  assert.ok(about.includes('<h2 id="founder" tabindex="-1">Founder</h2>'));
  assert.ok(about.includes("<p>Edoardo Orfanini, founder.</p>"));
  assert.ok(about.includes(`<a href="${founderLinkedIn}">Edoardo Orfanini on LinkedIn</a>`));
  assert.ok(about.includes(`<a href="${companyLinkedIn}">Energia AI on LinkedIn</a>`));
  await validateJsonLd(root.pathname, JSON.parse(await readFile(new URL("vercel.json", root), "utf8")));
});
