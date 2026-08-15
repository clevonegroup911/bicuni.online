CREATE OR REPLACE FUNCTION bicuni_enqueue_search_index_job()
RETURNS trigger AS $$
DECLARE
  entity_id text;
BEGIN
  entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  INSERT INTO "SearchIndexJob" (id, "entityType", "entityId", action, "availableAt", "createdAt")
  VALUES (
    'search_' || replace(gen_random_uuid()::text, '-', ''),
    TG_TABLE_NAME,
    entity_id,
    TG_OP,
    timezone('UTC', now()),
    timezone('UTC', now())
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['Document','User','Profile','University','Faculty','Department','Category','Tag','Publication']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS bicuni_search_sync ON %I', table_name);
    EXECUTE format('CREATE TRIGGER bicuni_search_sync AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION bicuni_enqueue_search_index_job()', table_name);
  END LOOP;
END $$;
