# My Pet Health roadmap

## Phase 1 — Local chatbot prototype

- [x] Standalone responsive website and modular chat widget
- [x] Local editable knowledge retrieval
- [x] Mock catalogue behind a product-service interface
- [x] Server-side chat endpoint with optional OpenAI and offline demo mode
- [x] Browser-local conversation persistence behind a storage interface
- [x] Product cards, safety guardrails, development logging and admin scaffold
- [x] Architecture and operational documentation

## Phase 2 — Build and refine the My Pet Health knowledge base

- Process approved customer-service material into anonymous draft entries
- Review every health, product and policy statement with My Pet Health staff
- Replace examples with authoritative feeding guides, policies and product knowledge
- Create a content review and expiry workflow

## Phase 3 — Supabase database and persistent conversations

- Add customers, conversations and messages tables with row-level security
- Implement `SupabaseConversationStore` without changing the chat component
- Move knowledge to Postgres and add hybrid keyword/vector retrieval
- Add audit, retention and deletion controls

## Phase 4 — Live Shopify product integration

- Implement `ShopifyProductService` using live product/variant data
- Sync availability, prices, images, URLs, tags and collections
- Add secure cart mutations and remove mock catalogue data

## Phase 5 — Shopify storefront chat widget/app extension

- Package the existing modular chat UI as a theme app extension
- Keep the customer on the storefront
- Configure allowed origins, widget mode and responsive placement

## Phase 6 — Deploy to Vercel

- Configure environment variables, preview deployments and observability
- Add rate limits, abuse controls and production error reporting
- Attach the chosen custom domain only after it is decided

## Phase 7 — Customer login-linked conversation history

- Verify Shopify customer identity server-side
- Link consented conversations to the corresponding Supabase customer record
- Add resume, rename and delete controls
- Introduce an explicit, editable pet profile only if approved

## Phase 8 — Admin knowledge management and analytics

- Secure staff authentication and role-based permissions
- Add knowledge editing, review, versioning and disable controls
- Surface common, unanswered and poorly answered questions
- Add recommendation-rule editing and quality evaluation
