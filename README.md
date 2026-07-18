# Neev — Agentic Identity Reconstruction

Neev is a deployable bilingual (English/Hindi) case application that turns fragmented identity evidence into a guarded, official-source pathway. It asks deterministic questions with normal controls and calls an LLM only for unstructured answers, document understanding, case chat, or a rule gap.

> Neev is decision support, not a government portal or legal authority. Every pathway includes an official source and requires the user to verify the current rule with the competent office.

## What works

- Account ID/password access with salted PBKDF2 hashes, secure session cookies, multiple resumable cases, and unique case IDs.
- Adaptive interview controls: yes/no, date picker, multi-select, lists, text and optional browser-native Hindi/English speech input/output.
- Private PDF/image upload to R2; case and document metadata in D1.
- Gemini-first multimodal document parsing with Groq fallback and automatic rotation across 2–3 comma-separated keys on quota/auth errors.
- Conservative structured output for visible fields, signature/stamp presence, confidence and review notes. Nothing is silently accepted: the user confirms every extraction.
- Lightweight evidence graph functions for fuzzy entity matching, conflict detection and confidence resolution. This replaces a graph database until the volume actually requires one.
- Structured official-rule retrieval seeded with current UIDAI, Civil Registration System and Bihar ServicePlus sources; unknown services use a clearly marked one-path AI fallback.
- LangGraph orchestrator: retrieve rules → plan dependencies → verify links/claims → dispatch document, appointment and submission outputs.
- Locked dependency planner: completing one step unlocks only the immediate next step.
- Bilingual case assistant grounded in visible case data.
- Downloadable English/Hindi draft affidavit PDF with a mandatory review warning.
- Official centre/service links and a submission checklist. The appointment agent explicitly declines booking when no reliable free API exists.

## Lean architecture

```text
Voice/text interview
        ↓
Case facts + private uploads
        ├── Multimodal document parser
        └── Evidence resolution (fuzzy matching/conflicts)
                        ↓
Structured official-rule retrieval
                        ↓
LangGraph dependency planner + link verification
                        ↓
PDF draft | centre locator | checklist | guarded next action
```

NetworkX/Neo4j and a vector database are intentionally absent. The MVP has small, structured evidence and rule collections, so a relational model plus tested graph functions is simpler, free, and easier to deploy. Add a dedicated graph/vector store only when cross-case scale or semantic retrieval makes it necessary.

## Local setup

Requirements: Node.js 22.13+.

1. Copy `.env.example` to `.env.local`.
2. Add two or three comma-separated Gemini keys; optionally add Groq keys as fallback.
3. Install and run:

```bash
npm ci
npm run dev
```

Never expose API keys through `NEXT_PUBLIC_` variables. Uploaded identity documents are sensitive; use only server-side secrets and a private bucket.

## Recommended free AI configuration

Use Gemini for document/PDF vision and structured extraction, with Groq for fast text fallback. Model names are environment-configurable because free-tier catalogs change. The checked defaults are `gemini-2.5-flash-lite` and `meta-llama/llama-4-scout-17b-16e-instruct`; verify provider availability before production use.

```env
GEMINI_API_KEYS=first_key,second_key,third_key
GEMINI_MODEL=gemini-2.5-flash-lite
GROQ_API_KEYS=first_key,second_key
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

When a provider returns an authentication/quota response, Neev tries the next key and then the fallback provider. It does not retry unchanged requests indefinitely.

## Data and security

- D1: accounts, sessions, cases, document metadata, structured extraction and plans.
- R2: original document bytes, namespaced by account and case.
- Passwords: PBKDF2-SHA256 (120,000 iterations) with a random salt; raw passwords are never stored.
- Sessions: random tokens; only SHA-256 token hashes are stored; cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Trust boundaries validate IDs, file type, file size, ownership and model output.
- PDF/image uploads are limited to 8 MB each.

For a high-scale public service, replace account-ID/password access with a managed identity provider, add malware scanning, retention/deletion controls, audit logging, consent records, rate limiting, and an independent security/legal review.

## Official rule sources included

- UIDAI supporting-document schedule and enrolment guidance: `uidai.gov.in`
- Civil Registration System delayed-registration guidance: `dc.crsorgi.gov.in`
- Bihar residence-certificate services: `serviceonline.bihar.gov.in`
- Aadhaar centre locator: `bhuvan.nrsc.gov.in`

Each rule stores its source URL and last-reviewed date. This repository does not claim that a cached rule remains current forever; update and re-review the rule entries in `lib/rules.ts`.

## Tests

```bash
npm run test:domain
npm run lint
npm test
```

The small domain suite checks fuzzy identity matching, conflict resolution, sequential unlocking and official-rule retrieval. The production build also validates the Cloudflare Worker artifact.

## Deployment

The project targets Cloudflare Workers with D1 and R2 bindings declared in `.openai/hosting.json`. API secrets must be configured as hosted environment secrets before a new deployment. The same code can be adapted to Cloudflare's free tier; Vercel can host the interface, but the D1/R2 integration would need replacing.

## Known limits

- Seeded legal knowledge currently covers national Aadhaar/delayed-birth guidance and a Bihar residence flow, not every service in every state.
- The fallback planner is explicitly marked AI-generated and cannot verify an invented/local fact.
- Exact Gram Panchayat/Tehsildar addresses are shown only when a trustworthy official locator supplies them.
- No automatic appointment booking or reminders in the free MVP.
- OCR/model confidence is advisory; users must confirm extracted facts.
- Draft affidavits require review by the competent authority/notary before use.

## Licence

MIT. Government documents remain subject to their source terms; the MIT licence applies to this software, not third-party content or government marks.
