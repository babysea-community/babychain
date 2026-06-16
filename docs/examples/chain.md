# Chain Example

Create every BabyChain generation run through one route:

```bash
curl --request POST \
  --url https://your-app.example.com/api/v1/chains/runs \
  --header 'Authorization: Bearer bchn_live_xxx' \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: run_2026_06_01_001' \
  --data '{
    "input": {
      "chain_models": {
        "image_model": "bytedance/seedream-4.5",
        "video_model": "bytedance/seedance-1.5-pro"
      },
      "image_model_input": {
        "generation_prompt": "A clean product scene on a neutral surface."
      },
      "video_model_input": {
        "generation_prompt": "Move the camera slowly around the generated frame.",
        "generation_duration": 5
      }
    },
    "webhook_url": "https://api.example.com/babychain/callback",
    "metadata": {
      "trace_id": "launch-demo"
    }
  }'
```

When the run starts from an uploaded image, include that image inside the first model input object:

```json
{
  "input": {
    "chain_models": {
      "image_model": "bytedance/seedream-5-lite",
      "video_model": "bytedance/seedance-1.5-pro"
    },
    "image_model_input": {
      "generation_prompt": "Refresh the input image into a crisp launch visual.",
      "generation_input_image_file": ["https://example.com/image.png"]
    },
    "video_model_input": {
      "generation_prompt": "Create a restrained product reveal with smooth camera motion.",
      "generation_duration": 5
    }
  }
}
```

Add `refine_model` when one generated image should feed a second image model before video:

```json
{
  "input": {
    "chain_models": {
      "image_model": "bfl/flux-1.1-pro",
      "refine_model": "bytedance/seedream-5-lite",
      "video_model": "bytedance/seedance-1.5-pro"
    },
    "image_model_input": {
      "generation_prompt": "A clean product scene on a neutral surface."
    },
    "refine_model_input": {
      "generation_prompt": "Refine the frame with sharper material detail."
    },
    "video_model_input": {
      "generation_prompt": "Move the camera slowly around the refined frame.",
      "generation_duration": 5
    }
  }
}
```

Queued response shape:

```json
{
  "id": "run_123",
  "object": "chain_run",
  "chain_slug": "chain",
  "status": "queued",
  "input": {
    "chain_models": {
      "image_model": "bytedance/seedream-4.5",
      "video_model": "bytedance/seedance-1.5-pro"
    },
    "image_model_input": {
      "generation_prompt": "A clean product scene on a neutral surface."
    },
    "video_model_input": {
      "generation_prompt": "Move the camera slowly around the generated frame.",
      "generation_duration": 5
    }
  },
  "steps": [
    {
      "step_key": "image",
      "step_kind": "image",
      "status": "queued"
    },
    {
      "step_key": "video",
      "step_kind": "video",
      "status": "queued"
    }
  ],
  "timeline": [
    {
      "object": "chain_run_timeline_event",
      "step_key": "image",
      "step_kind": "image",
      "status": "queued",
      "depends_on": []
    },
    {
      "object": "chain_run_timeline_event",
      "step_key": "video",
      "step_kind": "video",
      "status": "queued",
      "depends_on": ["image"]
    }
  ]
}
```

Poll the run with `GET /api/v1/chains/get/{runId}` or wait for the signed final callback. The `timeline` array mirrors the ordered step lifecycle and adds timing, provider, output count, and error fields as they become available.
