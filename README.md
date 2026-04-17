# 🌍 SoWork News - Contextual News Reader

**AI-Powered News Clustering and Turning Point Detection System**

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![TypeScript 94.7%](https://img.shields.io/badge/TypeScript-94.7%25-blue)
![Node.js Latest](https://img.shields.io/badge/Node.js-Latest-green)
![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-brightgreen)

## ✨ What is SoWork News?

**SoWork News** is a contextual news reader that revolutionizes how you consume information. Instead of reading every single article, we cluster related stories and intelligently detect turning points in developing news. This helps you understand the bigger picture without information overload.

### 🎯 Core Problem We Solve

- **Information Overload**: Too many similar articles about the same topic
- - **Missing Context**: Difficult to understand the evolution of a story
  - - **Time Constraints**: Hard to identify which developments matter most
    - - **Scattered Sources**: News spread across multiple outlets and languages
     
      - ## 🚀 Key Features
     
      - ### 📰 Global News Aggregation
      - - Multi-source RSS feed integration - automatically fetches from major news outlets worldwide
        - - Real-time updates with scheduled refresh intervals
          - - Multi-language support (English, Chinese, Japanese, and more)
            - - Intelligent content deduplication
             
              - ### 🤖 AI-Powered Analysis
              - - **News Clustering**: Uses AI to analyze content similarity and group related articles
                - - **Turning Point Detection**: Automatically identifies critical developments and shifts in a story
                  - - **AI Perspective Analysis**: Generates different viewpoints on the same news event
                    - - **Contextual Summaries**: AI-generated summaries that put news in context
                     
                      - ### 💫 Modern Interactive UI
                      - - **Timeline Visualization**: Visual representation of news flow with turning point indicators
                        - - **Contextual Reading**: Clean, minimal interface for focused reading
                          - - **Social Sharing**: Share news with AI-generated perspectives (OG image preview)
                            - - **Multi-Language**: Intuitive UI design supporting multiple languages
                             
                              - ### 🔐 User Features
                              - - Email/Password authentication with secure sign-up system
                                - - Personalized reading history and bookmarks
                                  - - Custom topic subscriptions
                                    - - Cross-platform synchronization
                                     
                                      - ## 🛠️ Tech Stack
                                     
                                      - ### Frontend (client/)
                                      - - React + TypeScript
                                        - - TailwindCSS for styling
                                          - - Vite as build tool
                                            - - Custom component library
                                             
                                              - ### Backend (server/)
                                              - - Node.js + Express/Hono
                                                - - PostgreSQL (v14+) for data storage
                                                  - - Drizzle ORM for database access
                                                    - - OpenAI/Perplexity API for AI features
                                                     
                                                      - ### Database Schema
                                                     
                                                      - **Topics Table**
                                                      - - id: UUID
                                                        - - title: Topic title
                                                          - - description: Detailed description
                                                            - - category: News category
                                                              - - createdAt: Creation timestamp
                                                                - - updatedAt: Last update timestamp
                                                                 
                                                                  - **Turning Points Table**
                                                                  - - id: UUID
                                                                    - - topicId: Associated topic
                                                                      - - title: Turning point event title
                                                                        - - description: Event details
                                                                          - - impact: Significance level
                                                                            - - detectedAt: Detection timestamp
                                                                             
                                                                              - **News Articles Table**
                                                                              - - id: UUID
                                                                                - - topicId: Associated topic
                                                                                  - - title: Article headline
                                                                                    - - content: Article body
                                                                                      - - source: News outlet name
                                                                                        - - url: Original article URL
                                                                                          - - publishedAt: Publication date
                                                                                           
                                                                                            - ## 📋 Getting Started
                                                                                           
                                                                                            - ### Prerequisites
                                                                                            - - Node.js v18.0 or higher
                                                                                              - - pnpm v8.0 or higher (recommended)
                                                                                                - - PostgreSQL v14 or later
                                                                                                  - - Environment variables (see configuration below)
                                                                                                   
                                                                                                    - ### Installation Steps
                                                                                                   
                                                                                                    - 1. **Clone the repository**
                                                                                                      2. ```bash
                                                                                                         git clone https://github.com/cj-wang-sowork/news-sowork.git news-sowork
                                                                                                         cd news-sowork
                                                                                                         ```
                                                                                                         
                                                                                                         2. **Install dependencies**
                                                                                                         3. ```bash
                                                                                                            pnpm install
                                                                                                            ```
                                                                                                            
                                                                                                            3. **Configure environment variables**
                                                                                                            4. ```bash
                                                                                                               cp .env.example .env.local
                                                                                                               # Edit .env.local with your API keys and database settings
                                                                                                               ```
                                                                                                               
                                                                                                               4. **Initialize database**
                                                                                                               5. ```bash
                                                                                                                  pnpm run db:push
                                                                                                                  ```
                                                                                                                  
                                                                                                                  5. **Start development server**
                                                                                                                  6. ```bash
                                                                                                                     pnpm run dev
                                                                                                                     ```
                                                                                                                     
                                                                                                                     6. **Access the application**
                                                                                                                     7. - Frontend: http://localhost:5173
                                                                                                                        - - Backend: http://localhost:3000
                                                                                                                         
                                                                                                                          - ## 🔧 Environment Variables Configuration
                                                                                                                         
                                                                                                                          - Create a `.env.local` file with the following variables:
                                                                                                                         
                                                                                                                          - ### Database Configuration
                                                                                                                          - ```
                                                                                                                            DATABASE_URL=postgresql://user:password@localhost:5432/news_sowork
                                                                                                                            ```
                                                                                                                            
                                                                                                                            ### AI API Keys (for news analysis)
                                                                                                                            ```
                                                                                                                            OPENAI_API_KEY=sk-xxxxx
                                                                                                                            PERPLEXITY_API_KEY=xxxxx
                                                                                                                            ```
                                                                                                                            
                                                                                                                            ### Security Keys
                                                                                                                            ```
                                                                                                                            JWT_SECRET=your_jwt_secret_key_here
                                                                                                                            SESSION_SECRET=your_session_secret_here
                                                                                                                            ```
                                                                                                                            
                                                                                                                            ### RSS Update Configuration
                                                                                                                            ```
                                                                                                                            RSS_UPDATE_INTERVAL=3600000
                                                                                                                            # 1 hour interval (in milliseconds)
                                                                                                                            ```
                                                                                                                            
                                                                                                                            ### Frontend Configuration
                                                                                                                            ```
                                                                                                                            VITE_API_URL=http://localhost:3000
                                                                                                                            VITE_APP_NAME=SoWork News
                                                                                                                            ```
                                                                                                                            
                                                                                                                            ## 📁 Project Structure
                                                                                                                            
                                                                                                                            ```
                                                                                                                            news-sowork/
                                                                                                                            ├── client/                 # React frontend application
                                                                                                                            │   ├── src/
                                                                                                                            │   │   ├── components/    # React components
                                                                                                                            │   │   ├── pages/         # Page components
                                                                                                                            │   │   ├── hooks/         # Custom React hooks
                                                                                                                            │   │   └── styles/        # TailwindCSS styling
                                                                                                                            │   ├── vite.config.ts     # Vite configuration
                                                                                                                            │   └── package.json
                                                                                                                            ├── server/                 # Node.js backend
                                                                                                                            │   ├── src/
                                                                                                                            │   │   ├── api/           # API routes
                                                                                                                            │   │   ├── services/      # Business logic
                                                                                                                            │   │   ├── db/            # Database queries
                                                                                                                            │   │   └── middleware/    # Express middleware
                                                                                                                            │   ├── package.json
                                                                                                                            │   └── tsconfig.json
                                                                                                                            ├── shared/                 # Shared types and utilities
                                                                                                                            ├── drizzle/               # Database migrations
                                                                                                                            ├── .env.example           # Environment template
                                                                                                                            ├── package.json           # Root package configuration
                                                                                                                            └── README.md              # This file
                                                                                                                            ```
                                                                                                                            
                                                                                                                            ## 🛠️ Development Guide
                                                                                                                            
                                                                                                                            ### Common Commands
                                                                                                                            
                                                                                                                            ```bash
                                                                                                                            # Start development server (both frontend and backend)
                                                                                                                            pnpm run dev

                                                                                                                            # Build production version
                                                                                                                            pnpm run build

                                                                                                                            # Start production server
                                                                                                                            pnpm run preview

                                                                                                                            # Database operations
                                                                                                                            pnpm run db:push       # Apply migrations
                                                                                                                            pnpm run db:generate   # Generate migration files
                                                                                                                            pnpm run db:migrate    # Run migrations
                                                                                                                            pnpm run db:studio     # Open database GUI

                                                                                                                            # Testing
                                                                                                                            pnpm run test          # Run tests with UI
                                                                                                                            pnpm run test:unit     # Unit tests only

                                                                                                                            # Code quality
                                                                                                                            pnpm run lint          # Run ESLint
                                                                                                                            pnpm run type-check    # TypeScript type checking
                                                                                                                            pnpm run format        # Format code with Prettier
                                                                                                                            ```
                                                                                                                            
                                                                                                                            ### Code Style
                                                                                                                            
                                                                                                                            This project follows these conventions:
                                                                                                                            
                                                                                                                            - **TypeScript**: All code must be TypeScript (no `any` type allowed)
                                                                                                                            - - **Formatting**: Prettier (config in `.prettierrc`)
                                                                                                                              - - **Linting**: ESLint for code quality
                                                                                                                                - - **React**: Functional components with Hooks
                                                                                                                                  - - **Styling**: TailwindCSS for utility-first CSS
                                                                                                                                    - - **UI Components**: Custom component library
                                                                                                                                      - - **Backend**: Modular, service-based architecture
                                                                                                                                        - - **Database**: Drizzle ORM with TypeScript
                                                                                                                                         
                                                                                                                                          - ## 🤝 Contributing
                                                                                                                                         
                                                                                                                                          - We welcome all forms of contributions, including:
                                                                                                                                         
                                                                                                                                          - - 🐛 Bug reports and fixes
                                                                                                                                            - - ✨ New feature development
                                                                                                                                              - - 📚 Documentation improvements
                                                                                                                                                - - 🎨 UI/UX enhancements
                                                                                                                                                  - - 🌍 Localization and translations
                                                                                                                                                   
                                                                                                                                                    - ### Contributing Workflow
                                                                                                                                                   
                                                                                                                                                    - 1. Fork the repository
                                                                                                                                                      2. 2. Create a feature branch (`git checkout -b feature/amazing-feature`)
                                                                                                                                                         3. 3. Make your changes and commit (`git commit -m 'feat: add amazing feature'`)
                                                                                                                                                            4. 4. Push to your branch (`git push origin feature/amazing-feature`)
                                                                                                                                                               5. 5. Open a Pull Request
                                                                                                                                                                 
                                                                                                                                                                  6. ### Commit Message Format
                                                                                                                                                                 
                                                                                                                                                                  7. ```
                                                                                                                                                                     feat(scope): description
                                                                                                                                                                     Implement AI-powered news clustering endpoint
                                                                                                                                                                     - Added similarity analysis algorithm
                                                                                                                                                                     - Integrated ML model for accuracy
                                                                                                                                                                     - Added comprehensive tests
                                                                                                                                                                     ```
                                                                                                                                                                     
                                                                                                                                                                     ## 📄 License
                                                                                                                                                                     
                                                                                                                                                                     This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
                                                                                                                                                                     
                                                                                                                                                                     ## 🔒 Security
                                                                                                                                                                     
                                                                                                                                                                     For security concerns and vulnerability reporting, please see our [SECURITY.md](SECURITY.md) policy.
                                                                                                                                                                     
                                                                                                                                                                     ## 📖 Additional Resources
                                                                                                                                                                     
                                                                                                                                                                     - [CONTRIBUTING.md](CONTRIBUTING.md) - Detailed contribution guidelines
                                                                                                                                                                     - - [SECURITY.md](SECURITY.md) - Security policy and reporting procedures
                                                                                                                                                                       - - [CHANGELOG.md](CHANGELOG.md) - Version history and updates
                                                                                                                                                                         - - [MARKET_ANALYSIS_AND_GLOBALIZATION.md](MARKET_ANALYSIS_AND_GLOBALIZATION.md) - Market strategy documentation
                                                                                                                                                                          
                                                                                                                                                                           - ## 🚀 Roadmap (Q3-Q4 2026)
                                                                                                                                                                          
                                                                                                                                                                           - - [ ] Mobile app development (iOS/Android)
                                                                                                                                                                             - [ ] - [ ] Advanced ML models for turning point detection
                                                                                                                                                                             - [ ] - [ ] Real-time collaborative reading features
                                                                                                                                                                             - [ ] - [ ] API rate limiting and usage analytics
                                                                                                                                                                             - [ ] - [ ] Enterprise deployment options
                                                                                                                                                                             - [ ] - [ ] Extended language support (30+ languages)
                                                                                                                                                                            
                                                                                                                                                                             - [ ] ## 💬 Questions & Support
                                                                                                                                                                            
                                                                                                                                                                             - [ ] - Open an issue for bug reports
                                                                                                                                                                             - [ ] - Check existing discussions for Q&A
                                                                                                                                                                             - [ ] - Review documentation for common questions
                                                                                                                                                                            
                                                                                                                                                                             - [ ] ---
                                                                                                                                                                            
                                                                                                                                                                             - [ ] **Change the way you read news - understand what matters, not every single article.**
                                                                                                                                                                            
                                                                                                                                                                             - [ ] © 2026 SoWork Team. All rights reserved.
