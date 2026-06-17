# Agents

## Learned User Preferences

- User pastes structured findings (code reviews, OpenRouter integration recommendations, Tailwind/CSS linter diagnostics) and expects an agreement assessment before implementation.
- User confirms fixes with brief directives such as "fix it", "implement", "Option A", or "Make improvements / fixes" rather than re-specifying the changes.

## Learned Workspace Facts

- OpenRouter Chat PWA built with Next.js 16 App Router, React 19, Tailwind CSS v4, Vercel AI SDK, and `@openrouter/ai-sdk-provider`; mobile-first ChatGPT-style UI.
- Normal chat requests use the OpenRouter API key saved in Settings/localStorage and forwarded through local Next.js routes—not `OPENROUTER_API_KEY` from env.
- Client persistence lives in localStorage via `lib/storage.ts` (threads, settings, active thread, sidebar collapse).
- Shared validation and normalization live in `lib/validation.ts`; shared helpers such as `createId` and `formatBytes` live in `lib/utils.ts`.
- Settings include OpenRouter router shortcuts, model suffix variants, reasoning controls, provider routing, response handling, multimodal options, and JSON/Markdown import/export in addition to API key setup.
- Model suffix variants (`:nitro`, `:online`, etc.) are defined in `lib/model-variants.ts` and exposed as Settings toggles.
- Chat requests forward the active thread id as OpenRouter `session_id` for sticky routing and prompt caching.
- Chat streaming uses NDJSON over POST `/api/chat`; the client buffers tokens in a streaming draft flushed via `requestAnimationFrame` to limit re-renders.
- Chat actions include auto-title generation through `/api/title`, user-message edit, assistant retry, message/thread fork, read aloud, copy, local feedback toggles, source chips, generated file display, and usage summaries.
- Assistant markdown rendering (Shiki, Mermaid strict mode, Vega-Lite, rehype-sanitize) is centralized in `components/MarkdownMessage.tsx`.
- Global focus rings in `app/globals.css` apply only to `button:focus-visible`; text inputs rely on component-level styling without accent outlines.
