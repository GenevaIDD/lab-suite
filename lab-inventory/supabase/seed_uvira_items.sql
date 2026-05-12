-- ============================================================
-- Uvira OCV Lab — Real Inventory Items
-- Source: Inventory_Uvira Ocv Lab.xlsx
-- ============================================================
-- WARNING: This deletes all existing item_types, sources,
-- stock counts, deliveries, and inventory sessions.
-- Run only on a fresh database or to reset to real items.
-- ============================================================

delete from inventory_session_entries;
delete from inventory_sessions;
delete from stock_counts;
delete from deliveries;
delete from item_sources;
delete from item_types;

-- ============================================================
-- Item Types
-- ============================================================

insert into item_types (id, name, category, unit, min_threshold, notes) values

-- ── Surveillance clinique ─────────────────────────────────
('10000000-0000-0000-0000-000000000001',
 'Cryotubes', 'Surveillance clinique', 'pièces', 1000,
 'Utilisés pour le stockage des échantillons à -80°C et en azote liquide. Deux types: couvercle blanc et couvercle bleu.'),

('10000000-0000-0000-0000-000000000002',
 'Papier filtres (discs)', 'Surveillance clinique', 'pièces', 1000, null),

('10000000-0000-0000-0000-000000000003',
 'Pipettes pasteur', 'Surveillance clinique', 'pièces', 500, null),

('10000000-0000-0000-0000-000000000004',
 'TDRs Crystal VC', 'Surveillance clinique', 'boîtes', 50,
 'Bandelettes de diagnostic rapide pour détection O1/O139. Chaque boîte contient 10 tests.'),

('10000000-0000-0000-0000-000000000005',
 'Écouvillons rectaux', 'Surveillance clinique', 'pièces', 300, null),

('10000000-0000-0000-0000-000000000006',
 'Whatman 903 card', 'Surveillance clinique', 'pièces', 500, null),

('10000000-0000-0000-0000-000000000007',
 'FTA Card', 'Surveillance clinique', 'pièces', 100,
 'Chaque boîte contient 100 cartes.'),

('10000000-0000-0000-0000-000000000008',
 'Sachets emballages', 'Surveillance clinique', 'pièces', 500, null),

('10000000-0000-0000-0000-000000000009',
 'Barres de savons', 'Surveillance clinique', 'pièces', 100, null),

('10000000-0000-0000-0000-000000000010',
 'Désicants', 'Surveillance clinique', 'pièces', 200, null),

('10000000-0000-0000-0000-000000000011',
 'Désinfectant', 'Surveillance clinique', 'bouteilles', 12, null),

('10000000-0000-0000-0000-000000000012',
 'Seaux pour collecte de selles', 'Surveillance clinique', 'pièces', 200, null),

('10000000-0000-0000-0000-000000000013',
 'Bocaux de prélèvement de selles', 'Surveillance clinique', 'pièces', 500, null),

('10000000-0000-0000-0000-000000000014',
 'Antisérums poly', 'Surveillance clinique', 'flacons', 5,
 'Antisérum polyvalent pour confirmation du choléra.'),

('10000000-0000-0000-0000-000000000015',
 'Antisérums Inaba', 'Surveillance clinique', 'flacons', 5, null),

('10000000-0000-0000-0000-000000000016',
 'Antisérums Ogawa', 'Surveillance clinique', 'flacons', 5, null),

('10000000-0000-0000-0000-000000000017',
 'Bandelettes oxydase', 'Surveillance clinique', 'boîtes', 2, null),

-- ── Milieux et chimique ───────────────────────────────────
('10000000-0000-0000-0000-000000000018',
 'APW (aliquotes 5 mL)', 'Milieux et chimique', 'flacons', 100,
 'Eau peptonée alcaline préparée en aliquotes de 5 mL.'),

('10000000-0000-0000-0000-000000000019',
 'APW poudre', 'Milieux et chimique', 'boîtes', 2,
 'Eau peptonée alcaline en poudre. Peser selon protocole.'),

('10000000-0000-0000-0000-000000000020',
 'Agar poudre', 'Milieux et chimique', 'boîtes', 1, null),

('10000000-0000-0000-0000-000000000021',
 'TCBS poudre', 'Milieux et chimique', 'boîtes', 3,
 'Milieu sélectif Thiosulfate Citrate Bile Saccharose pour V. cholerae.'),

('10000000-0000-0000-0000-000000000022',
 'TSB poudre', 'Milieux et chimique', 'boîtes', 3,
 'Tryptic Soy Broth en poudre.'),

('10000000-0000-0000-0000-000000000023',
 'Brilliance E.Coli', 'Milieux et chimique', 'boîtes', 2, null),

('10000000-0000-0000-0000-000000000024',
 'Muller Hinton Agar', 'Milieux et chimique', 'boîtes', 1,
 'Pour antibiogrammes.'),

('10000000-0000-0000-0000-000000000025',
 'Tiges magnétiques', 'Milieux et chimique', 'pièces', 3, null),

('10000000-0000-0000-0000-000000000026',
 'Ruban indicateur d\'autoclave', 'Milieux et chimique', 'rouleaux', 2, null),

('10000000-0000-0000-0000-000000000027',
 'Granules de chlore', 'Milieux et chimique', 'kg', 2, null),

('10000000-0000-0000-0000-000000000028',
 'Éthanol >95%', 'Milieux et chimique', 'litres', 5, null),

('10000000-0000-0000-0000-000000000029',
 'Thiosulfate de sodium', 'Milieux et chimique', 'flacons', 1, null),

-- ── Culture ───────────────────────────────────────────────
('10000000-0000-0000-0000-000000000030',
 'Compact Dry E.C.', 'Culture', 'disques', 100, null),

('10000000-0000-0000-0000-000000000031',
 'Boîtes de Petri en verre', 'Culture', 'pièces', 100, null),

('10000000-0000-0000-0000-000000000032',
 'Boîtes de Petri en plastique (grand format)', 'Culture', 'pièces', 500, null),

('10000000-0000-0000-0000-000000000033',
 'Boîtes de Petri en plastique (petit format)', 'Culture', 'pièces', 100, null),

('10000000-0000-0000-0000-000000000034',
 'Anses d\'inoculation en plastique', 'Culture', 'pièces', 2000,
 'Anses jetables. Également disponibles en version métallique avec manche.'),

('10000000-0000-0000-0000-000000000035',
 'Anses métalliques avec manche', 'Culture', 'pièces', 10, null),

('10000000-0000-0000-0000-000000000036',
 'Poubelles Biohazard pour la paillasse', 'Culture', 'pièces', 5, null),

('10000000-0000-0000-0000-000000000037',
 'Sacs Biohazard petit', 'Culture', 'pièces', 50, null),

('10000000-0000-0000-0000-000000000038',
 'Allumettes (pour Bec Bunsen)', 'Culture', 'cartons', 2, null);

-- ============================================================
-- Item Sources (suppliers from spreadsheet)
-- ============================================================

insert into item_sources (item_type_id, manufacturer, supplier) values
-- Cryotubes
('10000000-0000-0000-0000-000000000001', 'Corning', 'Oxfam'),
('10000000-0000-0000-0000-000000000001', 'Nunc (Thermo Fisher)', 'UNICEF Supply Division'),
-- Papier filtres
('10000000-0000-0000-0000-000000000002', 'Whatman', 'Oxfam'),
('10000000-0000-0000-0000-000000000002', 'Whatman', 'LSHTM'),
-- Pipettes pasteur
('10000000-0000-0000-0000-000000000003', 'Non précisé', 'Oxfam'),
-- TDRs
('10000000-0000-0000-0000-000000000004', 'SD Biosensor', 'JHU'),
('10000000-0000-0000-0000-000000000004', 'SD Biosensor', 'WHO Emergency Supply'),
-- Écouvillons rectaux
('10000000-0000-0000-0000-000000000005', 'Non précisé', 'Oxfam'),
-- Whatman 903
('10000000-0000-0000-0000-000000000006', 'Whatman', 'Oxfam'),
('10000000-0000-0000-0000-000000000006', 'Whatman', 'LSHTM'),
-- FTA Card
('10000000-0000-0000-0000-000000000007', 'Cytiva (GE Healthcare)', 'LSHTM'),
-- Sachets emballages
('10000000-0000-0000-0000-000000000008', 'Non précisé', 'Oxfam'),
-- Savons
('10000000-0000-0000-0000-000000000009', 'Non précisé', 'Oxfam'),
-- Désicants
('10000000-0000-0000-0000-000000000010', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000010', 'Non précisé', 'LSHTM'),
-- Désinfectant
('10000000-0000-0000-0000-000000000011', 'Non précisé', 'Oxfam'),
-- Seaux
('10000000-0000-0000-0000-000000000012', 'Non précisé', 'Oxfam'),
-- Bocaux
('10000000-0000-0000-0000-000000000013', 'Non précisé', 'Oxfam'),
-- APW aliquotes
('10000000-0000-0000-0000-000000000018', 'Non précisé', 'LSHTM'),
-- APW poudre
('10000000-0000-0000-0000-000000000019', 'Himedia', 'LSHTM'),
-- Agar
('10000000-0000-0000-0000-000000000020', 'Non précisé', 'LSHTM'),
-- TCBS
('10000000-0000-0000-0000-000000000021', 'Oxoid', 'LSHTM'),
-- TSB
('10000000-0000-0000-0000-000000000022', 'Non précisé', 'LSHTM'),
-- Brilliance
('10000000-0000-0000-0000-000000000023', 'Oxoid', 'LSHTM'),
-- Granules chlore
('10000000-0000-0000-0000-000000000027', 'Non précisé', 'Local (Uvira)'),
-- Éthanol
('10000000-0000-0000-0000-000000000028', 'Non précisé', 'Local (Uvira)'),
-- Boîtes Petri verre
('10000000-0000-0000-0000-000000000031', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000031', 'Non précisé', 'LSHTM'),
-- Boîtes Petri plastique grand
('10000000-0000-0000-0000-000000000032', 'Non précisé', 'LSHTM'),
-- Boîtes Petri plastique petit
('10000000-0000-0000-0000-000000000033', 'Non précisé', 'LSHTM'),
-- Anses plastique
('10000000-0000-0000-0000-000000000034', 'Non précisé', 'LSHTM'),
-- Anses métalliques
('10000000-0000-0000-0000-000000000035', 'Non précisé', 'Oxfam'),
-- Poubelles Biohazard
('10000000-0000-0000-0000-000000000036', 'Non précisé', 'Oxfam'),
-- Sacs Biohazard
('10000000-0000-0000-0000-000000000037', 'Non précisé', 'LSHTM'),
-- Allumettes
('10000000-0000-0000-0000-000000000038', 'Non précisé', 'Oxfam');

-- ============================================================
-- Reload schema cache
-- ============================================================

notify pgrst, 'reload schema';
