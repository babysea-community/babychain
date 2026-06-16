# Changelog

All notable changes will be documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Updated the BYOK schema source to `semantic-lady@0.4.2`, including published provider model ids and corrected provider defaults for direct BYOK routing.
- Removed BabyChain's hand-maintained model schema catalog and provider-side size/ratio conversion tables; model fields, defaults, enums, and provider model ids now come from Semantic Lady.
- Renaming a workspace flow that already has a Library card now updates that saved canvas title immediately by using the flow's persisted Library canvas id.
- Added a Duplicate button to each workspace runner card so users can clone a flow's current models and inputs into a new unsaved flow without overwriting the original Library card.
- Canvas node cards now expose the selected model's Semantic Lady fields more completely, preserve documented defaults, and render numeric enums or small bounded integer ranges as dropdowns instead of free number inputs.
- Each canvas model node now includes a collapsible JSON Schema view for the effective node inputs, matching the schema inspection pattern used on the templates page.
- Each canvas flow now includes a separate API card in the final utility column beside the runner controls, using the current flow input and the same scroll-safe highlighted request styling.
- Library canvas cards now show the real `run_id` above the Canvas ID and Created metadata; canvas API and runner cards stay focused on requests and controls.
- Canvas media previews now use dashboard-session output links for inline provider media, keeping API responses clean while preserving browser image/video rendering.
- The templates page curl examples and schema section now use the same Semantic Lady `generation_*` request contract as the run API and canvas node cards.
- Canvas API requests and template curl examples now share one request-shape builder, use schema defaults exactly as published by Semantic Lady, omit no-default fields instead of inventing `null` or empty strings, and only use empty arrays for BabyChain's normalized input file fields.

### Added

- Added authenticated run-output URLs under `GET /api/v1/chains/get/:runId/outputs/:stepKey/:outputIndex` and dashboard preview URLs under `/api/dashboard/chains/get/:runId/outputs/:stepKey/:outputIndex` so inline provider media can be fetched separately without embedding base64 payloads inside run JSON.

### Fixed

- `GET /api/v1/chains/get/:runId`, create-run responses, and terminal callbacks no longer serialize provider `data:*;base64,...` outputs directly in `generation_output_file`; inline media is returned as clean authenticated output URLs while normal provider URLs stay unchanged.
- Removed duplicated local schema-example builders from the canvas and templates page so JSON Schema display, cURL examples, and run payloads all use the same Semantic Lady-backed request shape.
- Backend run creation now strips legacy empty full-shape cURL placeholders from no-default model inputs before provider submission while preserving real model defaults such as `""`, `null`, `false`, and numeric defaults.

## [0.1.1] - 2026-06-13

### Changed

- Added Font Awesome Kit integration for Kit `1b8aa472ce`, including the root Kit script, CSP allowlist entries, a local Font Awesome icon wrapper, and `.font-awesome.md` project guidance.
- Replaced all `lucide-react` UI glyphs with Font Awesome Kit-backed icons. Custom inline BabyChain, provider, model, host, and Git icons remain unchanged.
- The homepage chain-template grid now keeps the same search and pagination UI while loading cacheable catalog pages from a small server route, so the marketing page no longer serializes all 78k+ template entries into the initial client payload.
- The Font Awesome SVG+JS kit now loads after page load and nests generated SVGs to avoid pre-hydration DOM mutation on dashboard pages.
- The canvas now guards schema-normalization and info/runner reconciliation updates so React Flow measurement changes do not trigger no-op `setNodes` repair cycles.
- Canvas autosave now uses a monotonic save version stored in Aurora, so older in-flight autosaves cannot overwrite newer pagehide, reset, or saved-canvas snapshots.
- Starting a run from the workspace now persists the workspace row before creating the run, so run tracking can be recorded and resumed after reload, logout/login, or a fast navigation even if the autosave interval has not fired yet.
- Workspace "Run and save" now reuses each flow's Library canvas id after the first publish, so later publishes update the same Library card instead of creating duplicates.
- Compact canvas action icons now center inside their square hover targets after the Font Awesome conversion.
- Updated the BYOK schema catalog to `semantic-lady@0.2.2`, including documented Z-Image `7:9`/`9:7` ratios and BytePlus multimodal reference media roles.
- The fresh Aurora schema no longer includes API-key rate-limit metadata because request limiting is handled by BabySea mode through the BabySea SDK and by provider inference limits in BYOK mode.

### Removed

- Removed the Upstash-backed BabyChain API rate limiter, the `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` environment variables, related deploy/docs/template references, and `@upstash/ratelimit` / `@upstash/redis` dependencies.
- Removed the obsolete private `babychain_private.api_key.rate_limit_per_minute` column from the configured database and from the fresh schema.
- Removed the `lucide-react` dependency after replacing its remaining usages.

## [0.1.0] - 2026-06-09 - INITIAL RELEASED

### Added

- Every flow starts with a `canvas_flow` info card carrying an editable canvas name (pencil to rename, 50-character limit); the name becomes the Library title on publish, and renaming on a saved canvas page updates the Library immediately. "Run and save" on the workspace mints a new canvas id per publish, so one lab flow can be published many times as separate Library canvases; on a saved canvas page it republishes the same canvas in place. The runner card explains both behaviors before the buttons.
- `image_model` cards now accept a starting image (`generation_input_file`, HTTPS URL) for image-to-image-capable models, matching the run API contract; the field carries across model switches and is stripped from chain-wired steps.
- Stop now cancels the run server-side (`POST /api/v1/chains/cancel/:runId`), so stopped chains no longer keep processing or spending provider credits; canceled step statuses paint onto the cards.
- Dashboard-wide loading state and a recoverable error boundary (transient Aurora/network failures show a retry screen instead of the framework error page).
- The canvas is now a permanent multi-flow workspace: "Add canvas flow" drops a fresh image → video chain onto the canvas, and every flow ends in a dedicated runner card wired after its last model card ("Run only" runs in place; "Run and save" also snapshots that flow into the Library and attaches the run to it). Hovering a card's connection edge reveals "+ refine_model" / "+ modify_model" to extend that flow, and the runner card follows automatically. The workspace persists in Aurora per owner — it survives reloads, navigation, logout/login, and device switches — and only the explicit "Reset canvas" action clears it. In-progress runs resume per flow after a reload.
- Canvases are now persisted in AWS Aurora (PostgreSQL) scoped to the dashboard owner, so saved canvases survive logout, browser resets, and device switches. Saved canvases autosave (debounced) while editing; unsaved drafts keep a localStorage crash buffer until the first save.
- Running a chain now saves the canvas automatically and links the run to the canvas; opening the canvas from the Library resumes live run tracking and restores finished outputs. When clicked, the Run button triggers an automatic save and displays a toast notification to confirm the canvas was persisted; the manual Save button was removed. The browser URL never changes — the run keeps streaming into the page you are on.
- Library cards now show every succeeded step output of the latest run (up to 4, in chain order) in a fixed two-row results grid, with a truncated 50-character title, a single Canvas ID / Nodes / Updated meta block, and fixed-height horizontal provider/model badge rows so all cards align.
- The Library now lists canvases from Aurora and supports deleting a canvas (with confirmation).
- New `babychain_private.canvas` table (owner-scoped, jsonb node graph, touch trigger, recency index) with per-owner limits: 200 canvases, 24 nodes, and 64 KB of node JSON per canvas.
- Adopted the `semantic-lady` SDK as the `generation_*` schema core for BYOK mode across all 57 supported models.
- BYOK run creation now validates `generation_*` fields in step model inputs against the Semantic Lady model schema (unknown fields, enum values, numeric ranges, and types fail fast with a `400` and a field path).
- `GET /api/v1/models/{model}` now returns the Semantic Lady `byok_schema` block (source, provider model id, workflows, and unified `generation_*` fields), and model summaries advertise `has_byok_schema`.
- Chain step roles (`image_model`, `refine_model`, `video_model`, `modify_model`) are now gated by Semantic Lady model kinds and workflows: image steps require image models, refine steps require `image-to-image` models, video steps require prompt-driven `image-to-video` models, and modify steps require prompt-driven `video-to-video` models. Wrong-role selections fail fast with a `400` and the offending field path.
- The first image step now also requires a `text-to-image` capable model when no starting image is provided; edit-only models (for example `runway/gen-4-image-turbo`) are rejected up front instead of failing at the provider after credits are spent.
- `pnpm aurora:seed-demo` seeds three demo canvases (owner-scoped) for product demos and judging.

### Changed

- Saved canvases are structure-locked: refine/modify cards cannot be removed and steps cannot be added on a canvas page — values stay editable and re-runnable; structure changes happen in the workspace lab. Removing flows in the lab never touches published canvases (snapshot semantics).
- All page errors now surface as toasts (sonner) instead of inline header text; the Toaster is mounted once for the whole dashboard.
- The templates page no longer ships the precomputed combination matrix (≈79k entries, ≈98 MB of props) — the selected combination is synthesized client-side, fixing missing curl/schema rendering for refine/modify selections and making the page load instantly. The modify dropdown is filtered per selected video model.
- The Library is ordered by creation time (stable — renames and autosaves never reorder cards), shows a Created date, and canvas cards can be renamed inline (pencil, 50-character limit).
- Node-card accent colors use a pastel palette (`#67e8f9` image, `#f9a8d4` refine, `#fdba74` video, `#c4b5fd` modify); destructive actions (Reset canvas, Remove this flow) use a proper destructive button variant.
- Canvas persistence moved from localStorage to Aurora; the canvas page loads saved canvases on the server and unknown canvas ids redirect back to a fresh canvas. Canvases saved before this change are not migrated.
- Removed the unused `app/dashboard/studio` canvas duplicate.
- BYOK mode no longer forwards arbitrary model input keys to providers. Model input objects accept Semantic Lady `generation_*` fields only, with `generation_provider_order` kept as the BabySea provider-order control.
- Removed the hand-maintained `chainRole` catalog field and the raw-schema image-input walker; step-role and image-input capability now derive from the Semantic Lady catalog so the model catalog cannot contradict the published schema.
- `bytedance/seedance-2.0` and `bytedance/seedance-2.0-fast` are now selectable as `modify_model` (Seedance 2.0 accepts reference video input); video URL handoffs map to BytePlus `video_url` reference content items.
- The Google data-video handoff guard now also covers BytePlus modify models (public video URLs required).

### Fixed

- Workspace autosave is now loss-proof: edits mark the canvas dirty and a steady 1.5-second flush persists them to Aurora, with a `sendBeacon` final flush on tab close, reload, navigation, and tab-hide (new owner-authenticated `POST /api/workspace` route). The previous debounce-based autosave silently dropped the last burst of edits — added flows and prompts typed just before a refresh were lost. Hydration also now runs exactly once per mount so router refreshes can never reset live canvas state.
- Removed placeholder sample prompts from new canvas flows and template run examples; prompts start empty.
- Canvas node cards are now generated from each model's Semantic Lady schema (exact fields, enum options, numeric ranges, and defaults) instead of a shared generic field list, so the UI can no longer offer fields a model does not support (for example `generation_resolution` on `runway/gen-4-turbo`) or out-of-range values (for example 1s durations). Stale values from previously saved canvases are pruned against the active model's schema on load.
- Provider adapters now submit explicit Semantic Lady fields directly instead of synthesizing provider sizes or ratios inside BabyChain.
- Permanent OpenAI quota errors (`Limit 0` / `insufficient_quota` / billing 429s) now fail the step immediately as `provider_quota_exceeded` instead of being retried forever as transient rate limits, which previously left runs stuck in `queued`.
- When a chain step fails, downstream queued steps are now marked `skipped` immediately (their input can never arrive) instead of being left `queued` forever, and the canvas shows a toast with the provider's error message when a run fails.
- Canvas and Library media previews no longer crop portrait outputs (`object-contain` instead of `object-cover`) and show a spinner with "Loading…" until the image or video has actually loaded, instead of flashing raw alt text when a provider URL is slow or expired.
