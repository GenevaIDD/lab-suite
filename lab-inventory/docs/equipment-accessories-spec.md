# Spec: Linked / shared equipment accessories

Status: **draft for review** · Target release: ~v0.17.0 · Author: design sketch

## 1. Motivation

Equipment in the lab is not always standalone. A centrifuge has rotors; a PCR
machine has a spare thermal block; a microscope has objectives and a camera; a
freezer shares a UPS with the incubator next to it. Today each of those is
either an orphan equipment record or an untracked note, so the equipment
profile doesn't reflect the physical setup.

**Hard requirement:** an accessory can have **more than one host** — it may be
shared across several machines (e.g. one rotor used on two centrifuges, one UPS
shared by a freezer and an incubator). This rules out a single parent pointer
and mandates a many-to-many relationship. There is no single-parent limit.

## 2. Terminology

- **Host** — the primary machine (centrifuge, PCR machine…).
- **Accessory** — a component/attachment used by one or more hosts (rotor,
  block, objective, shared UPS…).
- An **accessory is itself a normal equipment record**. There is no separate
  "accessory" type or table — any equipment row can be linked as an accessory
  of any other. This means accessories keep their own serial number,
  functional status, maintenance schedules, documents, etc.
- The link is **directional**: host → accessory. On a host you see its
  Accessories; on an accessory you see "Used by" (its hosts).

## 3. Data model

A join table (many-to-many, directional):

```sql
create table equipment_accessories (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references equipment(id) on delete cascade,
  accessory_id uuid not null references equipment(id) on delete cascade,
  created_at   timestamptz not null default now(),
  created_by   text,
  unique (host_id, accessory_id),
  check (host_id <> accessory_id)          -- no self-link
);

create index on equipment_accessories (host_id);
create index on equipment_accessories (accessory_id);
```

Notes:
- `on delete cascade` removes only the **link rows** when either equipment is
  deleted — it never deletes the other piece of equipment. Deleting a
  centrifuge unlinks its rotors; the rotors survive as standalone equipment.
- `unique (host_id, accessory_id)` prevents duplicate links.
- `check (host_id <> accessory_id)` prevents linking an item to itself.
- Sharing is automatic: two rows `(centrifugeA, rotor)` and
  `(centrifugeB, rotor)` = one rotor shared by two hosts. Removing one link
  leaves the other untouched.
- RLS: mirror the existing `equipment` policies (write = admin + lab_manager;
  read = all authenticated). No new roles.

### Types (`src/types/database.ts`)

```ts
export interface EquipmentAccessory {
  id: string
  host_id: string
  accessory_id: string
  created_at: string
  created_by: string | null
  // hydrated join for display:
  accessory?: Pick<Equipment, 'id' | 'name' | 'category' | 'is_functional'>
  host?: Pick<Equipment, 'id' | 'name' | 'category' | 'is_functional'>
}
```

## 4. UI

Links are relationships between two **existing** records, so they are managed
from the **detail page** (like Observations / maintenance), not the create
form. You cannot link to equipment that doesn't exist yet, so the "New
equipment" form gets no accessory field. (This is the sensible exception to the
CLAUDE.md "fields must round-trip" rule, which is about scalar fields.)

Both cards sit **toward the bottom of the equipment detail page** (below the
info grid / documents / maintenance), showing the **actual linked items** as an
explicit list — not a compact count.

### Host profile — "Accessories" card
- Lists each linked accessory: name (link to its profile), category, and its
  **functional-status badge** (Functional / Not functional). This is the agreed
  behaviour — status is shown per accessory in the list; there is **no**
  automatic roll-up onto the host header.
- Admin / lab_manager: "Add accessory" → searchable equipment combobox
  (excludes self and already-linked items); and a remove (×) per row.
- Empty state: "No accessories linked."

### Accessory profile — "Used by" card
- Reverse view: lists the hosts this item is an accessory of (name + link).
- **Editable from this side too** (decided): admin / lab_manager can add a host
  ("Add to machine" → searchable picker) or remove a link here, writing the same
  `equipment_accessories` table. Links are directional (this item stays the
  accessory) but manageable from either end.

### Equipment list (`Equipment.tsx`)
- **No change.** Decided against a chip/count on the main table; linked items are
  surfaced as explicit lists on the detail page instead.

## 5. Behaviours & edge cases

- **Functional status**: fully independent per record. A broken accessory does
  not change the host's status; it's simply visible (with its badge) in the
  host's Accessories card.
- **Retirement**: retiring a host does not cascade to accessories and vice
  versa. Links remain; we can show a "retired" hint next to a linked item.
- **Deletion**: cascade deletes link rows only (see schema). The other
  equipment record is never touched.
- **Shared accessories**: removing an accessory from host A leaves its link to
  host B intact.
- **Cycles**: with directional many-to-many, `A→B` and `B→A` is possible but
  harmless because the UI only renders one level (no recursive tree). We still
  block self-links at the DB level.
- **Offline**: link create/delete go through `tryWriteOrQueue` like every other
  write.
- **i18n**: all new strings via `t()` with FR + EN parity (`equip.acc.*`,
  reuse `label.*` where possible).

## 6. Files touched (implementation checklist)

1. `supabase/add_equipment_accessories.sql` (+ mirror into `schema.sql`)
2. `src/types/database.ts` — `EquipmentAccessory` + table entry in `Database`
3. `src/lib/queries.ts` — `useEquipmentAccessories(hostId)` and
   `useEquipmentHosts(accessoryId)` (reverse)
4. `src/lib/mutations.ts` — `useLinkAccessory`, `useUnlinkAccessory`
5. `src/pages/EquipmentDetail.tsx` — Accessories card + Used-by card, near the
   bottom of the page
6. `src/lib/translations.ts` — `equip.acc.*` keys, FR + EN
7. Build + `vitest` + FR/EN parity check; bump `package.json`; deploy

(No change to `Equipment.tsx` — decided against a main-list indicator.)

## 7. Decisions (resolved)

1. **Directional**, host → accessory, with a reverse "Used by" view. No
   symmetric "related equipment" type; no `relationship_type` column.
2. **Manage links from both sides** — add/remove from either the host's
   Accessories card or the accessory's Used-by card (same table; link stays
   directional).
3. **No main-list indicator.** Linked items are shown as explicit lists at the
   bottom of the detail page, not as a chip/count on the equipment table.
4. **No per-link note** — dropped; the link is just host ↔ accessory.

Model is settled — ready to implement.
```
