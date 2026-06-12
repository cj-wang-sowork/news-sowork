/**
 * Shared Topic Persistence
 *
 * Handles the "discovered clusters → DB topics" step that is identical
 * across all section agents:
 *   1. Match clusters against existing DB topics (avoid duplicate timelines)
 *   2. For each new / stale topic: call buildTopicTimeline()
 *   3. Stamp surface + homepageFeaturedAt on the resulting topic row
 */

import { and, desc, isNotNull, sql } from "drizzle-orm";
import { topics } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { buildTopicTimeline } from "../../aiAnalysis";
import type { FeaturedHeadline } from "./headlineFetcher";
import type { DiscoveredCluster } from "./clusterDiscovery";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SurfaceKey = "global" | "invest" | "brand" | "politics";

export interface PersistenceConfig {
  surface: SurfaceKey;
  /** Max age before a topic is considered stale and rebuilt (default 90 min) */
  staleAfterMs?: number;
  logPrefix?: string;
}

export interface PersistResult {
  created: number;
  refreshed: number;
  skipped: number;
  failed: number;
}

// ─── Dedup against existing DB topics ────────────────────────────────────────

interface MatchedCluster extends DiscoveredCluster {
  existingId?: number;
  recentlyUpdated: boolean;
}

async function matchExistingTopics(
  clusters: DiscoveredCluster[],
  staleAfterMs: number,
  surface: SurfaceKey,
): Promise<MatchedCluster[]> {
  const db = await getDb();
  if (!db) return clusters.map(c => ({ ...c, recentlyUpdated: false }));

  // SURFACE ISOLATION: each agent only matches its own surface's topics.
  // This prevents global agent from stealing invest/brand topics and vice-versa.
  // Politics is always excluded — it has its own dedicated seed+enrich pipeline.
  const surfaceFilter = surface === "global"
    ? sql`IFNULL(${topics.surface}, 'global') = 'global'`
    : sql`${topics.surface} = ${surface}`;

  const existingRows = await db
    .select({ id: topics.id, query: topics.query, lastUpdated: topics.lastUpdated })
    .from(topics)
    .where(and(
      isNotNull(topics.homepageFeaturedAt),
      surfaceFilter,
    ))
    .orderBy(desc(topics.homepageFeaturedAt))
    .limit(200);

  const staleThreshold = new Date(Date.now() - staleAfterMs);

  return clusters.map(cluster => {
    const titleLower = cluster.topicTitle.toLowerCase();
    const words = titleLower.split(/\s+/).filter(w => w.length >= 2);
    const bigrams: string[] = [];
    for (let i = 0; i < titleLower.length - 1; i++) {
      const bi = titleLower.slice(i, i + 2);
      if (/\p{Script=Han}/u.test(bi)) bigrams.push(bi);
    }
    const searchTerms = [...new Set([...words, ...bigrams])];

    const match = existingRows.find(row => {
      const queryLower = row.query.toLowerCase();
      const overlap = searchTerms.filter(t => t.length >= 2 && queryLower.includes(t)).length;
      return overlap >= 2;
    });

    return {
      ...cluster,
      existingId: match?.id,
      recentlyUpdated: match ? match.lastUpdated > staleThreshold : false,
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function persistDiscoveredTopics(
  clusters: DiscoveredCluster[],
  headlines: FeaturedHeadline[],
  config: PersistenceConfig
): Promise<PersistResult> {
  const staleAfterMs = config.staleAfterMs ?? 90 * 60 * 1000;
  const log = config.logPrefix ?? config.surface;

  const matched = await matchExistingTopics(clusters, staleAfterMs, config.surface);
  const matchedCount = matched.filter(m => m.existingId).length;
  const skippedCount = matched.filter(m => m.recentlyUpdated).length;
  console.log(`[${log}] DB match: ${matchedCount} matched, ${matched.length - matchedCount} new, ${skippedCount} recently updated`);

  let created = 0;
  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const cluster of matched) {
    try {
      // Topic updated within stale window → refresh featured timestamp + display title
      if (cluster.recentlyUpdated && cluster.existingId) {
        const db = await getDb();
        if (db) {
          const displayTitle = cluster.topicTitleZh || cluster.topicTitle;
          // Guard: never overwrite a politics topic from a non-politics agent
          await db.execute(
            sql`UPDATE topics
                SET homepageFeaturedAt = NOW(),
                    category = ${cluster.category},
                    surface = ${config.surface},
                    query = ${displayTitle},
                    queryEn = ${cluster.topicTitle}
                WHERE id = ${cluster.existingId} AND IFNULL(surface, 'global') != 'politics' LIMIT 1`
          );
        }
        console.log(`[${log}] Skipped rebuild (recently updated): "${cluster.topicTitleZh ?? cluster.topicTitle}"`);
        skipped++;
        continue;
      }

      // Prefer Chinese display title (topicTitleZh) for user-facing query;
      // use English title (topicTitle) as the search query and queryEn for Google News RSS
      const displayTitle = cluster.topicTitleZh || cluster.topicTitle;
      const searchTitle  = cluster.topicTitle; // always English for Google News accuracy

      console.log(`[${log}] Building timeline: "${displayTitle}" (EN: "${searchTitle}") (${cluster.existingId ? "refresh" : "new"})`);

      const seedArticles = cluster.headlineIndices
        .filter(i => i < headlines.length)
        .map(i => headlines[i]);

      let timerId!: ReturnType<typeof setTimeout>;
      const tlResult = await Promise.race([
        buildTopicTimeline(searchTitle, {
          forceGlobal: true,
          queryEn: searchTitle,           // English title → saved as queryEn in DB
          displayTitleZh: displayTitle,   // Chinese title → saved as query in DB
          seedArticles,
          surface: config.surface !== 'politics' ? config.surface : 'global',
          languageFilter: config.surface === 'invest' ? 'en' : undefined,
        }),
        new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new Error("buildTopicTimeline timed out after 20m")), 1_200_000);
        }),
      ]).finally(() => clearTimeout(timerId));

      const db = await getDb();
      if (db) {
        const actualId = tlResult?.topic?.id ?? cluster.existingId;
        if (actualId) {
          // Guard: never overwrite a politics topic from a non-politics agent
          await db.execute(
            sql`UPDATE topics SET homepageFeaturedAt = NOW(), category = ${cluster.category}, surface = ${config.surface}
                WHERE id = ${actualId} AND IFNULL(surface, 'global') != 'politics' LIMIT 1`
          );
        } else {
          // 用 queryEn（英文搜尋標題）比對 —— 議題的 query 欄位存的是中文 displayTitle，
          // 用英文 topicTitle 比 query 會比不到，導致 surface/homepageFeaturedAt 沒設成功，
          // 進而讓該議題在下個週期的去重名單中隱形、被重複創建（11 萬垃圾議題的成因）。
          await db.execute(
            sql`UPDATE topics SET homepageFeaturedAt = NOW(), category = ${cluster.category}, surface = ${config.surface}
                WHERE queryEn = ${cluster.topicTitle} AND IFNULL(surface, 'global') != 'politics' ORDER BY id DESC LIMIT 1`
          );
        }
      }

      if (cluster.existingId) refreshed++;
      else created++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[${log}] Failed for "${cluster.topicTitle}":`, err instanceof Error ? err.message : String(err));
      failed++;
    }
  }

  console.log(`[${log}] Done: ${created} created, ${refreshed} refreshed, ${skipped} skipped, ${failed} failed`);
  return { created, refreshed, skipped, failed };
}
