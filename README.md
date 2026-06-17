# OpenRouter Chat PWA

A mobile-first ChatGPT-style Progressive Web App for iPhone, built with Next.js 16 App Router, TypeScript, React 19, Tailwind CSS v4, the Vercel AI SDK, and `@openrouter/ai-sdk-provider`.

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` if you want to set the public site URL used in OpenRouter attribution headers:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Chat uses the OpenRouter API key saved in the app Settings screen. `OPENROUTER_API_KEY` is not used for normal chat requests. The key is sent only to local Next.js route handlers, then forwarded server-side to OpenRouter.

## Settings

Settings uses a guided four-section layout with mobile-friendly segmented navigation. Advanced web tool, multimodal, and caching controls are collapsed by default.

- Setup: add, validate, save, or remove the local OpenRouter API key. Validation calls `POST /api/key/status`, which forwards the key to `https://openrouter.ai/api/v1/key`.
- Model: search current OpenRouter models, pick OpenRouter router shortcuts, choose suffix variants, type a custom model id, and edit the system prompt and temperature. Model search is powered by `GET https://openrouter.ai/api/v1/models` through `app/api/models/route.ts`, cached in memory for 60 seconds, and capped to 40 returned models.
- Model also includes reasoning controls and provider routing. Reasoning supports effort levels from `xhigh` through `none`, optional reasoning exclusion, provider sort (`default`, `price`, `throughput`, `latency`), and a data-collection deny filter.
- Tools: enable OpenRouter Web Search, Web Fetch, Datetime, Multimodal image/PDF options, Auto compression, and Response caching. Web Search and Web Fetch are off by default and may add tool/provider costs.
- Data: export all threads as JSON, export the current thread as Markdown, import previously exported JSON threads, clear only the active chat thread, or reset settings. Destructive clear/reset actions require confirmation.

## Message Transforms

Auto compression is on by default. The chat route sends OpenRouter's `context-compression` plugin with each request, which lets OpenRouter trim or remove middle prompt content only when a chat would exceed the selected model context window or message-count limits.

Turn Auto compression off in Settings if exact recall of the full transcript matters more than avoiding context-limit errors. When disabled, the route explicitly sends `context-compression` with `enabled: false`.

JSON mode is available from the composer braces button. It requests `response_format: { type: "json_object" }` and adds OpenRouter's `response-healing` plugin for that request.

For long system prompts, the chat route also adds ephemeral cache control automatically on Anthropic, Google, Qwen, and Alibaba model prefixes when the system prompt is at least 4096 characters.

## Response Caching

Response caching is off by default. When enabled in Settings, the chat route sends `X-OpenRouter-Cache: true` and `X-OpenRouter-Cache-TTL` with each OpenRouter request. TTL is clamped from 1 second to 86400 seconds; the default is 300 seconds.

When disabled, the chat route sends `X-OpenRouter-Cache: false`. Leave caching off for private, sensitive, or one-off prompts.

## Multimodal

- Image understanding supports PNG, JPEG, WebP, and GIF uploads. Use a vision-capable OpenRouter model.
- PDF uploads are sent through OpenRouter as file parts. The Settings PDF parser can stay on `auto` or be set to `cloudflare-ai`, `mistral-ocr`, or `native`.
- Image generation is off by default. Turn it on in Settings, then select a model that supports image output. When enabled, the model picker searches image-output models.
- Generated files are rendered under the assistant response. Generated images can be saved from the message.
- Attachments are stored in local chat history as data URLs. Uploads are limited to 4 files per message and 5 MB per file to reduce localStorage pressure.

## Web Tools

The Web tools section in Settings controls OpenRouter server tools:

- Web Search sends `openrouter:web_search` for current web results.
- Web Fetch sends `openrouter:web_fetch` so the model can read URLs mentioned in chat.
- Datetime sends `openrouter:datetime` with the configured IANA timezone.

Advanced options let you choose engines, limits, domain filters, and timezone. When OpenRouter returns URL source metadata, the app shows source chips under assistant replies.

The model picker also supports OpenRouter suffix variants: `:free`, `:extended`, `:thinking`, `:nitro`, `:floor`, `:exacto`, and `:online`. `:online` is a lighter model-id suffix alternative to enabling the full Web Search server tool.

## Chat History

Chats are stored locally in `localStorage` as separate threads. Use the sidebar to create, select, search, star, rename, and delete past chats. Existing single-chat history is migrated into one thread on first launch.

The first completed exchange in a new chat can be auto-titled through `POST /api/title`. Users can also rename the active chat from the header. Message actions support copy, read aloud, thumbs up/down feedback, user-message editing, assistant-message retry, and forking a new thread from any message.

Assistant responses stream as newline-delimited JSON from `POST /api/chat`. The client batches visible token updates through `requestAnimationFrame`, tracks reasoning deltas separately, stores returned URL sources and generated files, and displays token usage when OpenRouter returns usage metadata.

## Markdown Rendering

Assistant markdown uses `react-markdown` with GitHub-flavored Markdown and `rehype-sanitize`. Code blocks are highlighted with Shiki. `mermaid` blocks render with Mermaid strict mode, and `chart`, `vega-lite`, or `vegalite` blocks render as Vega-Lite charts when the spec uses inline data.

## iPhone Home Screen Install

1. Open the deployed site in Safari on iPhone.
2. Tap Share.
3. Tap Add to Home Screen.
4. Keep the suggested name or rename it, then tap Add.

The app uses `app/manifest.ts`, standalone display mode, iOS touch icon metadata, and safe-area CSS for the notch, Dynamic Island, and home indicator.

## iOS PWA Notes

- iOS Safari does not provide an automatic install prompt like Chromium browsers.
- Test installation on a real iPhone or iOS Simulator because Safari does not expose the same manifest debugging UI as Chromium.
- The app does not include a custom service worker cache. Chat history and settings are local, but model search and model responses require network access.
- The local API key and chat history are stored in `localStorage`. This is convenient for a personal PWA, but JavaScript on the same origin can read it, and Safari/iOS may clear it.

## Icons

PWA icons live in `public/icons/`:

- `icon-192.png`
- `icon-512.png`
- `maskable-icon-512.png`
- `apple-touch-icon.png`

Replace these with square PNGs. Keep the maskable icon artwork inside the central safe zone so it survives adaptive icon masking.

## Default Model

The default model is `openai/gpt-5-mini`. Change it in `lib/types.ts` by editing `DEFAULT_MODEL`.

Users can override the model from Settings.

## Checks

```bash
npm run typecheck
npm run build
```
