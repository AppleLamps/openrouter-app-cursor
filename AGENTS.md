## Learned User Preferences

- User pastes structured code-review findings (file paths, severity, recommendations) and expects an agreement assessment before implementation.
- User confirms fixes with brief directives such as "fix it", "implement", or "Make improvements / fixes" rather than re-specifying the changes.

## Learned Workspace Facts

- OpenRouter Chat PWA built with Next.js 16 App Router, React 19, Tailwind CSS v4, Vercel AI SDK, and `@openrouter/ai-sdk-provider`; mobile-first ChatGPT-style UI.
- Normal chat requests use the OpenRouter API key saved in Settings/localStorage and forwarded through local Next.js routes—not `OPENROUTER_API_KEY` from env.
- Client persistence lives in localStorage via `lib/storage.ts` (threads, settings, active thread, sidebar collapse).
- Shared validation and normalization live in `lib/validation.ts`; shared helpers such as `createId` and `formatBytes` live in `lib/utils.ts`.
- Chat streaming uses NDJSON over POST `/api/chat`; the client buffers tokens in a streaming draft flushed via `requestAnimationFrame` to limit re-renders.
- Assistant markdown rendering (Shiki, Mermaid strict mode, Vega-Lite, rehype-sanitize) is centralized in `components/MarkdownMessage.tsx`.
