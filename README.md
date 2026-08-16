# My Pet Health

A standalone, customer-facing pet-food guidance website. My Pet Health is the public website brand, Buddy is its conversational assistant, and [All Good Petfood](https://allgoodpetfood.co.nz) is the source retailer for its product catalogue and purchase links. The app gives friendly, practical answers, asks useful follow-up questions before recommending food, retrieves only relevant local knowledge, and shows products exclusively from the configured catalogue service.

The same modular chat UI can later appear as a floating Shopify widget. The standalone website remains available at its own Vercel URL or a future custom domain; no public domain is hard-coded.

## Phase 1 features

- Responsive desktop and mobile chat website at `/`
- My Pet Health branding with Poppins typography and a navy, aqua, green and yellow palette
- Natural follow-up behaviour and medical/veterinary guardrails
- Seven editable local knowledge entries with ranked keyword retrieval
- Four illustrative mock products behind a replaceable service interface
- Recommendation cards with price, view-product and future add-to-cart controls
- Gemini API integration that stays entirely server-side
- Fully functional local demo responder when no Gemini key is configured
- Email/password sign-up and sign-in through Supabase Auth
- Account conversations saved across devices through Supabase with local guest fallback
- Placeholder staff admin at `/admin`
- Safe development logs for retrieval, products, response mode and errors
- Tests for retrieval and recommendation guardrails
- Local-only, restartable MBOX knowledge extraction with privacy auditing and mandatory review

## Requirements

- Node.js 20.9 or newer
- npm
- A Supabase project for customer accounts and cross-device chat history
- A Gemini API key is optional

## Install and run

```powershell
cd E:\mypethealth
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The admin preview is at [http://localhost:3000/admin](http://localhost:3000/admin).

If `.env.local` already exists, edit it instead of copying over it. Without `GEMINI_API_KEY`, the website uses the deterministic local demo responder and all core flows still work.

## Environment variables

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `GEMINI_API_KEY` | Enables live Gemini responses | Server only |
| `GEMINI_MODEL` | Selects the server-side Gemini model | Server only |
| `APP_BASE_URL` | Local, preview or production base URL | Server configuration |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser-safe project identifier |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key used with RLS | Browser-safe; never substitute a service-role key |
| `SHOPIFY_STORE_DOMAIN` | Future Shopify store domain | Server configuration |
| `SHOPIFY_STORE_URL` | All Good Petfood base URL used to create product links | Server configuration |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Future Storefront API access | Use according to Shopify token scope |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` | Future shared All Good customer login | Server configuration |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` | Future confidential OAuth flow, when applicable | Server only |

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

The implemented local MBOX processor lives in [`email-processing`](email-processing/README.md). Its raw input, working state, output and logs are Git-ignored. It uses no external AI and cannot add generated entries to Buddy until a human runs the explicit approval command. Approved imports are stored separately in [`knowledge/email-derived.json`](knowledge/email-derived.json).

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
      Gemini or local demo mode
              |
              v
       Answer + known products
```

Key boundaries:

- `src/components` — reusable customer chat interface and product cards
- `src/app/api/chat` — validated backend-for-frontend endpoint
- `src/ai` — editable system prompt, Gemini adapter and local fallback
- `src/services/knowledge` — replaceable retrieval contract
- `src/services/products` — replaceable catalogue contract
- `src/services/conversations` — replaceable persistence contract
- `src/config` — server-only environment configuration
- `knowledge` — human-editable local content

## Accounts and Supabase conversation persistence

Guests keep conversations in browser `localStorage`. Signed-in customers use Supabase Auth and the `SupabaseConversationStore`; existing guest conversations are transferred after the first successful sign-in. If cloud storage is unavailable, the UI reports that the chat remains on the current device.

To enable accounts:

1. Put only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.
2. In Supabase, open **SQL Editor**, paste [`supabase/migrations/202608160001_create_conversations.sql`](supabase/migrations/202608160001_create_conversations.sql), and run it once.
3. Under **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` and add the eventual HTTPS production URL to Redirect URLs.
4. Under **Authentication → Providers → Email**, choose whether new accounts must confirm their email. Production should keep confirmation enabled and configure branded SMTP.
5. Restart `npm run dev`, select **Sign in**, and create a test account.

The migration enables Row Level Security and restricts every select, insert, update and delete to rows whose `user_id` equals `auth.uid()`. The app does not require a service-role key. Never place a service-role key in a variable beginning with `NEXT_PUBLIC_`.

The current flow provides My Pet Health email accounts. Shared All Good Petfood identity is the next connection: configure Shopify's Customer Account API OAuth credentials and map the verified Shopify customer ID to the account. No Shopify password should ever be collected by My Pet Health.

## Shopify integration

The standalone My Pet Health URL and Shopify widget will share the hosted backend and chat component. The target flow is:

```text
Shopify customer → theme app extension widget → hosted /api/chat
                                             → My Pet Health knowledge
                                             → live Shopify products
                                             → Gemini
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
npm run email:test # synthetic privacy/pipeline tests
```

## Still to build

Authoritative My Pet Health content, real Shopify products/cart behaviour, shared Shopify customer identity, password recovery, streaming responses, staff authentication, knowledge editing, analytics, production hardening, Vercel deployment and the Shopify theme app extension remain later phases. See [`ROADMAP.md`](ROADMAP.md).
