# Buddy process audit — 11 September 2026

Scope: current working tree, including existing uncommitted fixes. This is a source audit with local checks, not a production certification. No application code, live knowledge records, accounts, or deployments were changed during this audit.

## Outcome

The recurring failures have concrete causes across state handling, retrieval, model recovery, and response presentation. A stronger model alone cannot repair branches that return before calling it or product context that the application removes. Fix the message lifecycle before adding more product-specific response templates.

## Findings, ordered by priority

### 1. Product follow-ups clear the context needed for the next answer — high

Evidence: `src/app/api/chat/route.ts:1039` returns `resetProductContext: discoveryOnly || (!latestHasProductIntent && displayRecommendations.length === 0)`. `src/components/chat-widget.tsx:335` obeys that flag by removing product IDs. The next request reads only the most recent assistant's IDs (`route.ts:380`).

Sequence: pig-ear card → safety question → advice with no new card → product IDs cleared → Bob supplies the requested age/name/size → no referenced product to ground the assessment. The conversation text remains, but the structured product reference is lost.

Repair: store active topic/product IDs independently of card display, with an explicit pending question and supplied pet facts. Clear or replace the topic only on a real topic switch, rejection, or new conversation. Keep the same ephemeral state for guests without persisting it across visits.

### 2. Replies to Buddy's questions have no general resolution step — high

Evidence: route intent is repeatedly inferred from the latest message using independent expressions. `contextualNamedPetReply` accepts a one- or two-word name only; the full answer `Bob, corgi - medium size, about 5yrs old` returns null. `hasRecommendationContext` does not recognise `yrs`, and species recognition does not infer dog from Corgi. The profile parser and recommendation-context parser accept different age formats. The profile breed list also omits Corgi.

The existing size-search fix correctly makes Bob's sentence return false from `wantsProductSuggestion`; this does not establish that it answers a pending question. Another reproduced result: `His ears are itchy` is classified as shopping because it is short and contains `ears`.

Repair: resolve continuation and the pending question before classifying a new request. Share extraction of temporary pet facts across routing and profile handling. Distinguish unknown sensitivities from explicitly reported none. Product assessment must precede any optional profile-save prompt. Do not use a pet-name parser as the conversation controller.

### 3. Model exhaustion recovery repeats the constraint that caused failure — high

Evidence: `src/ai/assistant-service.ts:126` sets `maxOutputTokens: 900`. Regeneration calls the same generator with the same prompt and budget. The retry condition requires visible content, so an empty `MAX_TOKENS` response skips regeneration. There is no explicit thinking configuration or logging of input, thinking, and output token counts.

Google documents that thinking can consume the output allowance and produce empty or truncated output: [Gemini thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking). The earlier explanation that a long catalogue description necessarily consumed the *output* allowance was incomplete: prompt size and output budget are different constraints. Actual token metadata is needed to attribute each incident.

`needsContinuation` also treats terminal punctuation as a completion test. A valid response ending in a closing quote/parenthesis can be rejected, while a truncated response can end in punctuation. Finish reasons other than `MAX_TOKENS` are not systematically handled.

Repair: use model-compatible output/thinking settings; capture finish reason and token usage; retry empty exhaustion too; give recovery a materially different budget or compact input. Bound the whole request, including retries and external lookups. Use provider completion status rather than punctuation as the primary validity signal.

### 4. Local fallback changes the subject and repeats questions — high

Evidence: `src/ai/local-responder.ts` chooses symptom branches from all user text, counts two user turns as enough context, and otherwise returns the first knowledge summary plus stock follow-up questions. It does not resolve the assistant's pending question. A local replay of the Bob sequence returns a request for age/weight/current food despite the supplied age/size.

Historical symptom words can also override a new subject. Model failures consequently look like comprehension failures. `catalogue-claim-guard.ts` can replace an entire answer with another generic questionnaire based on broad negative-word matching.

Repair: fallback must receive the same resolved turn state as the model. Preserve verified facts and the active subject. When generation fails, acknowledge temporary inability to complete the assessment without claiming insufficient customer information or a catalogue miss. Avoid inventing clinical conclusions in emergency templates.

### 5. Knowledge relevance remains too weak and exact-copy can bypass the question — high

Evidence: `rankKnowledge` scores substring matches and accepts score >= 3, including three weak body matches or repeated query tokens. Managed entries win exclusively whenever any survive; stronger local entries are not ranked alongside them. `primaryApprovedKnowledge` selects any exact-copy entry in the results, even if another result better matches the question. `answerCustomer` returns that whole answer before generation.

The current uncommitted changes restrict exact copy to store information/product labels and remove generic terms; these help, but are not a topic gate. Adding a product title only when the latest message contains a pronoun does not resolve a reply such as Bob's. The health entry's broad allergy/yeast tags can still qualify it outside a grain/wheat comparison.

Repair: resolve the question first; rank local and managed evidence together with provenance, relevance and applicability. Gate grain/wheat comparison guidance to that subject or a relevant product attribute question. Operational exact copy should require an explicit matching intent and must not swallow other parts of a multipart question. Keep evidence retrieval separate from permission to recommend products.

### 6. Guest capability detection blocks normal advice; failure copy promises retention — high

Evidence: `guest-access.ts` matches `my pets?` and bare `remember`. Local replay confirms `Is this suitable for my pet?` triggers the account gate before normal answering. `chat-widget.tsx:359` says the conversation is saved on errors, including guest sessions. Global prompt instructions offer team email even though guest instructions disallow it; the direct catalogue no-match branch also offers email without checking guest mode.

Positive: guest persistence returns early, and the inspected pets/conversations endpoints require authentication. These boundaries should be preserved.

Repair: gate requested actions, not ordinary mentions of pets or conversational memory. Derive all UI, deterministic replies and prompt capabilities from the same account capability object. Guest error copy must accurately describe temporary session-only chat.

### 7. Local chat fallback is not scoped to the account — high privacy risk

Evidence: `local-storage-store.ts` uses one global storage key. On authenticated mount, `chat-widget.tsx:171` loads every local conversation and uploads it into the current account. Locally cached account A conversations can therefore be imported into account B on the same browser after a cloud-save failure. Backend conversation queries are customer-scoped; the flaw is the client migration boundary.

Repair: namespace local fallback by a verified account identity and refuse automatic migration of unowned legacy records. Test sign-out/sign-in with two accounts and an offline interval. Also test session expiry while the UI still thinks it is authenticated.

### 8. Catalogue outage and absence are indistinguishable — high

Evidence: `ShopifyProductService.products()` catches failures and returns `[]`; `searchProducts` similarly catches errors into an empty result. Route replies can then imply no in-stock match when Shopify was unavailable. No explicit fetch abort deadline exists in the inspected catalogue paths; pagination and multiple lookups can compound latency. Public data is cached for five minutes, so stock is a cached snapshot rather than a checkout guarantee.

Repair: return typed lookup status: success with results, success without results, unavailable, and incomplete. Propagate status to answer generation and display. Bound requests and deduplicate catalogue loads within a turn. Preserve product facts when stock checking fails, while marking availability unverified.

### 9. Product facts rely on a one-product override and unsafe text matching — high

Evidence: `verifiedPackageFacts` hard-codes PancreaCare's tags and Fish meal; other products generally have empty structured ingredient arrays. The model receives only the first 450 description characters and no variant details in its product text. `namedProductFactsReply` uses positive substring tests: `not grain-free` still contains `grain-free`, and `non-hypoallergenic` contains `hypoallergenic`. Generic `safe for` questions enter the small-breed answer branch. Finding an ingredient is not sufficient to determine its predominance or the full recipe.

Repair: maintain structured, source-attributed product facts and explicit true/false/unknown values. Include relevant complete ingredient/variant fields rather than slicing off potentially decisive facts. Keep nutritional life stage, physical chew/kibble size and individual contraindications separate. Test negated claims and conflicting label/description data.

### 10. Clinical policy and stored claims need editorial correction — high

Evidence: `system-prompt.ts:20` categorically forbids Buddy from recommending a vet, including urgent situations. Local symptom responses also defer referral to the shop. The grain/wheat migration contains an unsupported 99% claim, a `cleanest` hierarchy, and yeast-based dietary preference. Store-owner attribution does not validate a medical statistic. The colour-label seed also treats a marketing designation as universal allergy safety.

The [Merck Veterinary Manual](https://www.merckvetmanual.com/integumentary-system/food-allergy/cutaneous-food-allergy-in-animals) lists multiple common food allergens and describes diagnosis through dietary investigation; it does not establish the supplied 99% claim. [Tufts veterinary nutrition guidance](https://now.tufts.edu/2017/04/10/grain-free-diet-healthier-my-dogs-and-cats) does not support grain-free as inherently healthier. These are content-review findings; no live entry was edited.

Repair: allow direct urgent veterinary escalation for red flags; distinguish ordinary shop guidance, verified label facts, and clinical evidence. Review/remove unsupported numerical and universal safety claims. If a seed has already run, use a new corrective migration: editing an insert with `on conflict do nothing` will not update existing rows.

### 11. Request limits, diagnostics and conversation retention need hardening — medium/high

Evidence: the public chat route accepts up to 40 messages at 12,000 characters each, with unbounded product-ID array size/string length. No chat rate limiter was found in source; external hosting controls were not inspected. The request does not enforce a final user message or valid role sequence. Provider calls have individual timeouts, but no overall workflow deadline or token budget for conversation history.

The UI sends the last 40 messages, while cloud persistence accepts at most 100 total messages. Long signed-in conversations therefore eventually fail cloud saving and fall back locally. `persist()` runs before the send try/finally; a failed cloud save followed by local-storage failure can leave loading stuck before the model request starts.

Logs identify knowledge/product IDs and final mode, but not the resolved intent, pending question, context-reset reason, retrieval scores, or token usage. Pet-profile logs include names, which should be considered when describing privacy/retention.

Repair: validate aggregate payload and role order; add guest/account usage controls and overall deadlines; implement rolling context plus explicit state; align retention limits; ensure persistence failures never block chat cleanup. Log structured decisions and performance metadata without chat bodies or unnecessary pet identifiers. Audit hosting/provider retention separately before promising that no guest data is retained anywhere.

## Verification performed

- `npm.cmd test`: 16 test files, 68 tests passed.
- `npm.cmd run typecheck`: passed.
- Read-only execution of current helpers reproduced the guest `my pet` false positive, rejected compound Bob name, generic fallback, and `His ears are itchy` shopping false positive. It also confirmed that the existing Bob-size shopping fix works in isolation.
- Source trace of the browser/server state contract establishes the product-ID reset described above.
- Current tests mock out model access in assistant-service tests and do not exercise the complete chat route/browser lifecycle or token-exhaustion recovery.
- No live model, Shopify write, Supabase write, customer email, deployment, or production conversation replay was performed. Existing uncommitted work was preserved. Production environment settings, hosting controls, provider retention and full OAuth round-trip behaviour remain unverified.

## Repair sequence and acceptance criteria

1. Add a resolved-turn object with active product, pending question, temporary pet facts, topic-change decision and account capabilities. Separate card display from context retention. Verify pig ears → safety → Bob details → missing sensitivity answer in guest and signed-in sessions, with no repeated age/name question.
2. Repair model budgeting and fallback. Mock STOP, empty/nonempty MAX_TOKENS, blocked output, timeout and fallback-model failure. Assert that recovery preserves the subject and accurately reports generation failure.
3. Correct guest gates, local account ownership and persistence failure cleanup. Verify general advice without sign-in, excluded account/cart actions, refresh without guest chat restoration, two-account isolation, expired sessions and storage failures.
4. Separate knowledge relevance, product facts, catalogue status and clinical policy. Verify PancreaCare spellings and multipart facts, grain versus wheat distinction, negation, unrelated grain guidance exclusion, out-of-stock versus service failure, and urgent symptom escalation.
5. Add route-level conversation tests using the actual response fields the browser forwards, plus a small browser suite. Include genuine topic switches so preserving context does not make old products dominate new questions. Add structured diagnostics before a controlled live acceptance run.

Completion should mean these conversational behaviours pass as sequences, including forced provider failure. Individual keyword tests alone are insufficient.

## Repair implementation status

Implemented in the working tree after the audit:

- Explicit resolved-turn context, pending-question recognition and product continuity independent of new cards; compound pet-name replies accepted; symptom wording no longer automatically becomes an ear-product search.
- 4096-token generation allowance with 8192-token exhaustion recovery, including empty responses; provider finish status replaces punctuation checks; metadata logging and bounded generation retries. Generation failures no longer fall through to unrelated health templates.
- Account-scoped local chat fallback, no automatic import of unowned legacy records, accurate connection-error copy, storage-failure cleanup, cloud-call timeout and a higher history limit (2000 messages).
- Narrowed guest action gates, guest-safe catalogue failure copy, and direct urgent-care handling. Product context is preserved through catalogue outages.
- Deduplicated whole-token knowledge scoring, a grain/wheat subject gate, combined managed/local ranking and primary-only exact-copy selection. Diet/colour corrective SQL is in `202609110002_correct_diet_claims.sql`.
- Catalogue fetch deadlines and propagated availability errors; larger description/ingredient context and explicit variants in model grounding; negated grain-free/hypoallergenic checks and narrower breed-size fallback handling.
- Payload and product-ID limits, per-process burst protection, and decision logging without pet names.
- New route conversation-contract tests, token-exhaustion tests and account-isolation tests.

Deployment and validation limits: apply the corrective migration to update existing database entries. These changes have not been deployed or exercised against live customer accounts. The burst limiter is per process; production-wide quotas require gateway/distributed controls. The 2000-message retention cap is still finite. Product ingredient provenance remains dependent on catalogue content and the existing package transcription; missing facts remain unknown. Full browser/OAuth/session-expiry and live provider acceptance checks remain necessary before claiming production certification. Legacy unowned local storage has been left intact, but is deliberately no longer auto-imported.
