# Chain Agent RAG Plan

BabyChain does not need an AWS Bedrock Knowledge Base for the first durable Chain Agent path.

## Current Grounding

The Chain Agent is grounded by runtime context that BabyChain already owns:

- The previous generated media, passed directly to Amazon Nova as image/video input when it is available as a data URL or HTTPS provider URL.
- The original run input JSON.
- The previous step request params.
- The downstream step model identifier and BabyChain role.
- The downstream Semantic Lady schema filtered for chain-safe fields.

This is enough for Review and Autopilot prompt planning because the agent task is local to the active chain run, not broad knowledge retrieval.

## Future AWS Work

No AWS Knowledge Base is required now.

Consider a Bedrock Knowledge Base later only if Chain Agent needs durable product/brand/style memory, user-uploaded creative briefs, or organization-specific prompt rules across runs. In that case, create a knowledge base in Bedrock, attach a vector store, ingest approved brand/style documents, and expose retrieval as a separate agent dependency rather than mixing it into media providers.

## Guardrails

- Do not let retrieved documents override BabyChain safety, schema, or media-handoff rules.
- Keep retrieved text outside provider credentials and callback fields.
- Cite internal source ids in checkpoint output if RAG is added later.
