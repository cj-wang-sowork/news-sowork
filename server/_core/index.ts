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
import { getDb, getTopicBySlug } from "../db";

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
  app.get('/api/og/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const topic = await getTopicBySlug(slug);
      if (!topic) {
        res.status(404).send('Topic not found');
        return;
      }
      const imageBuffer = await generateOgImage({
        title: topic.query,
        category: topic.category,
        articleCount: topic.totalArticles ?? 0,
        mediaCount: topic.totalMedia ?? 0,
      });
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Length': imageBuffer.length,
      });
      res.send(imageBuffer);
    } catch (err) {
      console.error('[OG Image] Error generating image:', err);
      res.status(500).send('Failed to generate OG image');
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
