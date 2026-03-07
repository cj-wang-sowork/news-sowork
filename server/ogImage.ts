/**
 * OG Image Generator (v2 — Satori-based)
 * Generates 1200×630 PNG images for social sharing using Satori + @resvg/resvg-js
 * Supports embedded Chinese fonts (Noto Sans TC) via CDN, no system font dependency.
 * Design: Dark gradient background, orange accent, topic title, CTA text, SoWork.ai branding
 *
 * NOTE: Satori requires ALL multi-child divs to have display: flex.
 */

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import https from 'https';

// ─── Font CDN URLs ────────────────────────────────────────────────────────────
const FONT_CDN = {
  regular: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/NotoSansTC-Regular_ed095abc.ttf',
  bold: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/NotoSansTC-Bold_0c677029.ttf',
  black: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/NotoSansTC-Black_969d9301.ttf',
};

// ─── In-process font cache ────────────────────────────────────────────────────
let fontCache: { regular: Buffer; bold: Buffer; black: Buffer } | null = null;

function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getFonts() {
  if (fontCache) return fontCache;
  console.log('[OG Image] Downloading fonts from CDN...');
  const [regular, bold, black] = await Promise.all([
    downloadBuffer(FONT_CDN.regular),
    downloadBuffer(FONT_CDN.bold),
    downloadBuffer(FONT_CDN.black),
  ]);
  fontCache = { regular, bold, black };
  console.log('[OG Image] Fonts cached successfully');
  return fontCache;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OgImageOptions {
  title: string;
  category?: string | null;
  articleCount?: number;
  mediaCount?: number;
  comment?: string | null;
  authorName?: string | null;
}

// ─── Helper: create a simple text node ───────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function text(content: string, style: Record<string, unknown>): any {
  return {
    type: 'div',
    props: { style: { display: 'flex', ...style }, children: content }
  };
}

// ─── Main generator ───────────────────────────────────────────────────────────
export async function generateOgImage(options: OgImageOptions): Promise<Buffer> {
  const { title, category, articleCount = 0, mediaCount = 0, comment, authorName } = options;

  const fonts = await getFonts();

  const displayTitle = title.length > 22 ? title.slice(0, 21) + '…' : title;
  const titleFontSize = displayTitle.length <= 8 ? 80 : displayTitle.length <= 14 ? 68 : displayTitle.length <= 18 ? 60 : 52;

  const statsText = [
    articleCount > 0 ? `${articleCount} 篇報導` : '',
    mediaCount > 0 ? `${mediaCount} 家媒體` : '',
  ].filter(Boolean).join('  ·  ');

  const displayComment = comment
    ? (comment.length > 55 ? comment.slice(0, 53) + '…' : comment)
    : null;

  // ─── Build element tree ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root: any = {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0F0F0F 0%, #1A1A1A 55%, #2A1508 100%)',
        fontFamily: 'Noto Sans TC',
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        // ── Top brand bar ──
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '28px 60px 0',
              gap: '10px',
            },
            children: [
              // Brand icon
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '34px',
                    height: '34px',
                    background: '#FF5A1F',
                    borderRadius: '8px',
                    fontSize: '18px',
                    color: 'white',
                    fontWeight: 900,
                  },
                  children: '⚡'
                }
              },
              text('時事軸', { fontSize: '22px', fontWeight: 700, color: 'white' }),
              text('by SoWork.ai', { fontSize: '17px', color: 'rgba(255,255,255,0.4)' }),
              // Spacer
              { type: 'div', props: { style: { display: 'flex', flex: 1 }, children: [] } },
              // Category badge
              ...(category ? [{
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    background: 'rgba(255,90,31,0.18)',
                    border: '1px solid rgba(255,90,31,0.4)',
                    borderRadius: '6px',
                    padding: '4px 14px',
                    fontSize: '15px',
                    color: '#FF8050',
                    fontWeight: 700,
                  },
                  children: category
                }
              }] : []),
            ]
          }
        },
        // ── Divider ──
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              margin: '18px 60px 0',
              height: '1px',
              background: 'rgba(255,255,255,0.07)',
            },
            children: []
          }
        },
        // ── Main content (flex: 1) ──
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '32px 60px 0',
              gap: '0',
            },
            children: [
              // Title
              text(displayTitle, {
                fontSize: `${titleFontSize}px`,
                fontWeight: 900,
                color: 'white',
                lineHeight: 1.25,
                letterSpacing: '-1px',
                marginBottom: '18px',
              }),
              // Stats
              ...(statsText ? [text(statsText, {
                fontSize: '24px',
                color: 'rgba(255,255,255,0.5)',
                fontWeight: 400,
                marginBottom: displayComment ? '22px' : '28px',
              })] : []),
              // Comment box
              ...(displayComment ? [{
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(255,90,31,0.1)',
                    border: '1px solid rgba(255,90,31,0.3)',
                    borderLeft: '4px solid #FF5A1F',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    marginBottom: '22px',
                    gap: '6px',
                  },
                  children: [
                    ...(authorName ? [text(`${authorName} 的觀點`, {
                      fontSize: '15px',
                      color: '#FF8050',
                      fontWeight: 700,
                    })] : []),
                    text(`「${displayComment}」`, {
                      fontSize: '20px',
                      color: 'rgba(255,255,255,0.82)',
                      fontWeight: 400,
                      fontStyle: 'italic',
                    }),
                  ]
                }
              }] : []),
              // CTA
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '8px',
                  },
                  children: [
                    text('追蹤完整新聞脈絡', {
                      fontSize: '20px',
                      color: '#FF7A3F',
                      fontWeight: 700,
                    }),
                    text('→', {
                      fontSize: '20px',
                      color: '#FF7A3F',
                      fontWeight: 700,
                    }),
                  ]
                }
              },
            ]
          }
        },
        // ── Bottom bar ──
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '56px',
              background: 'rgba(255,90,31,0.09)',
              borderTop: '1px solid rgba(255,90,31,0.22)',
              padding: '0 60px',
            },
            children: [
              text('newsflow.sowork.ai', {
                fontSize: '17px',
                color: 'rgba(255,255,255,0.38)',
              }),
              text('看見新聞的演變脈絡', {
                fontSize: '17px',
                color: 'rgba(255,90,31,0.65)',
                fontWeight: 700,
              }),
            ]
          }
        },
      ]
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(root as any, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Noto Sans TC', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Noto Sans TC', data: fonts.bold, weight: 700, style: 'normal' },
      { name: 'Noto Sans TC', data: fonts.black, weight: 900, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
