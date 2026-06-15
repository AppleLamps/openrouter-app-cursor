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

- Add, validate, or remove your OpenRouter API key in Settings.
- Search current OpenRouter models from the Settings model picker. The picker is powered by `GET https://openrouter.ai/api/v1/models` through `app/api/models/route.ts`.
- Use the selected model field for a custom model id when the search list does not show it.
- Change the system prompt and temperature in Settings.
- Keep Auto compression enabled so OpenRouter can compress oversized chat prompts before they hit model context or message-count limits.
- Enable Response caching when you want identical OpenRouter requests to replay from cache. This beta feature is off by default.
- Enable OpenRouter server tools for Web Search, Web Fetch, and Datetime. These are off by default; Web Search and Web Fetch are beta OpenRouter features and may add tool/provider costs.
- Attach images or PDFs from the composer. Enable image generation in Settings only when using an image-output model.
- Clear chat clears only the active chat thread.
- Reset settings restores defaults and removes the locally saved key.

## Message Transforms

Auto compression is on by default. The chat route sends OpenRouter's `context-compression` plugin with each request, which lets OpenRouter trim or remove middle prompt content only when a chat would exceed the selected model context window or message-count limits.

Turn Auto compression off in Settings if exact recall of the full transcript matters more than avoiding context-limit errors. When disabled, the route explicitly sends `context-compression` with `enabled: false`.

## Response Caching

Response caching is off by default. When enabled in Settings, the chat route sends `X-OpenRouter-Cache: true` and `X-OpenRouter-Cache-TTL` with each OpenRouter request. TTL is clamped from 1 second to 86400 seconds; the default is 300 seconds.

OpenRouter cache hits replay identical successful responses with no billing, but cached response data is temporarily retained by OpenRouter for the TTL and scoped to your API key. Leave this off for private, sensitive, or one-off prompts.

## Multimodal

- Image understanding supports PNG, JPEG, WebP, and GIF uploads. Use a vision-capable OpenRouter model.
- PDF uploads are sent through OpenRouter as file parts. The Settings PDF parser can stay on `auto` or be set to `cloudflare-ai`, `mistral-ocr`, or `native`.
- Image generation is off by default. Turn it on in Settings, then select a model that supports image output. When enabled, the model picker searches image-output models.
- Generated images are rendered under the assistant response and can be saved from the message.
- Attachments are stored in local chat history as data URLs. v1 limits uploads to 4 files per message and 5 MB per file to reduce localStorage pressure.

## Web Tools

The Web tools section in Settings controls OpenRouter server tools:

- Web Search sends `openrouter:web_search` for current web results.
- Web Fetch sends `openrouter:web_fetch` so the model can read URLs mentioned in chat.
- Datetime sends `openrouter:datetime` with the configured IANA timezone.

Advanced options let you choose engines, limits, domain filters, and timezone. When OpenRouter returns URL source metadata, the app shows source chips under assistant replies.

## Chat History

Chats are stored locally in `localStorage` as separate threads. Use the sidebar to create, select, rename, and delete past chats. Existing v1 single-chat history is migrated into one thread on first launch.

## iPhone Home Screen Install

1. Open the deployed site in Safari on iPhone.
2. Tap Share.
3. Tap Add to Home Screen.
4. Keep the suggested name or rename it, then tap Add.

The app uses `app/manifest.ts`, standalone display mode, iOS touch icon metadata, and safe-area CSS for the notch, Dynamic Island, and home indicator.

## iOS PWA Notes

- iOS Safari does not provide an automatic install prompt like Chromium browsers.
- Test installation on a real iPhone or iOS Simulator because Safari does not expose the same manifest debugging UI as Chromium.
- v1 does not include a custom service worker cache. Chat history and settings are local, but model search and model responses require network access.
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
