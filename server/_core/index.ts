import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduler } from "../scheduler";
import { generateOgImage } from "../ogImage";
import { getTopicBySlug } from "../db";

// In-memory cache for OG images: slug -> { buffer, expiresAt }
const ogImageCache = new Map<string, { buffer: Buffer; expiresAt: number }>();
const OG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // OG Image endpoint — dynamically generate social preview images per topic
  // Supports ?comment=xxx&author=xxx for personalized sharing
  app.get('/api/og/:slug', async (req, res) => {
    try {
      const { slug } = req.params;

      // Check in-memory cache first
      const cached = ogImageCache.get(slug);
      if (cached && cached.expiresAt > Date.now()) {
        res.set({
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'Content-Length': cached.buffer.length,
          'X-Cache': 'HIT',
        });
        res.send(cached.buffer);
        return;
      }

      const topic = await getTopicBySlug(slug);
      if (!topic) {
        res.status(404).send('Topic not found');
        return;
      }
      const comment = typeof req.query.comment === 'string' ? req.query.comment.slice(0, 120) : undefined;
      const author = typeof req.query.author === 'string' ? req.query.author.slice(0, 30) : undefined;

      const imageBuffer = await generateOgImage({
        title: topic.query,
        category: topic.category,
        articleCount: topic.totalArticles ?? 0,
        mediaCount: topic.totalMedia ?? 0,
        comment: comment || null,
        authorName: author || null,
      });

      // Only cache images without personalized comments
      if (!comment) {
        ogImageCache.set(slug, { buffer: imageBuffer, expiresAt: Date.now() + OG_CACHE_TTL_MS });
      }
      // Evict stale entries if cache grows too large (max 200 entries)
      if (ogImageCache.size > 200) {
        const now = Date.now();
        Array.from(ogImageCache.entries()).forEach(([key, val]) => {
          if (val.expiresAt <= now) ogImageCache.delete(key);
        });
      }

      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Length': imageBuffer.length,
        'X-Cache': 'MISS',
      });
      res.send(imageBuffer);
    } catch (err) {
      console.error('[OG Image] Error generating image:', err);
      res.status(500).send('Failed to generate OG image');
    }
  });

  // SSR meta tag injection for social crawlers (Facebook, Twitter, LINE, etc.)
  // Intercepts /timeline/:slug requests from bots and injects correct OG meta tags
  app.get('/timeline/:slug', async (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const isCrawler = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|LINE|Pinterest|Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|Applebot|vkShare|W3C_Validator|ia_archiver/i.test(ua);

    if (!isCrawler) {
      next();
      return;
    }

    try {
      const { slug } = req.params;
      const comment = typeof req.query.comment === 'string' ? req.query.comment.slice(0, 200) : '';
      const author = typeof req.query.author === 'string' ? req.query.author.slice(0, 30) : '';

      const topic = await getTopicBySlug(slug);
      if (!topic) {
        next();
        return;
      }

      const canonicalBase = 'https://newsflow.sowork.ai';
      const pageUrl = `${canonicalBase}/timeline/${encodeURIComponent(slug)}`;
      const shareUrl = comment
        ? `${pageUrl}?comment=${encodeURIComponent(comment)}${author ? `&author=${encodeURIComponent(author)}` : ''}`
        : pageUrl;

      const ogTitle = comment
        ? `${author ? `${author}：` : ''}「${comment.slice(0, 50)}${comment.length > 50 ? '…' : ''}」— ${topic.query} | 時事軸`
        : `${topic.query} — 時事軸 by SoWork.ai`;

      const ogDesc = comment
        ? `${comment}\n\n追蹤「${topic.query}」的完整新聞演變脈絡。共 ${topic.totalArticles} 篇報導、${topic.totalMedia} 家媒體。`
        : `追蹤「${topic.query}」的完整新聞演變脈絡。共 ${topic.totalArticles} 篇報導、${topic.totalMedia} 家媒體，AI 偵測重大轉折點，即時更新。`;

      const ogImageParams = comment
        ? `?comment=${encodeURIComponent(comment.slice(0, 120))}${author ? `&author=${encodeURIComponent(author)}` : ''}`
        : '';
      const ogImage = `${canonicalBase}/api/og/${encodeURIComponent(slug)}${ogImageParams}`;

      const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${ogTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <meta name="description" content="${ogDesc.replace(/"/g, '&quot;').replace(/\n/g, ' ')}" />
  <link rel="canonical" href="${shareUrl}" />
  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="時事軸 by SoWork.ai" />
  <meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
  <meta property="og:description" content="${ogDesc.replace(/"/g, '&quot;').replace(/\n/g, ' ')}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="zh_TW" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
  <meta name="twitter:description" content="${ogDesc.replace(/"/g, '&quot;').replace(/\n/g, ' ')}" />
  <meta name="twitter:image" content="${ogImage}" />
  <!-- Redirect to SPA after crawlers read meta -->
  <meta http-equiv="refresh" content="0;url=${shareUrl}" />
  <script>window.location.href = '${shareUrl.replace(/'/g, "\\'")}';</script>
</head>
<body>
  <p>正在跳轉到 <a href="${shareUrl}">${ogTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>...</p>
</body>
</html>`;

      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': comment ? 'no-cache' : 'public, max-age=300',
      });
      res.send(html);
    } catch (err) {
      console.error('[SSR Meta] Error:', err);
      next();
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // 啟動每日自動更新排程
    startScheduler();
  });
}

startServer().catch(console.error);
