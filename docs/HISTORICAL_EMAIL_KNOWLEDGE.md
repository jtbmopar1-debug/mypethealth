# Historical email knowledge pipeline

This is a design for a later phase, not an email importer.

## Goal

Turn useful patterns from past customer-service emails into reviewed, anonymous My Pet Health knowledge. Raw emails should never be placed directly in the assistant prompt or copied into the knowledge base.

## Proposed process

1. Export only the messages approved for this purpose into a restricted processing environment.
2. Remove names, addresses, email addresses, phone numbers, order IDs, payment details, free-text signatures and other identifiers before AI processing.
3. Group genuinely similar questions and situations. Do not create one permanent record per customer.
4. Extract a draft structured entry.
5. Have an authorised My Pet Health team member review accuracy, product claims and safety wording.
6. Publish only approved entries to the knowledge store; retain provenance and review dates outside customer-identifying data.
7. Periodically disable or revise entries when products, policies or guidance change.

## Draft entry shape

```yaml
id: stable-non-customer-id
customer_question: "An anonymous, generalised question"
situation: "The recurring situation"
useful_context:
  - "Context that materially changes the guidance"
follow_up_questions:
  - "A natural question the team usually asks"
all_good_guidance: "Reviewed practical guidance"
relevant_products:
  - "shopify-product-id-later"
reasoning: "Why this guidance is useful"
safety_notes:
  - "When veterinary care or other escalation is appropriate"
tags:
  - digestive-issues
status: draft
reviewed_at: null
```

## Privacy rules

- No name, address, email, phone number, order ID, payment data or customer identifier belongs in an entry.
- Generalise rare combinations that could re-identify a person.
- Keep raw-email access separate from the application and restrict it by role.
- Record consent, retention and deletion policies before importing production data.
- Human review is required before publishing extracted advice.

In Phase 3, the `KnowledgeService` can be backed by Supabase/Postgres and vector search while preserving the current `search`, `getById` and `listEnabled` application contract.
