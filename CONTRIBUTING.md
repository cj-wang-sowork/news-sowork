# 貢獻指南 (Contributing Guide)

感謝你對 SoWork News Aggregation Platform 的興趣！我們非常歡迎各種形式的貢獻。

## 🎯 我們歡迎的貢獻類型

- 🐛 **Bug 報告與修復** — 發現並修復軟件缺陷
- ✨ **新功能開發** — 實現有價值的新功能
- 📚 **文檔改進** — 改進現有文檔或添加新文檔
- 🎨 **UI/UX 優化** — 改進用戶界面和用戶體驗
- 🧪 **測試編寫** — 增加單元測試和集成測試
- ⚡ **性能優化** — 改進應用性能
- 🌍 **國際化** — 添加新語言支援

## 📋 行為準則

在參與本項目時，請：

- 保持尊重和包容的社區環境
- 避免騷擾、歧視或任何形式的不當行為
- 以建設性的方式進行批評
- 尊重他人的想法和觀點

違反行為準則的參與者可能被除名。

## 🚀 快速開始

### 1. Fork 和 Clone

```bash
# Fork 本倉庫（點擊 GitHub 上的 Fork 按鈕）

# Clone 你的 Fork
git clone https://github.com/YOUR_USERNAME/news-sowork.git
cd news-sowork

# 添加上游遠程倉庫
git remote add upstream https://github.com/cj-wang-sowork/news-sowork.git
```

### 2. 創建功能分支

```bash
# 更新本地 main 分支
git fetch upstream
git checkout main
git rebase upstream/main

# 創建新的功能分支
git checkout -b feature/your-feature-name
```

遵循命名規範：
- `feature/description` — 新功能
- `fix/description` — 修復
- `docs/description` — 文檔
- `refactor/description` — 重構
- `test/description` — 測試

### 3. 開發與測試

```bash
# 安裝依賴
pnpm install

# 啟動開發服務器
pnpm run dev

# 運行測試
pnpm run test

# 檢查代碼質量
pnpm run lint
pnpm run type-check

# 格式化代碼
pnpm run format
```

### 4. 提交更改

遵循 Conventional Commits 規範：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 類型**:
- `feat`: 新功能
- `fix`: Bug 修復
- `docs`: 文檔改進
- `style`: 代碼格式（不影響功能）
- `refactor`: 代碼重構
- `perf`: 性能優化
- `test`: 測試相關
- `chore`: 構建、依賴、工具

**示例**:
```
feat(api): add news clustering endpoint

Implement AI-powered news similarity clustering
using vector embeddings. This feature enables
automatic grouping of related news articles.

- Added /api/topics/:id/cluster endpoint
- Implemented clustering algorithm
- Added unit tests

Closes #123
```

### 5. 推送並提交 PR

```bash
# 推送到你的 Fork
git push origin feature/your-feature-name

# 訪問 GitHub 並點擊 "Pull Request" 按鈕
```

## 📝 PR 描述模板

在提交 PR 時，請填寫以下信息：

```markdown
## 描述
簡要描述你的改動

## 相關 Issue
Closes #(issue number)

## 改動類型
- [ ] Bug 修復
- [ ] 新功能
- [ ] 破壞性改動
- [ ] 文檔更新

## 改動清單
- Item 1
- Item 2

## 測試
描述你如何測試了這些改動

## 截圖（如適用）
添加相關截圖

## 檢查清單
- [ ] 代碼遵循項目風格指南
- [ ] 我已更新相關文檔
- [ ] 我添加了測試代碼
- [ ] 新舊測試都通過了
- [ ] 我已運行 `pnpm run lint` 和 `pnpm run type-check`
```

## 💻 開發環境設置

### 預設條件
- Node.js v18+
- pnpm v8+
- PostgreSQL v14+
- Git

### 初始設置

```bash
# 1. 安裝依賴
pnpm install

# 2. 配置環境變數
cp .env.example .env.local
# 編輯 .env.local 並填入你的設置

# 3. 初始化數據庫
pnpm run db:push

# 4. 啟動開發服務器
pnpm run dev
```

## 🧪 測試指南

所有新功能和修復都應包含相應的測試：

```bash
# 運行所有測試
pnpm run test

# 運行特定測試文件
pnpm run test src/services/newsAnalysis.test.ts

# 監視模式（文件更改時自動重新運行）
pnpm run test:watch

# 生成覆蓋率報告
pnpm run test:coverage
```

### 編寫測試

使用 Vitest 和 `@testing-library` 編寫測試：

```typescript
import { describe, it, expect } from 'vitest'
import { clusterNews } from './newsAnalysis'

describe('News Clustering', () => {
  it('should cluster similar news articles', () => {
      const articles = [
            { id: 1, title: 'AI Breakthrough', content: '...' },
                  { id: 2, title: 'AI Progress', content: '...' }
                      ]

                              const clusters = clusterNews(articles)
                                  expect(clusters.length).toBe(1)
                                      expect(clusters[0].articles.length).toBe(2)
                                        })
                                        })
                                        ```

                                        ## 📐 代碼風格

                                        ### TypeScript

                                        - 所有代碼必須使用 TypeScript
                                        - 不允許使用 `any` 類型（除非有特殊原因）
                                        - 為公開 API 編寫類型定義

                                        ```typescript
                                        // 好
                                        function processNews(articles: NewsArticle[]): ClusteredNews[] {
                                          // ...
                                          }

                                          // 避免
                                          function processNews(articles: any): any {
                                            // ...
                                            }
                                            ```

                                            ### 格式化

                                            項目使用 Prettier 進行自動格式化：

                                            ```bash
                                            pnpm run format
                                            ```

                                            ### Linting

                                            使用 ESLint 檢查代碼質量：

                                            ```bash
                                            pnpm run lint
                                            pnpm run lint:fix  # 自動修復可修復的問題
                                            ```

                                            ## 📚 文檔

                                            ### 編寫文檔

                                            - 使用清晰、簡洁的語言
                                            - 包含代碼示例
                                            - 添加適當的標題和格式
                                            - 考慮多語言（至少英文和中文）

                                            ### 更新 README

                                            如果你的改動影響用戶，請更新 README：

                                            ```bash
                                            # README.md 部分示例
                                            ### 新功能
                                            簡要描述功能及其用法
                                            ```

                                            ## 🔄 代碼審查流程

                                            1. 提交 PR 後，維護者會進行代碼審查
                                            2. 可能會要求進行改動
                                            3. 在被批准後，你的代碼將被合並到 main 分支

                                            ### 常見評論類型

                                            - ✅ **Approved** — PR 已被批准
                                            - 💬 **Comment** — 一般意見或建議
                                            - 🔄 **Changes Requested** — 需要進行改動

                                            ## 🐛 報告 Bug

                                            在報告 Bug 時，請提供：

                                            1. **清晰的標題** — 簡明扼要地描述問題
                                            2. **詳細的描述** — 問題是什麼以及為什麼它很重要
                                            3. **複現步驟** — 如何複現該問題
                                            4. **預期行為** — 應該發生什麼
                                            5. **實際行為** — 實際發生了什麼
                                            6. **環境信息** — OS、瀏覽器、Node.js 版本等
                                            7. **截圖或日誌** — 如有可用

                                            示例：
                                            ```
                                            ## Bug 標題
                                            新聞聚合在某些情況下失敗

                                            ## 描述
                                            當用戶點擊"刷新"按鈕超過 5 次時，應用會崩潰。

                                            ## 複現步驟
                                            1. 轉到主頁
                                            2. 點擊"刷新"按鈕
                                            3. 快速重複點擊 5 次或以上

                                            ## 預期行為
                                            應用應繼續正常運行

                                            ## 實際行為
                                            應用顯示白屏

                                            ## 環境
                                            - OS: macOS 13.1
                                            - Browser: Chrome 120
                                            - Node.js: 18.17.0
                                            ```

                                            ## ✨ 功能請求

                                            有好主意？我們很樂意聽取！

                                            1. 檢查 [Issues](../../issues) 確保沒有重複的請求
                                            2. 創建新的 Issue，標籤為 `enhancement`
                                            3. 清晰描述功能及其益處

                                            ## 💰 沒有代碼的貢獻

                                            - 💭 反饋和建議
                                            - 📣 分享項目
                                            - 🆘 幫助他人
                                            - ✍️ 改進文檔

                                            ## 🆘 需要幫助？

                                            - 📖 閱讀 [README](README.md)
                                            - 💬 在 Issues 中提問
                                            - 📧 聯繫維護者

                                            ## 📄 License

                                            通過貢獻，你同意你的代碼將在 MIT License 下發布。

                                            ---

                                            感謝你的貢獻！⭐
