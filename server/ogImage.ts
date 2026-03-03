/**
 * OG Image Generator
 * Generates 1200×630 PNG images for social sharing using sharp + SVG
 * Design: Dark gradient background, orange lightning bolt, topic title, SoWork.ai branding
 */

import sharp from 'sharp';

interface OgImageOptions {
  title: string;
  category?: string | null;
  articleCount?: number;
  mediaCount?: number;
}

/** Escape XML special characters for safe SVG embedding */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Wrap text into multiple lines based on max chars per line */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      break;
    }
    // Try to break at a space or punctuation
    let breakAt = maxCharsPerLine;
    const slice = remaining.slice(0, maxCharsPerLine + 1);
    const spaceIdx = slice.lastIndexOf(' ');
    const punctIdx = Math.max(
      slice.lastIndexOf('，'),
      slice.lastIndexOf('。'),
      slice.lastIndexOf('、'),
      slice.lastIndexOf('：'),
    );
    if (punctIdx > maxCharsPerLine * 0.5) breakAt = punctIdx + 1;
    else if (spaceIdx > maxCharsPerLine * 0.5) breakAt = spaceIdx + 1;

    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trim();
    if (lines.length >= 3) {
      // Max 3 lines, truncate with ellipsis
      if (remaining.length > 0) {
        lines[2] = lines[2].slice(0, maxCharsPerLine - 1) + '…';
      }
      break;
    }
  }
  return lines;
}

export async function generateOgImage(options: OgImageOptions): Promise<Buffer> {
  const { title, category, articleCount = 0, mediaCount = 0 } = options;

  const W = 1200;
  const H = 630;

  // Wrap title text (Chinese chars ~18 per line at large font)
  const titleLines = wrapText(title, 18);
  const titleFontSize = titleLines.length === 1 ? 72 : titleLines.length === 2 ? 62 : 52;
  const titleLineHeight = titleFontSize * 1.35;
  const titleStartY = 220 - (titleLines.length - 1) * titleLineHeight * 0.5;

  const titleSvgLines = titleLines
    .map((line, i) =>
      `<text x="120" y="${titleStartY + i * titleLineHeight}" font-size="${titleFontSize}" font-weight="800" fill="white" font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif" letter-spacing="-1">${escapeXml(line)}</text>`
    )
    .join('\n');

  const categoryBadge = category
    ? `<rect x="120" y="130" width="${category.length * 22 + 32}" height="38" rx="8" fill="#FF5A1F" opacity="0.9"/>
       <text x="136" y="155" font-size="20" font-weight="700" fill="white" font-family="'Noto Sans TC', sans-serif">${escapeXml(category)}</text>`
    : '';

  const statsY = titleStartY + titleLines.length * titleLineHeight + 40;
  const statsSection = (articleCount > 0 || mediaCount > 0)
    ? `<text x="120" y="${statsY}" font-size="26" fill="rgba(255,255,255,0.7)" font-family="'Sora', 'Noto Sans TC', sans-serif">
         ${articleCount > 0 ? `${articleCount} 篇報導` : ''}${articleCount > 0 && mediaCount > 0 ? '  ·  ' : ''}${mediaCount > 0 ? `${mediaCount} 家媒體` : ''}
       </text>`
    : '';

  // SoWork.ai lightning bolt SVG path (simplified)
  // The bolt is drawn as a polygon shape
  const boltPath = 'M 55 0 L 20 45 L 42 45 L 18 90 L 72 35 L 48 35 Z';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Dark gradient background -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0F0F0F;stop-opacity:1" />
      <stop offset="60%" style="stop-color:#1A1A1A;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2A1A0A;stop-opacity:1" />
    </linearGradient>
    <!-- Orange glow -->
    <radialGradient id="glow" cx="85%" cy="50%" r="40%">
      <stop offset="0%" style="stop-color:#FF5A1F;stop-opacity:0.25" />
      <stop offset="100%" style="stop-color:#FF5A1F;stop-opacity:0" />
    </radialGradient>
    <!-- Bolt gradient -->
    <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF7A3F" />
      <stop offset="100%" style="stop-color:#E04010" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Decorative grid lines (subtle) -->
  <line x1="0" y1="1" x2="${W}" y2="1" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="0" y1="${H - 1}" x2="${W}" y2="${H - 1}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>

  <!-- Large decorative bolt (right side, semi-transparent) -->
  <g transform="translate(870, 140) scale(4.2)" opacity="0.12">
    <path d="${boltPath}" fill="#FF5A1F"/>
  </g>

  <!-- Small bolt logo (top-left branding) -->
  <g transform="translate(120, 52) scale(0.55)">
    <path d="${boltPath}" fill="url(#boltGrad)"/>
  </g>

  <!-- "時事軸" product name -->
  <text x="175" y="88" font-size="28" font-weight="700" fill="white" font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif" opacity="0.95">時事軸</text>
  <text x="265" y="88" font-size="22" font-weight="400" fill="rgba(255,255,255,0.5)" font-family="'Sora', sans-serif">by SoWork.ai</text>

  <!-- Divider line -->
  <line x1="120" y1="108" x2="${W - 120}" y2="108" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- Category badge -->
  ${categoryBadge}

  <!-- Topic title -->
  ${titleSvgLines}

  <!-- Stats -->
  ${statsSection}

  <!-- Bottom bar -->
  <rect x="0" y="${H - 60}" width="${W}" height="60" fill="rgba(255,90,31,0.12)"/>
  <line x1="0" y1="${H - 60}" x2="${W}" y2="${H - 60}" stroke="rgba(255,90,31,0.3)" stroke-width="1"/>
  <text x="120" y="${H - 22}" font-size="22" fill="rgba(255,255,255,0.6)" font-family="'Sora', 'Noto Sans TC', sans-serif">newsflow.sowork.ai</text>
  <text x="${W - 120}" y="${H - 22}" font-size="22" fill="rgba(255,90,31,0.8)" font-family="'Sora', sans-serif" text-anchor="end">時事軸 — 看見新聞的演變脈絡</text>
</svg>`;

  const buffer = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 6 })
    .toBuffer();

  return buffer;
}
