-- ============================================================
-- Storage: rewrite stored public URLs to bare object paths (v0.18.2)
--
-- Background: equipment-photos and equipment-documents are private buckets
-- (schema.sql), but uploads saved the result of getPublicUrl(). A public URL
-- does not authenticate a download from a private bucket, so those stored
-- values never resolved -- images and document links were broken on read.
--
-- The client now stores the bare object path and mints a short-lived signed
-- URL at render time (src/lib/file-storage.ts). This migration rewrites the
-- rows written under the old behaviour.
--
-- The client tolerates both formats, so this backfill is not load-bearing --
-- it just stops legacy rows from carrying a misleading URL forever.
--
-- RUN STEP 1 FIRST AND REVIEW. Step 2 rewrites rows.
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1 - DETECTION (read-only)
-- How many stored references are full URLs rather than bare paths?
-- ------------------------------------------------------------

select
  'equipment_documents.file_url' as column_ref,
  count(*)                                                        as total_rows,
  count(*) filter (where file_url like 'http%')                   as legacy_urls,
  count(*) filter (where file_url not like 'http%')                as bare_paths
from equipment_documents

union all

select
  'equipment.photo_urls[]',
  count(*),
  count(*) filter (where u like 'http%'),
  count(*) filter (where u not like 'http%')
from equipment e
cross join lateral unnest(coalesce(e.photo_urls, '{}')) as u;


-- ------------------------------------------------------------
-- STEP 2 - BACKFILL  ** REWRITES ROWS **
--
-- Trims everything up to and including the bucket segment, leaving the object
-- key. Matches the parsing in toObjectPath(). Idempotent: a value that is
-- already a bare path does not match the LIKE and is left alone.
--
-- Wrapped in a transaction -- check the verification query, then COMMIT.
-- ------------------------------------------------------------

begin;

update equipment_documents
set file_url = regexp_replace(
      file_url,
      '^.*/storage/v1/object/(?:public/|sign/)?equipment-documents/',
      ''
    )
where file_url like 'http%';

-- photo_urls is a text[], so each element is rewritten and the array rebuilt.
update equipment e
set photo_urls = sub.rewritten
from (
  select
    e2.id,
    array_agg(
      regexp_replace(
        u,
        '^.*/storage/v1/object/(?:public/|sign/)?equipment-photos/',
        ''
      )
      order by ord
    ) as rewritten
  from equipment e2
  cross join lateral unnest(e2.photo_urls) with ordinality as t(u, ord)
  where exists (
    select 1 from unnest(e2.photo_urls) as x where x like 'http%'
  )
  group by e2.id
) sub
where e.id = sub.id;

-- Strip any query string a signed URL may have carried.
update equipment_documents
set file_url = split_part(file_url, '?', 1)
where file_url like '%?%';

-- Verify: both counts must be zero before you commit.
select
  (select count(*) from equipment_documents where file_url like 'http%') as doc_urls_remaining,
  (select count(*) from equipment e
     cross join lateral unnest(coalesce(e.photo_urls, '{}')) as u
   where u like 'http%')                                                 as photo_urls_remaining;

commit;


-- ------------------------------------------------------------
-- Note on the column name
--
-- equipment_documents.file_url now holds an object path, not a URL. The column
-- is left named as-is: renaming it would touch the generated types, queries
-- and every read site for no behavioural gain. Recorded here instead.
-- ------------------------------------------------------------

comment on column equipment_documents.file_url is
  'Object path within the private equipment-documents bucket (NOT a URL). '
  'Read through a signed URL -- see src/lib/file-storage.ts.';

comment on column equipment.photo_urls is
  'Object paths within the private equipment-photos bucket (NOT URLs). '
  'Read through signed URLs -- see src/lib/file-storage.ts.';
