-- ============================================================
-- Test data: 6 months of stock history for key items
-- Illustrates: stock charts, burn rate, low-stock alerts,
-- delivery impact, inventory session history
-- ============================================================
-- Safe to re-run: clears counts/deliveries/sessions only.
-- Does NOT touch item_types, equipment, or maintenance data.
-- ============================================================

delete from inventory_session_entries;
delete from inventory_sessions;
delete from stock_counts;
delete from deliveries;

-- ── Time anchors ──────────────────────────────────────────
-- T1: 180 days ago  (initial count)
-- T2: 120 days ago  (60d gap)
-- T3:  60 days ago  (60d gap)
-- T4:  14 days ago  (46d gap)
-- Deliveries are inserted between counts where relevant.

-- ============================================================
-- STOCK COUNTS  (4 counts × 12 items = 48 rows)
-- ============================================================

insert into stock_counts (item_type_id, quantity, counted_at, counted_by, notes) values

-- Cryotubes  (min 1000) — high-use, restocked once
('10000000-0000-0000-0000-000000000001', 3200, current_date - 180, 'Andrew Azman', 'Comptage initial'),
('10000000-0000-0000-0000-000000000001', 2800, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000001', 3600, current_date -  60, 'Andrew Azman', 'Après réception livraison'),
('10000000-0000-0000-0000-000000000001', 3280, current_date -  14, 'Andrew Azman', null),

-- TDRs Crystal VC  (min 50) — moderately high use, LOW STOCK at T4
('10000000-0000-0000-0000-000000000005', 120,  current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000005',  88,  current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000005',  54,  current_date -  60, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000005',  34,  current_date -  14, 'Andrew Azman', 'À commander en urgence'),

-- Écouvillons rectaux  (min 300) — steady use, approaching threshold
('10000000-0000-0000-0000-000000000006', 1200, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000006',  900, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000006',  620, current_date -  60, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000006',  390, current_date -  14, 'Andrew Azman', null),

-- APW aliquotes 5 mL  (min 100) — restocked, good levels
('10000000-0000-0000-0000-000000000020',  350, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000020',  280, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000020',  420, current_date -  60, 'Andrew Azman', 'Après livraison LSHTM'),
('10000000-0000-0000-0000-000000000020',  360, current_date -  14, 'Andrew Azman', null),

-- TCBS poudre  (min 3) — LOW STOCK at T4
('10000000-0000-0000-0000-000000000023',    6, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000023',    5, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000023',    3, current_date -  60, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000023',    2, current_date -  14, 'Andrew Azman', 'Dernier stock — commander'),

-- Éthanol >95%  (min 5) — hit zero, emergency delivery
('10000000-0000-0000-0000-000000000030',   14, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000030',    8, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000030',    5, current_date -  60, 'Andrew Azman', 'Seuil atteint'),
('10000000-0000-0000-0000-000000000030',   13, current_date -  14, 'Andrew Azman', 'Après livraison urgente'),

-- Gants nitrile  (min 10) — healthy stock, steady use
('10000000-0000-0000-0000-000000000091',   22, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000091',   16, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000091',   24, current_date -  60, 'Andrew Azman', 'Après réception Oxfam'),
('10000000-0000-0000-0000-000000000091',   19, current_date -  14, 'Andrew Azman', null),

-- Anses d'inoculation plastique  (min 2000) — high-volume use
('10000000-0000-0000-0000-000000000044', 6000, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000044', 4500, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000044', 6200, current_date -  60, 'Andrew Azman', 'Après livraison LSHTM'),
('10000000-0000-0000-0000-000000000044', 4800, current_date -  14, 'Andrew Azman', null),

-- Sacs Biohazard petit  (min 50)
('10000000-0000-0000-0000-000000000045',  300, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000045',  240, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000045',  175, current_date -  60, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000045',  115, current_date -  14, 'Andrew Azman', null),

-- Antiserum polyvalent  (min 5) — LOW STOCK
('10000000-0000-0000-0000-000000000147',    8, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000147',    7, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000147',    5, current_date -  60, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000147',    3, current_date -  14, 'Andrew Azman', 'Quasi-épuisé'),

-- Tubes stériles 15 mL  (min 100) — stable use
('10000000-0000-0000-0000-000000000068',  280, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000068',  230, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000068',  185, current_date -  60, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000068',  140, current_date -  14, 'Andrew Azman', null),

-- Papier filtres  (min 1000)
('10000000-0000-0000-0000-000000000003', 2500, current_date - 180, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000003', 2100, current_date - 120, 'Andrew Azman', null),
('10000000-0000-0000-0000-000000000003', 3200, current_date -  60, 'Andrew Azman', 'Après livraison Oxfam'),
('10000000-0000-0000-0000-000000000003', 2850, current_date -  14, 'Andrew Azman', null);


-- ============================================================
-- DELIVERIES  (between counts to show chart impact)
-- ============================================================

insert into deliveries (item_type_id, quantity, lot_number, expiry_date, received_at, received_by, notes) values

-- Cryotubes: big delivery between T2 and T3
('10000000-0000-0000-0000-000000000001', 1500, 'CRY-2026-01', '2028-06-30',
  current_date - 90, 'Andrew Azman', 'Livraison UNICEF — 1500 pièces'),

-- APW: delivery between T2 and T3
('10000000-0000-0000-0000-000000000020', 200, 'APW-LSHTM-25B', null,
  current_date - 90, 'Andrew Azman', 'Livraison LSHTM'),

-- Éthanol: emergency delivery between T3 and T4
('10000000-0000-0000-0000-000000000030', 10, 'ETH-LOCAL-26A', null,
  current_date - 35, 'Andrew Azman', 'Achat local urgence'),

-- Gants nitrile: delivery between T2 and T3
('10000000-0000-0000-0000-000000000091', 12, 'ANS-OXF-2026A', null,
  current_date - 95, 'Andrew Azman', 'Livraison Oxfam'),

-- Anses d'inoculation: large delivery between T2 and T3
('10000000-0000-0000-0000-000000000044', 3000, 'ANS-LSH-2026B', null,
  current_date - 85, 'Andrew Azman', 'Livraison LSHTM'),

-- Papier filtres: delivery between T2 and T3
('10000000-0000-0000-0000-000000000003', 1500, 'FIL-OXF-2026A', null,
  current_date - 88, 'Andrew Azman', 'Livraison Oxfam/LSHTM');


-- ============================================================
-- INVENTORY SESSIONS  (2 completed sessions for history page)
-- ============================================================

-- Session 1: T2 date (120 days ago, full count, completed)
insert into inventory_sessions (id, target_date, status, started_by, completed_at)
values (
  'a0000000-0000-0000-0000-000000000001',
  current_date - 120,
  'completed',
  'Andrew Azman',
  (current_date - 120 + interval '2 hours')::timestamptz
);

insert into inventory_session_entries
  (session_id, item_type_id, sort_order, counted_quantity, entered_at, entered_by)
select
  'a0000000-0000-0000-0000-000000000001',
  sc.item_type_id,
  row_number() over (order by it.category, it.name) - 1,
  sc.quantity,
  (current_date - 120 + interval '2 hours')::timestamptz,
  'Andrew Azman'
from stock_counts sc
join item_types it on it.id = sc.item_type_id
where sc.counted_at = (current_date - interval '120 days')::date;

-- Session 2: T3 date (60 days ago, partial — 2 items skipped)
insert into inventory_sessions (id, target_date, status, started_by, completed_at, notes)
values (
  'a0000000-0000-0000-0000-000000000002',
  current_date - 60,
  'completed',
  'Andrew Azman',
  (current_date - 60 + interval '3 hours')::timestamptz,
  'Deux articles non accessibles (frigo fermé)'
);

insert into inventory_session_entries
  (session_id, item_type_id, sort_order, counted_quantity, entered_at, entered_by)
select
  'a0000000-0000-0000-0000-000000000002',
  sc.item_type_id,
  row_number() over (order by it.category, it.name) - 1,
  sc.quantity,
  (current_date - 60 + interval '3 hours')::timestamptz,
  'Andrew Azman'
from stock_counts sc
join item_types it on it.id = sc.item_type_id
where sc.counted_at = (current_date - interval '60 days')::date;

-- Session 3: T4 date (14 days ago, in-progress — simulates a paused session)
insert into inventory_sessions (id, target_date, status, started_by, paused_at)
values (
  'a0000000-0000-0000-0000-000000000003',
  current_date - 14,
  'completed',
  'Andrew Azman',
  null
);

insert into inventory_session_entries
  (session_id, item_type_id, sort_order, counted_quantity, entered_at, entered_by)
select
  'a0000000-0000-0000-0000-000000000003',
  sc.item_type_id,
  row_number() over (order by it.category, it.name) - 1,
  sc.quantity,
  (current_date - 14 + interval '1 hour')::timestamptz,
  'Andrew Azman'
from stock_counts sc
join item_types it on it.id = sc.item_type_id
where sc.counted_at = (current_date - interval '14 days')::date;

notify pgrst, 'reload schema';
