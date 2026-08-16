# My Pet Health

A standalone, customer-facing pet-food guidance website. My Pet Health is the public website and assistant brand; [All Good Petfood](https://allgoodpetfood.co.nz) is the source retailer for its product catalogue and purchase links. The app gives friendly, practical answers, asks useful follow-up questions before recommending food, retrieves only relevant local knowledge, and shows products exclusively from the configured catalogue service.

The same modular chat UI can later appear as a floating Shopify widget. The standalone website remains available at its own Vercel URL or a future custom domain; no public domain is hard-coded.

## Phase 1 features

- Responsive desktop and mobile chat website at `/`
- My Pet Health branding with Poppins typography and a navy, aqua, green and yellow palette
- Natural follow-up behaviour and medical/veterinary guardrails
- Seven editable local knowledge entries with ranked keyword retrieval
- Four illustrative mock products behind a replaceable service interface
- Recommendation cards with price, view-product and future add-to-cart controls
- OpenAI Responses API integration that stays entirely server-side
- Fully functional local demo responder when no OpenAI key is configured
- Previous conversations stored locally in the browser
- Placeholder staff admin at `/admin`
- Safe development logs for retrieval, products, response mode and errors
- Tests for retrieval and recommendation guardrails

## Requirements

- Node.js 20.9 or newer
- npm
- An OpenAI API key is optional for Phase 1

## Install and run

```powershell
cd E:\mypethealth
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The admin preview is at [http://localhost:3000/admin](http://localhost:3000/admin).

If `.env.local` already exists, edit it instead of copying over it. Without `OPENAI_API_KEY`, the website uses the deterministic local demo responder and all core flows still work.

## Environment variables

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `OPENAI_API_KEY` | Enables live OpenAI responses | Server only |
| `OPENAI_MODEL` | Selects the server-side response model | Server only |
| `APP_BASE_URL` | Local, preview or production base URL | Server configuration |
| `SUPABASE_URL` | Future Supabase project URL | Not used in Phase 1 |
| `SUPABASE_ANON_KEY` | Future limited Supabase client key | Not used in Phase 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Future privileged server operations | Server only, never browser code |
| `SHOPIFY_STORE_DOMAIN` | Future Shopify store domain | Server configuration |
| `SHOPIFY_STORE_URL` | All Good Petfood base URL used to create product links | Server configuration |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Future Storefront API access | Use according to Shopify token scope |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Future Admin API access | Server only |

Secrets belong in `.env.local` locally and protected Vercel environment variables online. `.env.local` is ignored by Git.

## Knowledge base

Knowledge lives in [`knowledge/entries.json`](knowledge/entries.json). Each entry has a stable ID, category, summary, detailed content, suggested follow-up questions, safety notes, retrieval tags, product tags and an `enabled` flag.

To edit knowledge:

1. Update an existing entry or add another object following the same shape.
2. Use factual, reviewed My Pet Health guidance; do not include customer-identifying data.
3. Add specific retrieval tags customers are likely to use.
4. Add product tags only when that relationship has been reviewed.
5. Run `npm test`, `npm run typecheck` and `npm run build`.

The app queries `KnowledgeService`, not the JSON file directly. A future Supabase/vector implementation can replace `LocalKnowledgeService` without changing the route or UI. The planned historical-email workflow is documented in [`docs/HISTORICAL_EMAIL_KNOWLEDGE.md`](docs/HISTORICAL_EMAIL_KNOWLEDGE.md).

## Mock products

Snapshot catalogue records live in [`src/data/mock-products.ts`](src/data/mock-products.ts). They use a small set of All Good Petfood products and URLs for Phase 1, but remain mock records: prices, availability, descriptions and ingredients do not update automatically and must not be treated as live Shopify data. Each includes the requested ID, title, description, known ingredients, price, image, retailer path, tags and availability.

`ProductService` exposes:

- `searchProducts()`
- `getProduct()`
- `getProductsByTag()`
- `recommendProducts()`

Only product objects returned from this service can become recommendation cards. Their “View product” action opens the configured All Good Petfood store in a new tab. Phase 4 replaces `MockProductService` with a live Shopify implementation and removes these records.

## Architecture

```text
Browser website / future Shopify widget
              |
              v
         POST /api/chat
          /     |      \
 Knowledge   Product    Conversation context
 service     service    supplied by the client
          \     |      /
              v
   Server-only assistant service
      OpenAI or local demo mode
              |
              v
       Answer + known products
```

Key boundaries:

- `src/components` — reusable customer chat interface and product cards
- `src/app/api/chat` — validated backend-for-frontend endpoint
- `src/ai` — editable system prompt, OpenAI adapter and local fallback
- `src/services/knowledge` — replaceable retrieval contract
- `src/services/products` — replaceable catalogue contract
- `src/services/conversations` — replaceable persistence contract
- `src/config` — server-only environment configuration
- `knowledge` — human-editable local content

## Conversation persistence and Supabase

Phase 1 stores conversations in browser `localStorage`. It is convenient for local testing but is device-specific, unauthenticated and not suitable as durable customer data. The UI only calls `ConversationStore`, so Phase 3 can introduce a server/Supabase implementation.

The planned tables are:

- `customers(id, shopify_customer_id, created_at)`
- `conversations(id, customer_id, title, created_at, updated_at)`
- `messages(id, conversation_id, role, content, created_at, metadata)`

Supabase row-level security must ensure customers can access only their own records. Service-role credentials must remain server-only. A future pet profile should be structured, explicit, editable and consented — never uncontrolled AI memory.

## Shopify integration

The standalone My Pet Health URL and Shopify widget will share the hosted backend and chat component. The target flow is:

```text
Shopify customer → theme app extension widget → hosted /api/chat
                                             → My Pet Health knowledge
                                             → live Shopify products
                                             → OpenAI
                                             → response + product cards
```

Customers remain on the Shopify storefront. `ShopifyProductService` will use stable product and variant IDs, current availability and current URLs. Cart actions will call an approved Shopify cart API rather than trusting client-submitted price or availability. Logged-in identity must be cryptographically verified before conversation history is loaded.

## Vercel and a future domain

The project is a standard Next.js application and can deploy directly to Vercel. Add the environment variables separately for development, preview and production. `APP_BASE_URL` is the only base-URL assumption, so a custom domain can be attached later without code changes.

Before public launch, add rate limiting, origin controls for the Shopify embed, bot/abuse protection, structured monitoring, a privacy notice, retention/deletion tooling and production content review.

## Logging and security

The chat route logs message length rather than message content, retrieved entry IDs, returned product IDs, response mode and sanitised error summaries. It never logs keys. API keys are imported only by modules marked `server-only`.

Customer messages can still contain sensitive data. Production logging, analytics and conversation retention must therefore be minimised and covered by the final privacy policy.

## Commands

```powershell
npm run dev        # local development
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # Vitest
npm run build      # production build
npm start          # serve a production build
```

## Still to build

Authoritative My Pet Health content, real Shopify products/cart behaviour, Supabase persistence, customer identity, streaming responses, staff authentication, knowledge editing, analytics, production hardening, Vercel deployment and the Shopify theme app extension remain later phases. See [`ROADMAP.md`](ROADMAP.md).
