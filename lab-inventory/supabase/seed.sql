-- ============================================================
-- Lab Inventory — Seed / Dummy Data
-- Run AFTER schema.sql and after creating your admin user.
-- Safe to re-run: uses ON CONFLICT DO NOTHING where possible.
-- ============================================================

-- ============================================================
-- Equipment
-- ============================================================

insert into equipment (id, name, category, serial_number, supplier, vendor_contact, purchase_date, warranty_expiry, cost, currency, notes, photo_urls) values
  ('00000000-0000-0000-0001-000000000001', 'Biosafety Cabinet Class II', 'Biosafety Cabinet', 'BSC-2021-UV-001', 'Esco Micro Pte Ltd', 'esco.support@escoglobal.com', '2021-03-15', '2026-03-15', 8500.00, 'USD', 'Class II Type A2 BSC. HEPA filter replaced 2023-04.', '{}'),
  ('00000000-0000-0000-0001-000000000002', 'Autoclave Tuttnauer 2540', 'Autoclave', 'TUT-2540-0892', 'Tuttnauer', 'service@tuttnauer.com', '2020-06-01', '2025-06-01', 4200.00, 'USD', 'Gravity and pre-vacuum cycles. Used for media and waste.', '{}'),
  ('00000000-0000-0000-0001-000000000003', 'Eppendorf Centrifuge 5810R', 'Centrifuge', 'EP5810R-2022-114', 'Eppendorf', 'support@eppendorf.com', '2022-01-10', '2027-01-10', 6800.00, 'EUR', 'Refrigerated centrifuge, max 14,000 rpm.', '{}'),
  ('00000000-0000-0000-0001-000000000004', 'Olympus CX23 Microscope', 'Microscope', 'CX23-2019-DRC-04', 'Olympus', NULL, '2019-09-01', '2024-09-01', 1900.00, 'USD', 'Binocular, 4x/10x/40x/100x oil objectives.', '{}'),
  ('00000000-0000-0000-0001-000000000005', 'Bio-Rad T100 Thermal Cycler', 'PCR Machine', 'T100-BR-2023-07', 'Bio-Rad', 'biorad-support@bio-rad.com', '2023-04-20', '2028-04-20', 3900.00, 'USD', 'For cholera toxin gene PCR assays.', '{}'),
  ('00000000-0000-0000-0001-000000000006', 'Freezer -20°C Vestfrost', 'Cold Storage', 'VF350-2020-001', 'Vestfrost Solutions', NULL, '2020-11-01', '2025-11-01', 1200.00, 'USD', 'Reagent storage. Temperature logged weekly.', '{}')
on conflict (id) do nothing;

-- ============================================================
-- Maintenance Schedules
-- Mix of overdue, due soon, and OK
-- ============================================================

insert into maintenance_schedules (id, equipment_id, label, interval_days, lead_days, next_due) values
  -- BSC: HEPA filter check overdue
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'HEPA filter inspection', 180, 60, (current_date - interval '25 days')::date),
  -- BSC: UV lamp replacement due soon
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001', 'UV lamp replacement', 365, 60, (current_date + interval '30 days')::date),
  -- Autoclave: weekly spore test — due soon
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000002', 'Biological indicator (spore) test', 7, 3, (current_date + interval '2 days')::date),
  -- Autoclave: annual service — OK
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000002', 'Annual service and calibration', 365, 60, (current_date + interval '180 days')::date),
  -- Centrifuge: rotor inspection overdue
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000003', 'Rotor inspection and balancing', 90, 60, (current_date - interval '10 days')::date),
  -- Microscope: cleaning — OK
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000004', 'Lens cleaning and calibration', 90, 60, (current_date + interval '45 days')::date),
  -- PCR: OK
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000005', 'Annual calibration', 365, 60, (current_date + interval '200 days')::date),
  -- Freezer: temperature log review — due soon
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000006', 'Temperature log review', 30, 7, (current_date + interval '5 days')::date)
on conflict (id) do nothing;

-- ============================================================
-- Maintenance Logs (history for some items)
-- ============================================================

insert into maintenance_logs (schedule_id, equipment_id, performed_at, performed_by, notes) values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', (current_date - interval '205 days')::date, 'Andrew Azman', 'HEPA filter inspected, within tolerance. No replacement needed.'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000002', (current_date - interval '9 days')::date, 'Lab Tech', 'Spore test negative — autoclave operating correctly.'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000004', (current_date - interval '45 days')::date, 'Andrew Azman', 'All lenses cleaned with lens paper and isopropanol. Condenser realigned.');

-- ============================================================
-- Inventory Item Types
-- ============================================================

insert into item_types (id, name, category, unit, min_threshold, notes) values
  ('00000000-0000-0000-0003-000000000001', '2mL Cryotubes', 'Consumables', 'units', 500, 'Used for sample storage at -80°C and in liquid nitrogen.'),
  ('00000000-0000-0000-0003-000000000002', 'Nitrile Gloves (M)', 'PPE', 'boxes', 5, '100 gloves per box. Size M.'),
  ('00000000-0000-0000-0003-000000000003', 'Nitrile Gloves (L)', 'PPE', 'boxes', 5, '100 gloves per box. Size L.'),
  ('00000000-0000-0000-0003-000000000004', 'LB Broth Powder', 'Reagents', 'kg', 2, 'Lennox formulation. For cholera culture media.'),
  ('00000000-0000-0000-0003-000000000005', 'Tryptic Soy Agar (TSA)', 'Reagents', 'kg', 1, 'For general bacteriology plating.'),
  ('00000000-0000-0000-0003-000000000006', 'Pipette Tips 200µL', 'Consumables', 'racks', 20, 'Filtered tips, compatible with Eppendorf and Gilson pipettes.'),
  ('00000000-0000-0000-0003-000000000007', 'Pipette Tips 1000µL', 'Consumables', 'racks', 10, 'Filtered tips.'),
  ('00000000-0000-0000-0003-000000000008', 'Cholera RDT (Crystal VC)', 'Diagnostics', 'tests', 50, 'Crystal VC rapid dipstick for O1/O139 detection.'),
  ('00000000-0000-0000-0003-000000000009', 'Bleach 5% (Javel)', 'Disinfectants', 'litres', 10, 'Used for decontamination of waste and surfaces.'),
  ('00000000-0000-0000-0003-000000000010', 'Petri Dishes 90mm', 'Consumables', 'units', 200, 'Sterile, individually wrapped.')
on conflict (id) do nothing;

-- ============================================================
-- Item Sources (manufacturers / suppliers)
-- ============================================================

insert into item_sources (item_type_id, manufacturer, supplier) values
  ('00000000-0000-0000-0003-000000000001', 'Corning', 'Local distributor Kinshasa'),
  ('00000000-0000-0000-0003-000000000001', 'Nunc (Thermo Fisher)', 'UNICEF Supply Division'),
  ('00000000-0000-0000-0003-000000000002', 'Ansell', 'Local distributor Kinshasa'),
  ('00000000-0000-0000-0003-000000000003', 'Ansell', 'Local distributor Kinshasa'),
  ('00000000-0000-0000-0003-000000000004', 'Sigma-Aldrich', 'UNICEF Supply Division'),
  ('00000000-0000-0000-0003-000000000006', 'Eppendorf', 'Direct'),
  ('00000000-0000-0000-0003-000000000008', 'SD Biosensor', 'WHO Emergency Supply');

-- ============================================================
-- Stock Counts (initial baseline counts, ~3 months ago)
-- ============================================================

insert into stock_counts (item_type_id, quantity, counted_at, counted_by, notes) values
  ('00000000-0000-0000-0003-000000000001', 800,  (current_date - interval '90 days'), 'Andrew Azman', 'Initial stock count at lab setup.'),
  ('00000000-0000-0000-0003-000000000002', 8,    (current_date - interval '90 days'), 'Andrew Azman', NULL),
  ('00000000-0000-0000-0003-000000000003', 6,    (current_date - interval '90 days'), 'Andrew Azman', NULL),
  ('00000000-0000-0000-0003-000000000004', 3,    (current_date - interval '90 days'), 'Andrew Azman', NULL),
  ('00000000-0000-0000-0003-000000000005', 2,    (current_date - interval '90 days'), 'Andrew Azman', NULL),
  ('00000000-0000-0000-0003-000000000006', 40,   (current_date - interval '90 days'), 'Andrew Azman', NULL),
  ('00000000-0000-0000-0003-000000000007', 25,   (current_date - interval '90 days'), 'Andrew Azman', NULL),
  ('00000000-0000-0000-0003-000000000008', 200,  (current_date - interval '90 days'), 'Andrew Azman', 'Donated by UNICEF.'),
  ('00000000-0000-0000-0003-000000000009', 40,   (current_date - interval '90 days'), 'Andrew Azman', NULL),
  ('00000000-0000-0000-0003-000000000010', 500,  (current_date - interval '90 days'), 'Andrew Azman', NULL);

-- ============================================================
-- Deliveries (incoming stock since baseline count)
-- ============================================================

insert into deliveries (item_type_id, quantity, lot_number, received_at, received_by, notes) values
  -- Cryotubes: two deliveries
  ('00000000-0000-0000-0003-000000000001', 500,  'LOT-CRY-2024-11', (current_date - interval '60 days'), 'Andrew Azman', 'UNICEF shipment.'),
  ('00000000-0000-0000-0003-000000000001', 200,  'LOT-CRY-2025-02', (current_date - interval '15 days'), 'Andrew Azman', NULL),
  -- Gloves: restocked once
  ('00000000-0000-0000-0003-000000000002', 10,   NULL,              (current_date - interval '45 days'), 'Andrew Azman', NULL),
  ('00000000-0000-0000-0003-000000000003', 8,    NULL,              (current_date - interval '45 days'), 'Andrew Azman', NULL),
  -- LB Broth
  ('00000000-0000-0000-0003-000000000004', 2,    'LB-2025-SIGMA',   (current_date - interval '30 days'), 'Andrew Azman', NULL),
  -- RDTs: used heavily, no resupply yet → will be low stock
  -- Bleach: regular local purchase
  ('00000000-0000-0000-0003-000000000009', 20,   NULL,              (current_date - interval '50 days'), 'Andrew Azman', 'Purchased locally.'),
  ('00000000-0000-0000-0003-000000000009', 15,   NULL,              (current_date - interval '10 days'), 'Andrew Azman', NULL),
  -- Pipette tips
  ('00000000-0000-0000-0003-000000000006', 20,   NULL,              (current_date - interval '30 days'), 'Andrew Azman', NULL);
