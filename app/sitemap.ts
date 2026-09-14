import type { MetadataRoute } from "next";
import { GUIDES } from "./(marketing)/guides/guides";

const SITE_URL = "https://www.surgetechpos.com";

// Public marketing pages on the canonical www host. /login is excluded (noindex +
// robots disallow); app/API routes are not public pages. Guides are pulled from
// the shared GUIDES list so this stays in sync automatically.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: SITE_URL + "/", lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    // PRIORITY IS THIS SITE'S OWN RANKING OF ITSELF, and it reads POS-first:
    // /pos and the two industry pages at the top, the five competitor pages
    // demoted to 0.6.
    //
    // THE THREE LOCATION PAGES ARE GONE FROM THIS LIST, and that is not the
    // same as demoting them. /payment-processing-toronto,
    // /payment-processing-mississauga and /merchant-services-durham are now
    // permanent (308) redirects to /pos — see next.config.ts for the full
    // reasoning. A sitemap is a list of URLs you want indexed AS THEY ARE, and
    // a URL that answers with a redirect is not one of those: listing it asks
    // a crawler to fetch a hop and then tells it the page moved. The redirect
    // is what preserves their equity; keeping them here would only muddy it.
    { url: SITE_URL + "/pos", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE_URL + "/pos-for-restaurants", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: SITE_URL + "/pos-for-retail", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    // 0.8 -> 0.9, monthly -> weekly. /pricing is no longer a price list; it is
    // the pilot offer and the page that carries the sign-up form, which makes it
    // the site's primary conversion page and puts it level with /pos and the two
    // industry pages. Weekly because a live offer changes more often than a
    // feature page does — and when the pilot ends this page changes first.
    { url: SITE_URL + "/pricing", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    // The Sri Lanka pilot page. Indexable and listed on purpose: it is a
    // recruitment page for a named audience and the whole point is that someone
    // searching for a POS in Sri Lanka can find it and read the gaps before
    // they talk to us. Weekly and 0.8 — one rung under /pricing, which is still
    // the site's general pilot page, because this one serves a narrower
    // audience. It is NOT a location landing page: the three of those that used
    // to be in this list are 308s now, and this page carries no service area,
    // no address and no offer (see the notes in its own file).
    { url: SITE_URL + "/pilot/sri-lanka", lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: SITE_URL + "/moneris-alternative", lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: SITE_URL + "/square-alternative", lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: SITE_URL + "/clover-alternative", lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: SITE_URL + "/stripe-alternative", lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: SITE_URL + "/td-merchant-solutions-alternative", lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: SITE_URL + "/contact", lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: SITE_URL + "/book", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: SITE_URL + "/guides", lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
  const guides: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: SITE_URL + "/guides/" + g.slug,
    lastModified: new Date(g.datePublished),
    changeFrequency: "yearly",
    priority: 0.5,
  }));
  return [...core, ...guides];
}
