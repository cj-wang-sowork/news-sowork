import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import https from 'https';

// Download font from CDN
function downloadFont(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });
}

const fontData = await downloadFont('https://d2xsxph8kpxj0f.cloudfront.net/310519663322868588/e62Q4utoyfc8BuJjv96dsP/NotoSansTC-Bold_0c677029.ttf');
console.log('Font downloaded:', fontData.length, 'bytes');

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        background: 'linear-gradient(135deg, #0F0F0F 0%, #1A1A1A 60%, #2A1A0A 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '60px',
        fontFamily: 'Noto Sans TC',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '64px', fontWeight: 700, color: 'white', marginTop: '80px' },
            children: '台積電赴美動態'
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '28px', color: 'rgba(255,255,255,0.6)', marginTop: '20px' },
            children: '535 篇報導 · 149 家媒體'
          }
        }
      ]
    }
  },
  {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Noto Sans TC', data: fontData, weight: 700, style: 'normal' }
    ]
  }
);

const resvg = new Resvg(svg);
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
fs.writeFileSync('/tmp/satori_test.png', pngBuffer);
console.log('PNG generated:', pngBuffer.length, 'bytes');
