# 🌍 SoWork News Aggregation Timeline Platform

> **全球新聞聚合時間軸平台** — AI 驅動的新聞聚合、相似性分群與轉折點檢測系統
>
> ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
> ![TypeScript](https://img.shields.io/badge/TypeScript-94.7%25-blue)
> ![Node.js](https://img.shields.io/badge/Node.js-Latest-green)
> ![Status](https://img.shields.io/badge/Status-Active%20Development-brightgreen)
>
> ## ✨ 核心功能
>
> ### 📰 全球新聞聚合
> - **多來源 RSS 聚合**：自動抓取全球主要新聞源
> - - **實時更新**：自動定時檢索並更新新聞內容
>   - - **多語系支援**：支援英文、中文、日文等多語言新聞
>    
>     - ### 🤖 AI 智能分析
>     - - **相似新聞自動分群**：基於 AI 的新聞內容相似度分析
>       - - **轉折點檢測**：自動識別新聞事件的重大轉折、發展階段
>         - - **立場回覆建議**：基於新聞內容的 AI 生成討論觀點建議
>          
>           - ### 🎨 現代化互動設計
>           - - **時間軸視覺化**：橘色軸線 + 轉折點脈動圓點
>             - - **淺色系現代設計**：清爽易用的用戶界面
>               - - **社交分享優化**：OG 圖片支援、即時預覽、Facebook 爬蟲最佳化
>                
>                 - ### 🔐 用戶功能
>                 - - **Email/Password 認證**：安全的登入註冊系統
>                   - - **個人化觀點標記**：可標記並分享個人立場
>                     - - **多端適配**：響應式設計支援各種設備
>                      
>                       - ## 🚀 快速開始
>                      
>                       - ### 環境要求
>                       - - **Node.js**: v18.0.0 或更高版本
>                         - - **pnpm**: v8.0.0 或更高版本（推薦）
> - **PostgreSQL**: v14 或更高版本
> - - **環境變數**：`.env.local` 文件（詳見下方配置）
>  
>   - ### 安裝步驟
>  
>   - ```bash
>     # 1. Clone 本倉庫
>     git clone https://github.com/cj-wang-sowork/news-sowork.git
>     cd news-sowork
>
>     # 2. 安裝依賴
>     pnpm install
>
>     # 3. 配置環境變數
>     cp .env.example .env.local
>     # 編輯 .env.local 並填入必要的 API keys 和數據庫信息
>
>     # 4. 初始化數據庫
>     pnpm run db:push
>
>     # 5. 啟動開發服務器
>     pnpm run dev
>
>     # 6. 訪問應用
>     # 前端: http://localhost:5173
>     # 後端: http://localhost:3000
>     ```
>
> ## 📋 環境變數配置
>
> 創建 `.env.local` 文件：
>
> ```env
> # 數據庫
> DATABASE_URL=postgresql://user:password@localhost:5432/news_sowork
>
> # AI API 密鑰（用於新聞分析）
> OPENAI_API_KEY=sk-xxxxx
> PERPLEXITY_API_KEY=xxxxx
>
> # 認證
> JWT_SECRET=your_jwt_secret_key_here
> SESSION_SECRET=your_session_secret_here
>
> # RSS 更新設置
> RSS_UPDATE_INTERVAL=3600000  # 1 小時（毫秒）
>
> # 前端環境
> VITE_API_URL=http://localhost:3000
> VITE_APP_NAME="SoWork News"
> ```
>
> ## 📁 項目結構
>
> ```
> news-sowork/
> ├── client/               # React 前端應用
> │   ├── src/
> │   │   ├── components/   # React 組件
> │   │   ├── pages/        # 頁面組件
> │   │   ├── hooks/        # 自定義 Hooks
> │   │   └── utils/        # 工具函數
> │   └── vite.config.ts    # Vite 配置
> ├── server/               # Node.js 後端服務
> │   ├── src/
> │   │   ├── routes/       # API 路由
> │   │   ├── services/     # 業務邏輯服務
> │   │   ├── models/       # 數據模型
> │   │   └── utils/        # 工具函數
> │   └── tsconfig.json
> ├── shared/               # 前後端共享代碼
> │   ├── types/            # TypeScript 類型定義
> │   └── constants/        # 常量定義
> ├── drizzle/              # ORM 配置和遷移
> │   └── migrations/       # 數據庫遷移文件
> ├── scripts/              # 工具腳本
> └── package.json          # 依賴配置
> ```
>
> ## 🛠️ 開發指南
>
> ### 常用命令
>
> ```bash
> # 開發環境啟動
> pnpm run dev
>
> # 構建生產版本
> pnpm run build
>
> # 啟動生產服務器
> pnpm run preview
>
> # 數據庫遷移
> pnpm run db:push       # 同步 Schema
> pnpm run db:generate   # 生成遷移文件
>
> # 測試
> pnpm run test
> pnpm run test:ui       # 使用 UI 運行測試
>
> # 代碼質量
> pnpm run lint          # 執行 ESLint
> pnpm run type-check    # TypeScript 類型檢查
> pnpm run format        # 使用 Prettier 格式化代碼
> ```
>
> ### 代碼風格
>
> 本項目採用以下約定：
>
> - **TypeScript**: 所有代碼都使用 TypeScript，禁止使用 `any`
> - - **Formatting**: 使用 Prettier（配置在 `.prettierrc`）
>   - - **Linting**: 使用 ESLint
>     - - **Components**: React 函數組件 + Hooks
>       - - **Database**: Drizzle ORM
>        
>         - ### 新增功能流程
>        
>         - 1. 從 `main` 分支創建新分支：`git checkout -b feature/your-feature`
>           2. 2. 實現功能並編寫測試
>              3. 3. 確保通過 `pnpm run lint` 和 `pnpm run type-check`
>                 4. 4. 提交 PR，描述改動內容
>                   
>                    5. ## 🗂️ 核心模塊說明
>                   
>                    6. ### 前端 (client/)
>                    7. - **React 18** + **TypeScript**
>                       - - **Vite** 構建工具
> - **TailwindCSS** 樣式框架
> - - **UI 組件**：自定義組件库
>  
>   - ### 後端 (server/)
>   - - **Node.js** + **Express/Hono** HTTP 框架
>     - - **Drizzle ORM** 數據庫訪問
>       - - **PostgreSQL** 關係數據庫
>         - - **AI 集成**：OpenAI / Perplexity API
>          
>           - ### 數據庫 Schema
>          
>           - #### Topics（議題表）
>           - ```sql
>             - id: UUID
> - title: 議題標題
> - - description: 議題描述
>   - - category: 分類
>     - - createdAt: 創建時間
>       - - updatedAt: 更新時間
>         - ```
>
>           #### Turning Points（轉折點表）
>           ```sql
>           - id: UUID
>           - topicId: 關聯議題
>           - title: 轉折點標題
>           - description: 轉折點詳情
>           - date: 發生時間
>           - importance: 重要級別
>           ```
>
> #### News Articles（新聞文章表）
> ```sql
> - id: UUID
> - topicId: 關聯議題
> - title: 文章標題
> - content: 文章內容
> - source: 新聞來源
> - url: 原文 URL
> - publishedAt: 發表時間
> ```
>
> ## 🤝 貢獻指南
>
> 歡迎所有形式的貢獻！包括但不限於：
>
> - 🐛 Bug 報告和修復
> - - ✨ 新功能開發
>   - - 📚 文檔改進
>     - - 🎨 UI/UX 優化
>       - - 🧪 測試編寫
>        
>         - ### 貢獻步驟
>        
>         - 1. **Fork** 本倉庫
>           2. 2. **Clone** 到本地：`git clone https://github.com/YOUR_USERNAME/news-sowork.git`
>              3. 3. **創建分支**：`git checkout -b feature/amazing-feature`
>                 4. 4. **提交更改**：`git commit -m 'Add some amazing feature'`
>                    5. 5. **推送到分支**：`git push origin feature/amazing-feature`
>                       6. 6. **提交 Pull Request**
>                         
>                          7. ### 提交信息規範
>                         
>                          8. 遵循以下格式：
>                          9. ```
>                             <type>(<scope>): <subject>
>
> <body>

  <footer>
    ```

    示例：
    ```
    feat(api): add news clustering endpoint

    Implement AI-powered news similarity clustering
    using vector embeddings.

    Closes #123
    ```

    **Type 類型**：
    - `feat`: 新功能
    - `fix`: 修復
    - `docs`: 文檔
    - `style`: 格式化
    - `refactor`: 重構
    - `test`: 測試
    - `chore`: 構建/依賴

    ## 📖 API 文檔

    ### 認證 API

    ```bash
    # 用戶註冊
    POST /api/auth/register
    {
      "email": "user@example.com",
        "password": "password123"
        }

        # 用戶登入
        POST /api/auth/login
        {
          "email": "user@example.com",
            "password": "password123"
            }
            ```

            ### 新聞 API

            ```bash
            # 獲取議題列表
            GET /api/topics?page=1&limit=10

            # 獲取議題詳情
            GET /api/topics/:id

            # 獲取議題的新聞文章
            GET /api/topics/:id/articles?limit=20

            # 獲取轉折點
            GET /api/topics/:id/turning-points
            ```

            ### AI 分析 API

            ```bash
            # 生成 AI 立場回覆建議
            POST /api/articles/:id/ai-perspective
            {
              "perspective": "positive|negative|neutral"
              }

              # 獲取 AI 生成的論點
              GET /api/topics/:id/ai-insights
              ```

              ## 🧪 測試

              ```bash
              # 運行所有測試
              pnpm run test

              # 監視模式運行測試
              pnpm run test:watch

              # 生成覆蓋率報告
              pnpm run test:coverage
              ```

              ## 📦 部署

              ### Docker 部署

              ```dockerfile
              # 構建 Docker 鏡像
              docker build -t news-sowork .

              # 運行容器
              docker run -p 3000:3000 -p 5173:5173 news-sowork
              ```

              ### 生產環境變數

              ```env
              NODE_ENV=production
              DATABASE_URL=postgresql://prod_user:prod_pass@prod_db:5432/news_sowork
              OPENAI_API_KEY=sk-prod-xxxxx
              JWT_SECRET=strong_secret_key_here
              ```

              ## 🎯 路線圖

              - [x] 基礎新聞聚合
              - [x] AI 新聞分群
              - [x] 轉折點檢測
              - [x] 用戶認證系統
              - [ ] 高級搜索過濾
              - [ ] 推薦系統
              - [ ] 移動應用 (React Native)
              - [ ] 即時通知功能
              - [ ] 用戶社區功能
              - [ ] 數據分析面板

              ## 📝 License

              本項目採用 **MIT License**，詳見 [LICENSE](LICENSE) 文件。

              ## 👥 作者與聯繫

              - **開發者**: [cj-wang-sowork](https://github.com/cj-wang-sowork)
              - **Email**: biomba.cj@gmail.com
              - **GitHub Issues**: 用於報告 bug 和功能請求

              ## 🙏 致謝

              感謝以下開源項目和資源：

              - [OpenAI API](https://openai.com/api/) - AI 新聞分析
              - [Perplexity](https://www.perplexity.ai/) - 補充搜尋
              - [Drizzle ORM](https://orm.drizzle.team/) - 數據庫 ORM
              - [React](https://react.dev/) - 前端框架
              - [TypeScript](https://www.typescriptlang.org/) - 類型系統
              - [Vite](https://vitejs.dev/) - 構建工具

              ---

              **⭐ 如果這個項目對你有幫助，請給個 Star！**
  </footer>
</body>
