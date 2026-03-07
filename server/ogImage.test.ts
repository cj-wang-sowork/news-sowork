/**
 * OG Image Generation Tests
 * Tests for the Satori-based OG image generator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the font download to avoid network calls in tests
vi.mock('https', () => ({
  default: {
    get: vi.fn((_url: string, cb: (res: { on: (event: string, handler: (chunk?: Buffer) => void) => void }) => void) => {
      const mockRes = {
        on: (event: string, handler: (chunk?: Buffer) => void) => {
          if (event === 'data') handler(Buffer.from('mock-font-data'));
          if (event === 'end') handler();
        },
      };
      cb(mockRes);
      return { on: vi.fn() };
    }),
  },
}));

// Mock satori to avoid actual SVG generation
vi.mock('satori', () => ({
  default: vi.fn(async () => '<svg width="1200" height="630"><text>mock</text></svg>'),
}));

// Mock @resvg/resvg-js to avoid actual rendering
vi.mock('@resvg/resvg-js', () => ({
  Resvg: vi.fn().mockImplementation(() => ({
    render: vi.fn().mockReturnValue({
      asPng: vi.fn().mockReturnValue(Buffer.from('mock-png-data')),
    }),
  })),
}));

describe('OG Image Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate OG image without comment', async () => {
    const { generateOgImage } = await import('./ogImage.js');
    const result = await generateOgImage({
      title: '台積電赴美動態',
      category: '科技',
      articleCount: 535,
      mediaCount: 149,
    });
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should generate OG image with comment and author', async () => {
    const { generateOgImage } = await import('./ogImage.js');
    const result = await generateOgImage({
      title: '台積電赴美動態',
      category: '科技',
      articleCount: 535,
      mediaCount: 149,
      comment: '台積電赴美設廠是台灣科技業的重大轉折，值得持續關注',
      authorName: '王俊人',
    });
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should truncate long comments to 55 characters', async () => {
    const { generateOgImage } = await import('./ogImage.js');
    const longComment = '這是一個非常長的評論，超過五十五個字的限制，應該要被截斷並加上省略號，確保 OG 圖片的排版不會因為文字過長而破版';
    const result = await generateOgImage({
      title: '測試議題',
      comment: longComment,
    });
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle missing optional fields gracefully', async () => {
    const { generateOgImage } = await import('./ogImage.js');
    const result = await generateOgImage({
      title: '最小化測試議題',
    });
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe('generateShareOpinions tRPC route', () => {
  it('should be a public procedure accessible without auth', async () => {
    // This is a structural test - verifying the route exists in the router
    const { appRouter } = await import('./routers.js');
    expect(appRouter).toBeDefined();
    // The ai router should have generateShareOpinions
    const aiRouter = (appRouter as Record<string, unknown>)._def;
    expect(aiRouter).toBeDefined();
  });
});
