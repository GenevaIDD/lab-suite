-- ============================================================
-- Uvira Lab CH — Refresh from Uvira_Lab_Inventory_Template_baseline-CH.xlsx
-- Generated 2026-06-15. Replaces all item_types with the new
-- master list (category, unit, track_lots, min_threshold).
-- WARNING: wipes item_types and all dependent records
-- (item_sources, stock_counts, deliveries, lots, inventory sessions).
-- ALSO WIPES ALL EQUIPMENT and its dependent records
-- (maintenance schedules/logs, observations, documents).
-- ============================================================

delete from inventory_session_entries;
delete from inventory_sessions;
delete from lots;
delete from stock_counts;
delete from deliveries;
delete from item_sources;
delete from item_types;

delete from maintenance_logs;
delete from maintenance_schedules;

do $$
begin
  if to_regclass('public.equipment_observations') is not null then
    execute 'delete from equipment_observations';
  end if;
  if to_regclass('public.equipment_documents') is not null then
    execute 'delete from equipment_documents';
  end if;
end $$;

delete from equipment;

insert into item_types (id, name, category, unit, min_threshold, track_lots) values
  -- ── Surveillance clinique ─────────────────────────────,
  ('76a08f06-57d1-48f6-80cd-7d4589e8de24', 'Cryotubes (culture)', 'Surveillance clinique', 'pièces', 1000.0, false),
  ('db2f070a-2df4-4c02-983a-c58f89f133b0', 'Cryobox', 'Surveillance clinique', 'pièces', 20.0, false),
  ('b751a399-9975-4a99-a18b-5bb60026b222', 'Papier filtres (discs)', 'Surveillance clinique', 'pièces', 1000.0, false),
  ('815d615f-1132-457c-937d-30fb2b6dc57b', 'Pipettes pasteur', 'Surveillance clinique', 'pièces', 500.0, false),
  ('91e2ff68-9780-478d-ad19-fbeb8859484d', 'TDRs Crystal VC', 'Surveillance clinique', 'boîtes', 50.0, true),
  ('303d0208-fa8d-4c0a-b172-bd565841dd77', 'Écouvillons rectaux', 'Surveillance clinique', 'pièces', 300.0, true),
  ('c664b0b1-ebc6-4c25-bcb1-7c3a550b8922', 'Whatman 903 card', 'Surveillance clinique', 'pièces', 500.0, true),
  ('acd571d7-5260-49e4-8f63-3e6ae8705c20', 'Sachets emballages', 'Surveillance clinique', 'pièces', 100.0, false),
  ('a546cfcf-0419-495f-ad25-dc39e26f6495', 'Barres de savons', 'Surveillance clinique', 'pièces', 100.0, false),
  ('1c73c9ca-f461-476a-ab83-10ba6d25a59c', 'Désicants', 'Surveillance clinique', 'pièces', 200.0, false),
  ('f6bb81a1-72ef-4dfe-8007-44ab4a02eb72', 'Désinfectant (mains)', 'Surveillance clinique', 'bouteilles', 12.0, false),
  ('1b7b2b67-ddce-41cd-9f68-9a1fa5c7f922', 'Seaux pour collecte de selles', 'Surveillance clinique', 'pièces', 200.0, false),
  ('3cb57fa0-8c1f-48b0-984b-2a4469b77633', 'Bocaux de prélèvement de selles', 'Surveillance clinique', 'pièces', 300.0, false),
  -- ── Milieux et chimique ───────────────────────────────,
  ('9696a9ed-617d-43bf-8bdd-64b5c9f13d81', 'APW (aliquotes 5 mL)', 'Milieux et chimique', 'flacons', 300.0, true),
  ('1c52300f-2f34-43c9-9c7f-0a496255cd09', 'APW poudre', 'Milieux et chimique', 'boîtes', 2.0, true),
  ('f191fad5-0950-4277-91a4-063e80f9b229', 'Agar poudre', 'Milieux et chimique', 'boîtes', 1.0, true),
  ('d03333f7-743c-44bf-86cf-143ac5bc12fd', 'TCBS poudre', 'Milieux et chimique', 'boîtes', 2.0, true),
  ('f947dd1a-52d4-458a-8a9a-950f8b4b5b89', 'TSB poudre', 'Milieux et chimique', 'boîtes', 2.0, true),
  ('f89cedcc-04d0-4f7f-b488-fc95d23b6d6b', 'Brilliance E.Coli', 'Milieux et chimique', 'boîtes', 1.0, true),
  ('39f0ca55-f6dc-4074-bf32-736cef7bb894', 'Mueller Hinton Agar', 'Milieux et chimique', 'boîtes', 1.0, true),
  ('ffedfe5b-8e10-44cd-9646-c65b14b138c4', 'Ruban indicateur d''autoclave', 'Milieux et chimique', 'rouleaux', 2.0, true),
  ('5f015d5d-c1d8-4799-87fb-cd3862d3af3d', 'Granules de chlore', 'Milieux et chimique', 'kg', 1.0, true),
  ('f9382eb4-b68d-4971-bd9f-2e9f8cabc328', 'Éthanol >95% (surgical spirit)', 'Milieux et chimique', 'litres', 2.0, true),
  ('28db4a8e-e6ed-46f3-9a09-c49e79666ca9', 'Thiosulfate de sodium', 'Milieux et chimique', 'flacons', 1.0, true),
  ('31ddab61-f692-4af6-ab6a-9629cb1c2c09', 'Glycérol', 'Milieux et chimique', 'litres', 0.5, true),
  ('45356099-e1ee-4489-86d8-da9c4eb8fd48', 'DPD3', 'Milieux et chimique', 'plaquettes', 10.0, false),
  ('ce309e96-5eb9-4043-bf4b-8b19e3722947', 'Test d''oxydase', 'Milieux et chimique', 'pièces', 20.0, true),
  ('55b891a2-474f-4a7b-a2e2-9d56760f998a', 'Antiserum polyvalent', 'Milieux et chimique', 'flacons', 3.0, true),
  ('d62902a7-7abc-4076-a8d9-9356129723cd', 'Antiserum Ogawa', 'Milieux et chimique', 'flacons', 3.0, true),
  ('3e3c0cd7-2b1f-4acd-b09c-1b4b58cadd36', 'Antiserum Inaba', 'Milieux et chimique', 'flacons', 3.0, true),
  ('d3383d2a-eeb0-4d8d-971c-88dadd45bc1d', 'DPD1', 'Milieux et chimique', 'plaquettes', 10.0, false),
  ('561272fe-f813-4ffa-b8a4-4d996c334891', 'Éthanol grade moleculaire', 'Milieux et chimique', 'litres', 1.0, true),
  -- ── Culture ───────────────────────────────────────────,
  ('e452e3be-5c3c-4464-bc50-9d651c41afd5', 'Boîtes de Petri en verre', 'Culture', 'pièces', 100.0, false),
  ('d165a98c-5216-45a9-8a6e-5f6643458f32', 'Boîtes de Petri plastique (grand format)', 'Culture', 'pièces', 300.0, false),
  ('f2643eb3-17d4-4a13-9de3-bd51d1ffb8c1', 'Boîtes de Petri plastique (double compartements)', 'Culture', 'pièces', 50.0, false),
  ('2586b07c-d0d1-4d55-8df3-dd92283d1288', 'Anses d''inoculation en plastique', 'Culture', 'pièces', 2000.0, false),
  ('bbaebee8-0009-4802-b175-b2a998af6945', 'Sacs Biohazard petit', 'Culture', 'pièces', 50.0, false),
  ('872f39c2-59d6-4e6a-88f1-da863a03d705', 'Sacs biohazard grand', 'Culture', 'pièces', 20.0, false),
  ('4a65a682-18bb-4b05-9c76-9b57a20ba1a2', 'Sachets autoclave auto-adhésif (grand)', 'Culture', 'pièces', 50.0, false),
  ('56e3d9c5-72e5-445f-8fd0-e45661989172', 'Sachets autoclave auto-adhésif (petit)', 'Culture', 'pièces', 50.0, false),
  ('8db0985a-3ac1-418c-8593-81fbe3a2caa5', 'Allumettes (pour Bec Bunsen)', 'Culture', 'cartons', 1.0, false),
  ('18b6ba37-ac00-4b9b-aabf-cfbc079fbba4', 'Pièges à mouches', 'Culture', 'pièces', 200.0, false),
  -- ── Moleculaire ───────────────────────────────────────,
  ('764ac336-5bc6-4933-a41d-af06081fa13f', 'QIAamp Fast DNA Stool Mini Kit', 'Moleculaire', 'pièces', 0.0, true),
  ('30758d0a-f76f-4895-97b1-9f6cc3fd03fc', 'QIAamp Fast DNA Blood Mini Kit', 'Moleculaire', 'pièces', 0.0, true),
  ('83a23349-6a46-4635-89f2-9f9c71d90551', 'Quantifluor ONE dsDNA', 'Moleculaire', 'pièces', 0.0, true),
  ('dd82ee13-f99b-4422-bc8c-57f6f131c0ab', 'L''eau moleculaire', 'Moleculaire', 'bouteilles', 0.0, true),
  ('75c5d021-e56d-4daa-8e7e-73aa76e580b9', 'Amorces', 'Moleculaire', 'tubes', 2.0, false),
  ('eaf6a0ca-74bb-401f-8bf0-d9f0eebfb426', 'Sondes', 'Moleculaire', 'tubes', 2.0, false),
  ('77d6e110-b350-44d2-b3de-c3510fd9ab23', 'Microtube sans nuclease (1,5 mL - 2 mL)', 'Moleculaire', 'pièces', 300.0, false),
  ('6bd745a2-ad6f-4b6c-8abb-63cf74d09075', 'Microtube sans nuclease (0,5 mL) quantification', 'Moleculaire', 'pièces', 50.0, false),
  ('d4a79b33-a0c7-4ad2-9b4a-11ac214fd168', '5 mL Tubes sans nuclease', 'Moleculaire', 'pièces', 10.0, false),
  ('3aec1178-97b0-4c7c-b649-a00cd53ed211', 'Film de scellage', 'Moleculaire', 'pièces', 20.0, false),
  ('38ea8709-c14c-4a4f-8e96-3123d8654021', 'Plaques 96 puits', 'Moleculaire', 'pièces', 20.0, false),
  ('b2d34682-d219-498a-b1a7-42dfbcbb0246', '10 µL embouts filtrés', 'Moleculaire', 'boîtes', 5.0, false),
  ('825b7d1e-4fea-44a4-90df-039a35590349', '20 µL embouts filtrés', 'Moleculaire', 'boîtes', 5.0, false),
  ('f62d2fea-5d7a-4e52-b202-c2560aee99cf', '200 µL embouts filtrés', 'Moleculaire', 'boîtes', 5.0, false),
  ('d5edcdb4-dcf4-45e7-8ca8-187975902d55', '1000 µL embouts filtrés', 'Moleculaire', 'boîtes', 10.0, false),
  ('f2caef7b-4080-470c-a3ce-416f2ab4843f', 'Bioperfectus', 'Moleculaire', 'boîtes', 3.0, true),
  ('b03499ac-fd5f-461c-84b0-824346ece24a', 'RADIONE extraction', 'Moleculaire', 'pièces', 30.0, true),
  ('5b9900e8-24fc-411b-aee4-c54e7dd774b2', 'RADIONE mpox', 'Moleculaire', 'pièces', 30.0, true),
  ('d23f4f90-6d79-4954-b951-1ae40d08b54c', 'RADIONE cholera', 'Moleculaire', 'pièces', 30.0, true),
  -- ── Articles ──────────────────────────────────────────,
  ('41f076b5-368d-4a6f-af88-48875006bea0', 'Portoirs (4 tailles)', 'Articles', 'pièces', 0.0, false),
  ('99836d70-45e4-45eb-846f-2da145d71e0f', 'Portoirs 80 cryotubes (différentes couleurs)', 'Articles', 'pièces', 0.0, false),
  ('6d4b838e-b3b6-43dd-bf01-94b73fa51e76', 'Portoirs métalliques pour grands flacons', 'Articles', 'pièces', 0.0, false),
  ('702e93a0-7038-424c-97b8-945dd6255aa1', 'Portoirs pour Boîtes de Petri', 'Articles', 'pièces', 0.0, false),
  ('4e14bb4d-1f48-44fb-b6e1-062cf457b436', 'Bouteilles autoclavables Durans 250 mL', 'Articles', 'pièces', 0.0, false),
  ('69b1f322-f320-426a-af3b-19c162395997', 'Bouteilles autoclavables Durans 1000 mL', 'Articles', 'pièces', 0.0, false),
  -- ── EEP ───────────────────────────────────────────────,
  ('e6fb592f-c392-4087-945f-1f147c3df5d2', 'Blouses de laboratoire', 'EEP', 'pièces', 5.0, false),
  ('ed86392c-73b0-4d34-a134-47f111cc437b', 'Gants nitrile', 'EEP', 'boîtes', 10.0, false),
  ('4169d445-a682-4dd0-8f7d-514409440c45', 'Lunettes de sécurité', 'EEP', 'pièces', 5.0, false),
  ('a88daa1f-19aa-4ae4-b6f4-38f0e0d96de3', 'Gants de congélateur (bleu)', 'EEP', 'paires', 5.0, false),
  ('7ed4febe-a896-45d3-a618-3235f19b308d', 'Savon liquide', 'EEP', 'bouteilles', 6.0, false),
  ('20659b90-49cf-4cee-ac24-2061e53c7ea9', 'Cache-nez / masques faciale', 'EEP', 'pièces', 50.0, false),
  -- ── Transport ─────────────────────────────────────────,
  ('b6b268f3-f3a7-47bd-a661-41c8aad9f377', 'Vaccine coolers', 'Transport', 'pièces', 0.0, true),
  ('5674b2a7-7aa0-4aef-8ee8-064b6ce3bf87', 'Accumulateurs grand bleu', 'Transport', 'pièces', 0.0, false),
  ('6488708d-e214-46f6-bfa7-11d04774ba87', 'Accumulateurs petits (vaccine coolers)', 'Transport', 'pièces', 0.0, false),
  -- ── Accessoires de machines ───────────────────────────,
  ('c64ec643-f913-4970-831b-696cefba1ee4', 'Adaptateurs centrifugeuse 5 mL', 'Accessoires de machines', 'pièces', 0.0, false),
  ('dfae2607-d50e-4348-80f3-a0bcc69b89f6', 'Adaptateurs centrifugeuse 7 mL', 'Accessoires de machines', 'pièces', 0.0, false),
  ('0a3a07af-9638-4afa-b28f-ab8284ec58e8', 'Gauntlet d''autoclave (vert)', 'Accessoires de machines', 'pièces', 0.0, false),
  -- ── Autres articles ───────────────────────────────────,
  ('b01f490f-4a61-410e-bb3d-c9f523e34e6a', 'Cuillères', 'Autres articles', 'pièces', 0.0, false),
  ('f300af0a-0f3e-4a74-a2d5-de2736f66f96', 'Agrafes / attaches', 'Autres articles', 'boîtes', 0.0, false),
  ('585ac6e7-b447-44fd-8a5e-c533a1f91973', 'Stylos noirs', 'Autres articles', 'pièces', 0.0, false),
  ('88e7a476-e389-48c1-88f8-f620daedf525', 'Marqueurs / Sharpies', 'Autres articles', 'pièces', 10.0, false),
  ('3075a350-647d-4086-972b-860d7324a5e6', 'Labels / étiquettes', 'Autres articles', 'rouleaux', 2.0, false),
  ('ca226bb6-1567-4256-a0ea-0fb5dada745f', 'Papier aluminium', 'Autres articles', 'boîtes', 1.0, false),
  ('702bbf52-8a40-401a-8d75-d9485e85a2c8', 'Rouleaux d''ouate', 'Autres articles', 'rouleaux', 2.0, false),
  ('0f2f2251-0e6b-4cdb-bfb7-c132491063c1', 'Tubes avec gel séparateur', 'Autres articles', 'pièces', 0.0, false),
  ('60267a79-ff52-4eb0-a2ae-755ff2717c56', 'Garrots', 'Autres articles', 'pièces', 10.0, false),
  ('49fc0807-d831-4807-ba4b-6fd6ba5cfba7', 'Petits sacs phlébotomiste', 'Autres articles', 'pièces', 5.0, false),
  ('745ce0e3-1ece-41e8-9421-b60dac60601a', 'Spatules', 'Autres articles', 'pièces', 2.0, false),
  ('1dbb4a35-f629-4b9a-9b39-f1cd26f594b3', 'Aiguilles vaccutainer adultes', 'Autres articles', 'pièces', 0.0, false),
  ('d77f0311-f4b3-46f9-9870-072d72cece97', 'Bandes adhésives', 'Autres articles', 'paquets', 3.0, false),
  ('d640c373-08ed-4bf2-a0d2-f6b595dfaac3', 'Alcool désinfectant (lingettes)', 'Autres articles', 'paquets', 5.0, false),
  ('fc4fc89e-2801-481f-b6dc-b32fd3890b7e', 'Épicrâniens pédiatriques', 'Autres articles', 'pièces', 20.0, false),
  ('185a904c-797d-4f1d-a424-bd94261ebf30', 'Briquet', 'Autres articles', 'pièces', 3.0, false),
  ('397f1d24-707f-4efc-b678-ed3b9d3b225b', 'Poubelle biohazard de terrain', 'Autres articles', 'pièces', 5.0, false),
  ('c1623856-b69b-47a5-89e0-8a1e34376589', 'Poires (pour pipettes)', 'Autres articles', 'pièces', 0.0, false),
  ('7755f0a8-3273-4716-8bd1-ab7e41caed85', 'Pinces en plastique', 'Autres articles', 'pièces', 5.0, false),
  ('4eacb521-afba-451d-a242-fc547dd96e16', 'Vaseline', 'Autres articles', 'pièces', 0.0, false),
  ('c496adcb-51cf-4c21-bad3-54698dfb6723', 'Membranes filtrantes', 'Autres articles', 'pièces', 400.0, false),
  ('70577872-926e-471e-972b-e4d6c43969a2', 'Indicateur d''humidité Whatman', 'Autres articles', 'paquets', 0.0, false),
  ('84f4c7af-abc0-48c5-9346-930f04a74c52', 'Lamelles porte-object', 'Autres articles', 'pièces', 50.0, false),
  ('514894fd-8ae0-44fd-889a-908b83f636da', 'Ouates', 'Autres articles', 'rouleaux', 4.0, false),
  ('c4b53cdb-83d0-4b4d-a8db-37a5b7c946eb', 'Savon Omo', 'Autres articles', 'kg', 0.5, false),
  ('c471b52b-ffe5-4414-9c66-3813886b228f', 'Seringues avec aiguille', 'Autres articles', 'boîtes', 50.0, false),
  ('36410ea9-5951-4154-8153-676a07c2f30d', 'Indicateur de stérilisation', 'Autres articles', 'rouleaux', 2.0, false),
  ('90e89e74-7d60-47d1-990a-864fc2f5f12b', 'Abaisse-langue', 'Autres articles', 'paquets', 2.0, false),
  -- ── Antibiogrammes ────────────────────────────────────,
  ('61f964ce-1b2d-4934-a650-02b1e5af8e6b', 'Péfloxacine', 'Antibiogrammes', 'pièces', 50.0, true),
  ('3f9d3db7-1de9-461a-8d66-eb2592f87298', 'Érythromycine', 'Antibiogrammes', 'pièces', 50.0, true),
  ('ff96b9cb-3aad-4f83-8d86-08b318c4e2fa', 'Tétracycline', 'Antibiogrammes', 'pièces', 50.0, true),
  ('6303e19e-4101-455c-b116-1fc2cf475bf5', 'Triméthoprime/sulfaméthoxazole', 'Antibiogrammes', 'pièces', 50.0, true),
  ('b0d52e5f-6b08-45a8-9faa-15377f235864', 'Ampicilline', 'Antibiogrammes', 'pièces', 50.0, true),
  ('23cca98d-9a6f-4249-be8f-72fafb861367', 'Streptomycine', 'Antibiogrammes', 'pièces', 0.0, true),
  ('4a62ea4e-83ad-4d92-bda4-af3acabef84f', 'Polymixine B', 'Antibiogrammes', 'pièces', 0.0, true),
  ('9139f422-a43b-46e7-b57c-95f04a32d4d0', 'Chloramphénicol', 'Antibiogrammes', 'pièces', 50.0, true),
  ('4b8c2d05-2228-411f-b2fe-6c7a9d814d8d', 'Acide Nalidixique', 'Antibiogrammes', 'pièces', 50.0, true),
  ('6b81c1b6-67f7-4898-b227-6499362c24d4', 'Céfotaxime', 'Antibiogrammes', 'pièces', 50.0, true),
  ('5a31abb6-cf6f-4354-bb04-e441b6be8727', 'Souche de control Escherichia coli', 'Antibiogrammes', 'pièces', 0.0, true),
  ('1812f57e-bf1b-4e24-a32e-c7870dce3f9e', 'Souche de control Staphlyococcus aereus', 'Antibiogrammes', 'pièces', 0.0, true),
  ('24eff96b-91b9-43c7-b09e-5be8e27c0b1a', 'Standard McFarland', 'Antibiogrammes', 'pièces', 0.0, true),
  -- ── Papeterie ─────────────────────────────────────────,
  ('bb6303af-9c5e-4e38-ab8c-ccb880bf1b32', 'Agraffeuses', 'Papeterie', 'pièces', 0.0, false),
  ('4ca077d7-27ec-4f83-890c-5c36d18dfe43', 'Sharpies', 'Papeterie', 'pièces', 10.0, false),
  ('0e1e5149-deb1-4366-87c0-f0e805242ece', 'Stylos noirs', 'Papeterie', 'pièces', 6.0, false);

notify pgrst, 'reload schema';