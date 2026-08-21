# My Pet Health

A standalone, customer-facing pet-food guidance website. My Pet Health is the public website brand, Buddy is its conversational assistant, and [All Good Petfood](https://allgoodpetfood.co.nz) is the source retailer for its product catalogue and purchase links. The app gives friendly, practical answers, asks useful follow-up questions before recommending food, retrieves only relevant local knowledge, and shows products exclusively from the configured catalogue service.

The same modular chat UI can later appear as a floating Shopify widget. The standalone website remains available at its own Vercel URL or a future custom domain; no public domain is hard-coded.

## Phase 1 features

- Responsive desktop and mobile chat website at `/`
- My Pet Health branding with Poppins typography and a navy, aqua, green and yellow palette
- Natural follow-up behaviour and medical/veterinary guardrails
- Seven reviewed built-in knowledge entries plus admin-managed Supabase Q&A
- Live Shopify catalogue search, purchase history and stock-aware product cards
- Customer-approved out-of-stock enquiries sent through Resend with a Supabase audit timestamp
- Recommendation cards with price, product links and add-to-cart controls
- Gemini API integration that stays entirely server-side
- Fully functional local demo responder when no Gemini key is configured
- Shopify Customer Account login required before Buddy can be used
- Shopify-owned conversations saved across devices through a protected Supabase server API
- Email-gated staff knowledge editor at `/admin`
- Safe development logs for retrieval, products, response mode and errors
- Tests for retrieval and recommendation guardrails
- Local-only, restartable MBOX knowledge extraction with privacy auditing and mandatory review

## Requirements

- Node.js 20.9 or newer
- npm
- A Supabase project for cross-device chat history
- A Gemini API key is optional
- A verified Resend sending domain is optional and enables Buddy's stock-enquiry emails

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
| `SUPABASE_URL` | Supabase project URL | Server only |
| `SUPABASE_SECRET_KEY` | Supabase secret key for the protected server API | Server only; never expose in the browser |
| `RESEND_API_KEY` | Sends customer-approved stock enquiries | Server only |
| `RESEND_FROM_EMAIL` | Verified Resend sender used by Buddy | Server configuration |
| `RESTOCK_ENQUIRY_TO_EMAIL` | Staff inbox that receives stock enquiries | Server configuration |
| `SHOPIFY_STORE_DOMAIN` | Shopify store domain | Server configuration |
| `SHOPIFY_STORE_URL` | All Good Petfood base URL used to create product links | Server configuration |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Storefront API product access | Server only |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` | All Good Customer Account OAuth client | Server configuration |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` | Confidential OAuth client secret | Server only |
| `SHOPIFY_CUSTOMER_ACCOUNT_AUTHORIZATION_ENDPOINT` | Shopify authorization endpoint | Server configuration |
| `SHOPIFY_CUSTOMER_ACCOUNT_TOKEN_ENDPOINT` | Shopify token endpoint | Server configuration |
| `SHOPIFY_CUSTOMER_ACCOUNT_LOGOUT_ENDPOINT` | Shopify logout endpoint | Server configuration |
| `SHOPIFY_SESSION_SECRET` | Encrypts My Pet Health login sessions | Server only |
| `ADMIN_EMAIL_ADDRESSES` | Comma-separated Shopify account emails allowed into `/admin` | Server only |

Secrets belong in `.env.local` locally and protected Vercel environment variables online. `.env.local` is ignored by Git.

## Knowledge base

The seven baseline reviewed entries are seeded into Supabase by [`supabase/migrations/202608170003_create_knowledge_entries.sql`](supabase/migrations/202608170003_create_knowledge_entries.sql). Staff can add, edit, draft, publish and delete every Q&A entry at `/admin`; published changes become searchable by Buddy immediately. Entries can also link reviewed All Good Petfood product URLs, which are resolved against the live catalogue and shown only when the customer asks for a relevant product. [`knowledge/entries.json`](knowledge/entries.json) remains an emergency read-only fallback if the managed table is unavailable or empty.

The admin editor can load the 29 records in [`knowledge/pethealth_knowledge_base.json`](knowledge/pethealth_knowledge_base.json) as review candidates. They always load unpublished and must be checked for medical accuracy, safety advice and useful search/product tags before publication. The larger email audit exports are not used at runtime.

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

Buddy is locked until Shopify Customer Account OAuth verifies the All Good Petfood customer. The protected server API derives ownership from that encrypted Shopify session and stores conversations under the Shopify customer ID. The Supabase secret key is never sent to the browser. If cloud storage is temporarily unavailable, the UI reports that the chat remains on the current device.

To enable chat persistence:

1. Put `SUPABASE_URL` and a new `SUPABASE_SECRET_KEY` in `.env.local` and protected Vercel environment variables.
2. In Supabase, open **SQL Editor**, paste [`supabase/migrations/202608160001_create_conversations.sql`](supabase/migrations/202608160001_create_conversations.sql), and run it once.
3. Restart the app, authenticate through All Good Petfood, and send a test message.

The migration enables Row Level Security, denies browser roles, and permits the server role only. Application endpoints first verify the encrypted Shopify session and constrain every database operation to its Shopify customer ID. Never place `SUPABASE_SECRET_KEY` in a variable beginning with `NEXT_PUBLIC_`.

## Stock enquiry emails

When Buddy has identified an exact out-of-stock product, it can ask the signed-in customer for consent to email All Good Petfood. The email is sent only after an explicit yes, uses the customer's Shopify email as `Reply-To`, and includes the confirmed product link and recent question context. Staff can reply to the customer directly from the inbox.

Run [`supabase/migrations/202608210001_create_restock_enquiries.sql`](supabase/migrations/202608210001_create_restock_enquiries.sql) once before enabling the feature. The server stores the enquiry audit fields needed to report whether and when it was sent. Duplicate requests for the same product are idempotent for the day, and each customer is limited to three new enquiries per 24 hours.

Configure `RESEND_API_KEY`, a domain-verified `RESEND_FROM_EMAIL`, and `RESTOCK_ENQUIRY_TO_EMAIL` locally and in Vercel. These values must remain server-only.

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

The chat route logs message length rather than message content, retrieved entry IDs, returned product IDs, response mode and sanitised error summaries. Stock enquiries record their status and send timestamp in Supabase; customer questions and email addresses are not written to application logs. The app never logs keys, and API keys are imported only by modules marked `server-only`.

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

The remaining work includes expanding reviewed knowledge, admin analytics and unanswered-question review, further production hardening, and the Shopify theme app extension. See [`ROADMAP.md`](ROADMAP.md).
