# Local historical email processing

This pipeline converts a local MBOX into anonymised, reviewable My Pet Health knowledge. It is deliberately separate from the chatbot runtime and uses only the Python standard library.

## Non-negotiable safety properties

- The source MBOX is opened for reading only and its size/modified timestamp are checked after processing.
- The complete mailbox is never loaded into memory; messages are processed incrementally.
- Raw bodies exist only briefly in process memory. Only cleaned, sanitised text is written to the local SQLite working database.
- No OpenAI, Gemini, Supabase, Shopify or other network API is called.
- Raw MBOX files, `.eml` files, local configuration, working databases, generated outputs and logs are ignored by Git.
- Logs contain counts, message indexes and error types—not message content.
- Candidates with schema, ambiguity, medical-claim, product-name or privacy concerns are held out of `knowledge.json`.
- Generated knowledge cannot enter the chatbot until a human explicitly runs the approval command.

## Configure

`config.json` is local and ignored by Git. It currently identifies `allgoodpetfood.co.nz` as the business domain. Review it before processing and add any historical business addresses or domains that appear in the export:

```json
{
  "business_domains": ["allgoodpetfood.co.nz"],
  "business_addresses": ["historical-address@example.co.nz"]
}
```

Do not add customer addresses. Update `known_products` with legitimate historical product names to improve product matching.

## Required 100-message preview

From the project root:

```powershell
python email-processing/process_mbox.py `
  --input "C:\path\to\mailbox.mbox" `
  --limit 100
```

Generated preview files are local and ignored:

```text
email-processing/output/preview/
  knowledge.json
  knowledge/*.md
  review_required.json
  privacy_audit.json
  product_mentions.json
  processing_report.md
```

Stop after this command. Review the Markdown and all JSON reports before authorising a full run.

## Resume

The SQLite database and `checkpoint.json` live under ignored `working/`. Resume the latest interrupted run with:

```powershell
python email-processing/process_mbox.py --resume
```

The processor skips completed message indexes and deduplicates stored messages by a one-way source hash.

## Full run—only after explicit preview approval

```powershell
python email-processing/process_mbox.py --input "C:\path\to\mailbox.mbox"
```

Do not run this until the preview has been reviewed and explicitly approved.

## Human-reviewed chatbot import

Even clean generated entries are not automatically trusted. After reviewing privacy, accuracy, product identities, conflicts and safety wording, import a reviewed file with:

```powershell
python email-processing/approve_knowledge.py `
  --input email-processing/output/full/knowledge.json `
  --confirm-reviewed
```

This writes only transformed, approved records to `knowledge/email-derived.json`. The chatbot reads that file at runtime. Product names remain historical references until they are deliberately mapped to current Shopify products.

## Tests

All fixtures are synthetic:

```powershell
npm run email:test
```

Tests cover MIME parsing, HTML conversion, quoted replies, signatures, email addresses, phone numbers, names/addresses, sender roles, duplicate detection, schema validation and read-only MBOX access.

## Limits of local rule-based extraction

Name and address detection is intentionally conservative but cannot guarantee perfect entity recognition. That is why there is a second privacy audit and mandatory human review. The extractor preserves sentences from historical business replies instead of asking a model to invent polished advice. Ambiguous results are assigned lower confidence or sent to review.

An optional model-assisted stage may be added later, but it must be disabled by default and may receive only already-sanitised text after explicit approval.
