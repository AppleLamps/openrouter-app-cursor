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
- Enable OpenRouter server tools for Web Search, Web Fetch, and Datetime. These are off by default; Web Search and Web Fetch are beta OpenRouter features and may add tool/provider costs.
- Clear chat clears only the active chat thread.
- Reset settings restores defaults and removes the locally saved key.

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
