-- ============================================================
-- Uvira OCV Lab — Real Inventory Items
-- Source: Inventory_Uvira Ocv Lab.xlsx (full 256-row read)
-- ============================================================
-- WARNING: Deletes all existing item_types and related data.
-- Run only on a fresh database or to reset to real items.
-- ============================================================
-- NOT included (treated as equipment, not inventory):
--   Incubateur, Micropipette, Loupe, Tiges magnétiques,
--   Anses métalliques avec manche, Turbidimètres,
--   Appareil de filtration, Tourne vis, Aspirateur/pipettes
--   sérologiques (Pipetboy type), Pool tester, Poubelles
--   Biohazard pour la paillasse, Chronomètres
-- ============================================================

delete from inventory_session_entries;
delete from inventory_sessions;
delete from stock_counts;
delete from deliveries;
delete from item_sources;
delete from item_types;

insert into item_types (id, name, category, unit, min_threshold, notes) values

-- ── Surveillance clinique ─────────────────────────────────
('10000000-0000-0000-0000-000000000001', 'Cryotubes',                        'Surveillance clinique', 'pièces',    1000, 'Deux types: couvercle blanc et couvercle bleu.'),
('10000000-0000-0000-0000-000000000002', 'Cryobox',                          'Surveillance clinique', 'pièces',      20, null),
('10000000-0000-0000-0000-000000000003', 'Papier filtres (discs)',            'Surveillance clinique', 'pièces',    1000, null),
('10000000-0000-0000-0000-000000000004', 'Pipettes pasteur',                 'Surveillance clinique', 'pièces',     500, null),
('10000000-0000-0000-0000-000000000005', 'TDRs Crystal VC',                  'Surveillance clinique', 'boîtes',      50, 'Chaque boîte contient 10 tests. Détection O1/O139.'),
('10000000-0000-0000-0000-000000000006', 'Écouvillons rectaux',              'Surveillance clinique', 'pièces',     300, null),
('10000000-0000-0000-0000-000000000007', 'Whatman 903 card',                 'Surveillance clinique', 'pièces',     500, null),
('10000000-0000-0000-0000-000000000008', 'FTA Card',                         'Surveillance clinique', 'pièces',     100, null),
('10000000-0000-0000-0000-000000000009', 'Sachets emballages petit format',  'Surveillance clinique', 'pièces',     500, null),
('10000000-0000-0000-0000-000000000010', 'Sachets emballages grand format',  'Surveillance clinique', 'pièces',     200, null),
('10000000-0000-0000-0000-000000000011', 'Barres de savons',                 'Surveillance clinique', 'pièces',     100, null),
('10000000-0000-0000-0000-000000000012', 'Désicants',                        'Surveillance clinique', 'pièces',     200, null),
('10000000-0000-0000-0000-000000000013', 'Désinfectant (surfaces)',          'Surveillance clinique', 'bouteilles',  12, null),
('10000000-0000-0000-0000-000000000014', 'Seaux pour collecte de selles',   'Surveillance clinique', 'pièces',     200, null),
('10000000-0000-0000-0000-000000000015', 'Bocaux de prélèvement de selles', 'Surveillance clinique', 'pièces',     500, null),

-- ── Milieux et chimique ───────────────────────────────────
('10000000-0000-0000-0000-000000000020', 'APW (aliquotes 5 mL)',             'Milieux et chimique', 'flacons',  100, 'Eau peptonée alcaline en aliquotes de 5 mL.'),
('10000000-0000-0000-0000-000000000021', 'APW poudre',                       'Milieux et chimique', 'boîtes',     2, null),
('10000000-0000-0000-0000-000000000022', 'Agar poudre',                      'Milieux et chimique', 'boîtes',     1, null),
('10000000-0000-0000-0000-000000000023', 'TCBS poudre',                      'Milieux et chimique', 'boîtes',     3, 'Milieu sélectif pour V. cholerae.'),
('10000000-0000-0000-0000-000000000024', 'TSB poudre',                       'Milieux et chimique', 'boîtes',     3, 'Tryptic Soy Broth.'),
('10000000-0000-0000-0000-000000000025', 'Brilliance E.Coli',                'Milieux et chimique', 'boîtes',     2, null),
('10000000-0000-0000-0000-000000000026', 'Mueller Hinton Agar',              'Milieux et chimique', 'boîtes',     1, 'Pour antibiogrammes.'),
('10000000-0000-0000-0000-000000000027', 'M-coliBlue',                       'Milieux et chimique', 'pièces',    50, null),
('10000000-0000-0000-0000-000000000028', 'Ruban indicateur d\'autoclave',    'Milieux et chimique', 'rouleaux',   3, null),
('10000000-0000-0000-0000-000000000029', 'Granules de chlore',               'Milieux et chimique', 'kg',         2, null),
('10000000-0000-0000-0000-000000000030', 'Éthanol >95%',                     'Milieux et chimique', 'litres',     5, null),
('10000000-0000-0000-0000-000000000031', 'Thiosulfate de sodium',            'Milieux et chimique', 'flacons',    2, null),

-- ── Culture ───────────────────────────────────────────────
('10000000-0000-0000-0000-000000000040', 'Compact Dry E.C.',                           'Culture', 'disques',  100, null),
('10000000-0000-0000-0000-000000000041', 'Boîtes de Petri en verre',                   'Culture', 'pièces',   100, null),
('10000000-0000-0000-0000-000000000042', 'Boîtes de Petri en plastique (grand format)', 'Culture', 'pièces',  500, null),
('10000000-0000-0000-0000-000000000043', 'Boîtes de Petri en plastique (petit format)', 'Culture', 'pièces',  100, null),
('10000000-0000-0000-0000-000000000044', 'Anses d\'inoculation en plastique',           'Culture', 'pièces', 2000, 'Anses jetables.'),
('10000000-0000-0000-0000-000000000045', 'Sacs Biohazard petit',                        'Culture', 'pièces',   50, null),
('10000000-0000-0000-0000-000000000046', 'Sacs biohazard grand',                        'Culture', 'pièces',   20, null),
('10000000-0000-0000-0000-000000000047', 'Sachets d\'autoclave auto-adhésif (grand)',   'Culture', 'pièces',   50, null),
('10000000-0000-0000-0000-000000000048', 'Sachets d\'autoclave auto-adhésif (petit)',   'Culture', 'pièces',   50, null),
('10000000-0000-0000-0000-000000000049', 'Allumettes (pour Bec Bunsen)',                'Culture', 'cartons',   2, null),
('10000000-0000-0000-0000-000000000050', 'Pièges à mouches',                            'Culture', 'pièces',    5, null),

-- ── Consomables ───────────────────────────────────────────
('10000000-0000-0000-0000-000000000060', 'Flacons universal 30 mL (couvercle blanc)', 'Consomables', 'pièces',  100, null),
('10000000-0000-0000-0000-000000000061', 'Rouleaux d\'essuie-tout',                   'Consomables', 'rouleaux',  10, null),
('10000000-0000-0000-0000-000000000062', 'Stripettes 25 mL (pipettes sérologiques)',  'Consomables', 'pièces',   50, null),
('10000000-0000-0000-0000-000000000063', 'Sachets pour stérilisation (grand format)', 'Consomables', 'pièces',   50, null),
('10000000-0000-0000-0000-000000000064', 'Sachets pour stérilisation (petit format)', 'Consomables', 'pièces',   50, null),
('10000000-0000-0000-0000-000000000065', 'Embouts filtres 200 µL',                    'Consomables', 'pièces',  500, null),
('10000000-0000-0000-0000-000000000066', 'Embouts filtres 1000 µL',                   'Consomables', 'pièces',  200, null),
('10000000-0000-0000-0000-000000000067', 'Embouts blanc 20 µL',                       'Consomables', 'pièces',  500, null),
('10000000-0000-0000-0000-000000000068', 'Tubes stériles 15 mL',                      'Consomables', 'pièces',  100, null),
('10000000-0000-0000-0000-000000000069', 'Tubes stériles 50 mL',                      'Consomables', 'pièces',  100, null),

-- ── Articles ──────────────────────────────────────────────
('10000000-0000-0000-0000-000000000080', 'Portoirs (4 tailles)',                          'Articles', 'pièces',   4, null),
('10000000-0000-0000-0000-000000000081', 'Portoirs 80 cryotubes (différentes couleurs)', 'Articles', 'pièces',   4, null),
('10000000-0000-0000-0000-000000000082', 'Portoirs métalliques pour grands flacons',     'Articles', 'pièces',   2, null),
('10000000-0000-0000-0000-000000000083', 'Portoirs pour Boîtes de Petri',                'Articles', 'pièces',   2, null),
('10000000-0000-0000-0000-000000000084', 'Bouteilles autoclavables Durans 250 mL',       'Articles', 'pièces',   4, null),
('10000000-0000-0000-0000-000000000085', 'Bouteilles autoclavables Durans 1000 mL',      'Articles', 'pièces',   4, null),

-- ── EEP (Équipement de Protection Individuelle) ──────────
('10000000-0000-0000-0000-000000000090', 'Blouses de laboratoire',      'EEP', 'pièces',    5, null),
('10000000-0000-0000-0000-000000000091', 'Gants nitrile',               'EEP', 'boîtes',   10, null),
('10000000-0000-0000-0000-000000000092', 'Lunettes de sécurité',        'EEP', 'pièces',    5, null),
('10000000-0000-0000-0000-000000000093', 'Gants de congélateur (bleu)', 'EEP', 'paires',    5, null),
('10000000-0000-0000-0000-000000000094', 'Désinfectant mains',          'EEP', 'bouteilles',6, null),
('10000000-0000-0000-0000-000000000095', 'Savon liquide',               'EEP', 'bouteilles',6, null),
('10000000-0000-0000-0000-000000000096', 'Cache-nez / masques',         'EEP', 'pièces',   50, null),

-- ── Transport ─────────────────────────────────────────────
('10000000-0000-0000-0000-000000000100', 'Vaccine coolers',                         'Transport', 'pièces', 2, null),
('10000000-0000-0000-0000-000000000101', 'Accumulateurs grand bleu',               'Transport', 'pièces', 4, null),
('10000000-0000-0000-0000-000000000102', 'Accumulateurs petits (vaccine coolers)',  'Transport', 'pièces', 8, null),

-- ── Accessoires de machines ───────────────────────────────
('10000000-0000-0000-0000-000000000110', 'Adaptateurs centrifugeuse 5 mL',  'Accessoires de machines', 'pièces', 2, null),
('10000000-0000-0000-0000-000000000111', 'Adaptateurs centrifugeuse 7 mL',  'Accessoires de machines', 'pièces', 2, null),
('10000000-0000-0000-0000-000000000112', 'Gauntlet d\'autoclave (vert)',     'Accessoires de machines', 'pièces', 2, null),

-- ── Autres articles ───────────────────────────────────────
('10000000-0000-0000-0000-000000000120', 'Cuillères',                         'Autres articles', 'pièces',     5, null),
('10000000-0000-0000-0000-000000000121', 'Sachets blancs autoclavables',      'Autres articles', 'pièces',    50, null),
('10000000-0000-0000-0000-000000000122', 'Agrafes / attaches',                'Autres articles', 'boîtes',     2, null),
('10000000-0000-0000-0000-000000000123', 'Stylos noirs',                      'Autres articles', 'pièces',    10, null),
('10000000-0000-0000-0000-000000000124', 'Marqueurs / Sharpies',              'Autres articles', 'pièces',    10, null),
('10000000-0000-0000-0000-000000000125', 'Labels / étiquettes',               'Autres articles', 'rouleaux',   2, null),
('10000000-0000-0000-0000-000000000126', 'Papier aluminium',                  'Autres articles', 'boîtes',     2, null),
('10000000-0000-0000-0000-000000000127', 'Rouleaux d\'ouate',                 'Autres articles', 'rouleaux',   4, null),
('10000000-0000-0000-0000-000000000128', 'Tubes avec gel séparateur',         'Autres articles', 'pièces',    50, null),
('10000000-0000-0000-0000-000000000129', 'Garrots',                           'Autres articles', 'pièces',    10, null),
('10000000-0000-0000-0000-000000000130', 'Petits sacs phlébotomiste',         'Autres articles', 'pièces',    10, null),
('10000000-0000-0000-0000-000000000131', 'Spatules',                          'Autres articles', 'pièces',    10, null),
('10000000-0000-0000-0000-000000000132', 'Aiguilles vaccutainer adultes',     'Autres articles', 'pièces',    50, null),
('10000000-0000-0000-0000-000000000133', 'Bandes adhésives',                  'Autres articles', 'paquets',    5, null),
('10000000-0000-0000-0000-000000000134', 'Alcool désinfectant',               'Autres articles', 'paquets',    5, null),
('10000000-0000-0000-0000-000000000135', 'Épicrâniens pédiatriques',          'Autres articles', 'pièces',    20, null),
('10000000-0000-0000-0000-000000000136', 'Briquet',                           'Autres articles', 'pièces',     3, null),
('10000000-0000-0000-0000-000000000137', 'Poubelle biohazard de terrain',     'Autres articles', 'pièces',     2, null),
('10000000-0000-0000-0000-000000000138', 'Poires (pour pipettes)',            'Autres articles', 'pièces',     5, null),
('10000000-0000-0000-0000-000000000139', 'Pinces en plastique',               'Autres articles', 'pièces',     5, null),
('10000000-0000-0000-0000-000000000140', 'DPD3',                              'Autres articles', 'plaquettes', 2, 'Réactif pour test chlore.'),
('10000000-0000-0000-0000-000000000141', 'DPD1',                              'Autres articles', 'plaquettes', 2, null),
('10000000-0000-0000-0000-000000000142', 'PhenolRed',                         'Autres articles', 'plaquettes', 2, null),
('10000000-0000-0000-0000-000000000143', 'Vaseline',                          'Autres articles', 'pièces',     2, null),
('10000000-0000-0000-0000-000000000144', 'Membranes filtrantes',              'Autres articles', 'pièces',    20, null),
('10000000-0000-0000-0000-000000000145', 'Indicateur d\'humidité Whatman',   'Autres articles', 'paquets',    2, null),
('10000000-0000-0000-0000-000000000146', 'Test d\'oxydase',                  'Autres articles', 'pièces',    20, null),
('10000000-0000-0000-0000-000000000147', 'Antiserum polyvalent',              'Autres articles', 'flacons',    5, null),
('10000000-0000-0000-0000-000000000148', 'Antiserum Ogawa',                   'Autres articles', 'flacons',    5, null),
('10000000-0000-0000-0000-000000000149', 'Antiserum Inaba',                   'Autres articles', 'flacons',    5, null),
('10000000-0000-0000-0000-000000000150', 'Lamelles porte-objet',              'Autres articles', 'pièces',    50, null),
('10000000-0000-0000-0000-000000000151', 'Ouates',                            'Autres articles', 'rouleaux',   4, null),
('10000000-0000-0000-0000-000000000152', 'Savon Omo',                         'Autres articles', 'kg',          2, null),
('10000000-0000-0000-0000-000000000153', 'Bougies',                           'Autres articles', 'pièces',    10, null),
('10000000-0000-0000-0000-000000000154', 'Seringues avec aiguille',           'Autres articles', 'boîtes',     2, null),
('10000000-0000-0000-0000-000000000155', 'Indicateur de stérilisation',       'Autres articles', 'rouleaux',   2, null),
('10000000-0000-0000-0000-000000000156', 'Abaisse-langue',                    'Autres articles', 'paquets',    2, null);

-- ============================================================
-- Item Sources
-- ============================================================

insert into item_sources (item_type_id, manufacturer, supplier) values
-- Surveillance clinique
('10000000-0000-0000-0000-000000000001', 'Corning', 'Oxfam'),
('10000000-0000-0000-0000-000000000001', 'Nunc (Thermo Fisher)', 'UNICEF Supply Division'),
('10000000-0000-0000-0000-000000000003', 'Whatman', 'Oxfam'),
('10000000-0000-0000-0000-000000000003', 'Whatman', 'LSHTM'),
('10000000-0000-0000-0000-000000000004', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000005', 'SD Biosensor', 'JHU'),
('10000000-0000-0000-0000-000000000005', 'SD Biosensor', 'WHO Emergency Supply'),
('10000000-0000-0000-0000-000000000006', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000007', 'Whatman', 'Oxfam'),
('10000000-0000-0000-0000-000000000007', 'Whatman', 'LSHTM'),
('10000000-0000-0000-0000-000000000008', 'Cytiva', 'LSHTM'),
('10000000-0000-0000-0000-000000000009', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000010', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000011', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000012', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000012', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000013', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000014', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000015', 'Non précisé', 'Oxfam'),
-- Milieux et chimique
('10000000-0000-0000-0000-000000000020', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000021', 'Himedia', 'LSHTM'),
('10000000-0000-0000-0000-000000000022', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000023', 'Oxoid', 'LSHTM'),
('10000000-0000-0000-0000-000000000024', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000025', 'Oxoid', 'LSHTM'),
('10000000-0000-0000-0000-000000000029', 'Non précisé', 'Local (Uvira)'),
('10000000-0000-0000-0000-000000000030', 'Non précisé', 'Local (Uvira)'),
-- Culture
('10000000-0000-0000-0000-000000000041', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000041', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000042', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000043', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000044', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000045', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000046', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000049', 'Non précisé', 'Oxfam'),
-- EEP
('10000000-0000-0000-0000-000000000090', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000091', 'Ansell', 'Oxfam'),
('10000000-0000-0000-0000-000000000092', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000093', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000094', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000095', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000096', 'Non précisé', 'Oxfam'),
-- Transport
('10000000-0000-0000-0000-000000000100', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000101', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000102', 'Non précisé', 'LSHTM'),
-- Accessoires de machines
('10000000-0000-0000-0000-000000000110', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000112', 'Non précisé', 'LSHTM'),
-- Autres articles
('10000000-0000-0000-0000-000000000128', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000129', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000130', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000131', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000132', 'Non précisé', 'Oxfam'),
('10000000-0000-0000-0000-000000000132', 'Non précisé', 'JHU'),
('10000000-0000-0000-0000-000000000144', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000147', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000148', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000149', 'Non précisé', 'LSHTM'),
('10000000-0000-0000-0000-000000000154', 'Non précisé', 'Oxfam');

notify pgrst, 'reload schema';
