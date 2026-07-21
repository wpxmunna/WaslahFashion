# Admin module conventions

Every admin module follows the same shape. **`src/actions/admin/products.ts` plus
`src/app/(admin)/admin/products/**` is the reference implementation — read it before
writing a new module.**

## Stack facts that bite

- **Next.js 16, React 19, App Router.** `params` and `searchParams` are Promises:
  `const { id } = await params;`
- **shadcn/ui here is built on Base UI, not Radix.** Reaching for a Radix API has caused
  three separate bugs already, so check the Base UI types before assuming:
  - No `asChild` — use the `render` prop, or style a `<Link>` with `buttonVariants()`.
  - `Accordion` takes `multiple={false}`, not `type="single"`.
  - `DropdownMenuLabel` must be inside a `DropdownMenuGroup`, or it throws at runtime.
  - `DropdownMenuItem` fires **`onClick`**, not `onSelect`, and takes `closeOnClick`.
    An `onSelect` prop *typechecks* (React's div props include a native select event)
    and then silently never fires — this shipped a dead sign-out button.

  When a handler does nothing, check the component's `.d.ts` in
  `node_modules/@base-ui/react/` before debugging anything else.
- **A server action invoked from an event handler must run inside a transition**, and it
  must not rely on `redirect()`. The NEXT_REDIRECT signal is only handled for form
  actions and transitions; a bare `void someAction()` swallows it. Clear state in the
  action, then navigate with `router.push()` + `router.refresh()` in the client.
- **Prisma 7 with a driver adapter.** Never put `as const` on a Prisma `select`,
  `orderBy` or filter object — it makes arrays readonly and Prisma rejects them. Use
  `satisfies Prisma.XxxSelect` instead.
- **Never interpolate a `Prisma.Sql` into a `$queryRaw` tagged template.** It binds as a
  parameter and silently matches nothing. Compose with ``Prisma.sql`…` `` and pass the
  object: `prisma.$queryRaw(query)`.
- **Every export from a `"use server"` file must be an async function.** Put helpers in
  `src/lib/`.
- **Never import a *value* from a `"use client"` module into a Server Component.** Every
  export of a client module becomes a client *reference* on the server, so `.map()`
  throws and — far worse — property access silently returns `undefined`. This shipped
  once already: a status-label map lived beside its form and the purchase-order list
  rendered 79 `undefined`s while typechecking and building clean. Constants live in a
  plain `.ts` module (`*-form-constants.ts`, `src/lib/*.ts`); the client component
  imports them from there too. Types are erased, so `import type` across the boundary is
  always safe.
- Money columns are `Decimal`. Convert with `toNumber()` before sending to a client
  component, and display with `formatPrice()` (renders `BDT 1,299.00`).

## Files a module owns

```
src/actions/admin/<module>.ts          server actions
src/app/(admin)/admin/<module>/page.tsx        list
src/app/(admin)/admin/<module>/new/page.tsx    create   (if applicable)
src/app/(admin)/admin/<module>/[id]/page.tsx   edit/detail
src/components/admin/<module>-*.tsx    client components for that module
```

## Shared code — use it, do not edit it

| Import | Provides |
|---|---|
| `@/components/admin/ui` | `PageHeader`, `Panel`, `StatCard`, `StatusBadge`, `EmptyState`, `DataTable`, `THead`, `TBody`, `Th`, `Td` |
| `@/components/admin/form-fields` | `TextField`, `TextareaField`, `SelectField`, `CheckboxField`, `SubmitButton`, `FormMessage`, `FormActions` |
| `@/components/admin/admin-search` | `AdminSearch` — list toolbar (query + select filters) |
| `@/components/admin/delete-button` | `DeleteButton` — confirmed destructive action |
| `@/components/pagination` | `Pagination` |
| `@/components/safe-image` | `SafeImage` — never use bare `next/image` for catalogue images |
| `@/lib/admin/guard` | `requireStaff()`, `requireAdmin()` |
| `@/lib/admin/upload` | `saveUpload()`, `resolveImageInput()` |
| `@/lib/money` | `formatPrice`, `toNumber`, `effectivePrice` |
| `@/lib/slug` | `slugify` |
| `@/actions/types` | `FormState`, `initialFormState`, `fieldErrors` |

Do **not** modify: `ui.tsx`, `form-fields.tsx`, `admin-search.tsx`, `delete-button.tsx`,
`sidebar.tsx`, `nav-config.ts`, anything in `src/lib/admin/`, or the Prisma schema.
If you genuinely need a change there, note it in your report instead.

## Server action shape

```ts
"use server";

export async function updateThing(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();                       // or requireAdmin() for restricted screens

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
             message: "Please check the highlighted fields." };
  }

  await prisma.thing.update({ where: { id }, data: { ... } });

  revalidatePath("/admin/things");
  return { ok: true, message: "Saved." };
}
```

Bind extra arguments in the client: `updateThing.bind(null, id)` with `useActionState`.

## Rules

1. **Always call `requireStaff()`** at the top of every action. Use `requireAdmin()` for
   accounting, finance reports, payroll, stores, staff and settings.
2. **Validate with zod.** The legacy PHP validated almost nothing; do not reproduce that.
3. **Never trust an id from the client** without checking it belongs to the current store.
4. **Don't hard-delete rows referenced by history** (orders, transactions, journals).
   Deactivate/archive and say so in the returned message, as `deleteProduct` does.
5. **Stock changes must be conditional** — `updateMany` with a `gte` guard, never a bare
   decrement, or concurrent writes drive stock negative.
6. **Money maths in `Decimal`/number, rounded to 2 dp** at the boundary.
7. List screens: `AdminSearch` + `Pagination`, 20 per page, newest first.
8. Empty states everywhere — never render a bare empty table.
9. Label buttons and inputs for screen readers; tables get real `<th scope="col">`.

## Verify before reporting

```bash
npx tsc --noEmit      # must be clean
npx eslint src        # must be clean
```

Report honestly: what you built, what you did not, and anything you could not verify.
