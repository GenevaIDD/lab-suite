# Lab Inventory — Claude Instructions

## Stack
React 19 + Vite + TypeScript, Tailwind CSS, Base UI primitives (shadcn/ui base-nova style),
Supabase (Postgres + Auth + Storage), Vercel hosting, PWA offline support.

## i18n — MANDATORY RULE
**Every UI string must use the `t()` translation hook. Never hardcode visible text.**

- Import `useLang` from `@/lib/i18n` and destructure `t`
- Add both FR and EN entries to `src/lib/translations.ts` every time you add a new key
- FR is the primary language; EN must be kept in sync
- Key naming convention: `<section>.<sub>` e.g. `dash.expiry.title`, `equip.retire.confirm`
- Hardcoded strings in JSX that are visible to the user are a bug — the language toggle will break

## UI components
- Use Base UI primitives from `@base-ui/react/*` — **NOT Radix**
- No `asChild` prop (Radix pattern, not Base UI)
- `SelectTrigger` defaults to `w-fit` — always add `className="w-full"` when used in a form field
- Dialog triggers use `render={<Button>...</Button>}` pattern (Base UI)

## Data patterns
- `tryWriteOrQueue` for all writes — handles offline queuing automatically
- Lot-tracked items (`track_lots = true`): stock comes from `lots.quantity_remaining`, not `stock_counts`
- Ad-hoc stock count form must block lot-tracked items (send to inventory session instead)
- `current_stock` is a SQL view — never write to it directly

## Deployment
- `npx vercel --prod` from `lab-inventory/` — GitHub auto-deploy is not connected
- Bump `version` in `package.json` with each meaningful release
- Run `npx tsc --noEmit && npx vitest run` before every commit
