import { BLOG_DESCRIPTION, BLOG_TITLE, BLOG_URL, SITE_URL, blogAbsoluteUrl } from './site'
import { getBlogAuthor } from './authors'
import { getBlogCategory } from './taxonomy'
import type { BlogAuthor, BlogFaqItem, BlogPost } from './types'

type BreadcrumbItem = {
  name: string
  url: string
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DCC Music',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logopng.png`,
      width: 1200,
      height: 630,
    },
    description:
      'Plataforma brasileira para criar músicas com inteligência artificial, gerar partitura e cifra, distribuir obras e divulgar o trabalho de compositores.',
    email: 'suporte@dccmusic.online',
    sameAs: [
      'https://www.instagram.com/dccmusic.online/',
      'https://www.youtube.com/@dcalaca',
      'https://www.facebook.com/profile.php?id=61571000874301',
    ],
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BLOG_TITLE,
    url: BLOG_URL,
    description: BLOG_DESCRIPTION,
    inLanguage: 'pt-BR',
    publisher: {
      '@type': 'Organization',
      name: 'DCC Music',
      url: SITE_URL,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BLOG_URL}/busca?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function personSchema(author: BlogAuthor) {
  return {
    '@type': 'Person',
    name: author.name,
    url: blogAbsoluteUrl(`/autor/${author.slug}`),
    jobTitle: author.role,
    description: author.bio,
    image: author.image.startsWith('http') ? author.image : `${SITE_URL}${author.image}`,
    worksFor: {
      '@type': 'Organization',
      name: 'DCC Music',
      url: SITE_URL,
    },
    ...(author.sameAs?.length ? { sameAs: author.sameAs } : {}),
  }
}

export function articleJsonLd(post: BlogPost) {
  const author = getBlogAuthor(post.author)
  const category = getBlogCategory(post.category)
  const imageUrl = post.featuredImage.startsWith('http')
    ? post.featuredImage
    : `${SITE_URL}${post.featuredImage}`
  const url = post.canonical || blogAbsoluteUrl(`/${post.slug}`)

  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription || post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    inLanguage: 'pt-BR',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    image: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: post.imageWidth,
      height: post.imageHeight,
      caption: post.imageAlt,
    },
    author: personSchema(author),
    publisher: {
      '@type': 'Organization',
      name: 'DCC Music',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logopng.png`,
        width: 1200,
        height: 630,
      },
    },
    url,
    wordCount: undefined,
    articleSection: category?.title || post.category,
    keywords: post.tags.join(', '),
    isAccessibleForFree: true,
  }

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: post.seoTitle || post.title,
    description: post.seoDescription || post.description,
    url,
    inLanguage: 'pt-BR',
    isPartOf: {
      '@type': 'WebSite',
      name: BLOG_TITLE,
      url: BLOG_URL,
    },
  }

  const schemas: object[] = [blogPosting, webPage]

  if (post.faq.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq.map((item: BlogFaqItem) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    })
  }

  return schemas
}
