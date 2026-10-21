/**
 * Helpers that emit JSON-LD structured data.
 *
 * The shape uses a single @graph with a WebSite + Person publisher on every
 * page, plus an Article on monster entries. This is the format Google and
 * AI search systems expect.
 */
import { site, social } from '../config/site.ts';

const sameAs = [social.youtube, social.x, social.tiktok, social.instagram, social.facebook].filter(
  (url): url is string => !!url,
);

const personSchema = {
  '@type': 'Person',
  '@id': `${site.url}/#person`,
  name: site.signature,
  url: site.url,
  ...(sameAs.length > 0 && { sameAs }),
};

const websiteSchema = {
  '@type': 'WebSite',
  '@id': `${site.url}/#website`,
  url: site.url,
  name: site.name,
  description: site.description,
  inLanguage: 'en',
  publisher: { '@id': `${site.url}/#person` },
};

export interface ArticleSchemaInput {
  headline: string;
  description: string;
  url: string;
  image: string;
  datePublished?: string;
  dateModified?: string;
}

export function siteGraph(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [personSchema, websiteSchema],
  });
}

export function articleGraph(article: ArticleSchemaInput): string {
  const breadcrumbSchema = {
    '@type': 'BreadcrumbList',
    '@id': `${article.url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.url}/` },
      { '@type': 'ListItem', position: 2, name: 'Entries', item: `${site.url}/entries/` },
      { '@type': 'ListItem', position: 3, name: article.headline, item: article.url },
    ],
  };

  const articleSchema = {
    '@type': 'Article',
    '@id': `${article.url}#article`,
    headline: article.headline,
    description: article.description,
    url: article.url,
    image: article.image,
    author: { '@id': `${site.url}/#person` },
    publisher: { '@id': `${site.url}/#person` },
    isPartOf: { '@id': `${site.url}/#website` },
    breadcrumb: { '@id': `${article.url}#breadcrumb` },
    inLanguage: 'en',
    ...(article.datePublished && { datePublished: article.datePublished }),
    ...(article.dateModified && { dateModified: article.dateModified }),
  };

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [personSchema, websiteSchema, articleSchema, breadcrumbSchema],
  });
}
