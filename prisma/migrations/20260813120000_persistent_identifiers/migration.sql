-- CreateEnum
CREATE TYPE "PersistentIdentifierScheme" AS ENUM ('BICUNI_PID');

-- CreateEnum
CREATE TYPE "PersistentIdentifierStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'TOMBSTONE');

-- CreateEnum
CREATE TYPE "PidResourceType" AS ENUM ('DOCUMENT', 'PUBLICATION');

-- CreateTable
CREATE TABLE "PersistentIdentifier" (
    "id" TEXT NOT NULL,
    "scheme" "PersistentIdentifierScheme" NOT NULL DEFAULT 'BICUNI_PID',
    "prefix" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "resourceType" "PidResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" "PersistentIdentifierStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersistentIdentifier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PersistentIdentifier_scheme_bicuni_check" CHECK ("scheme" = 'BICUNI_PID'),
    CONSTRAINT "PersistentIdentifier_prefix_bcu_check" CHECK ("prefix" = 'bcu'),
    CONSTRAINT "PersistentIdentifier_identifier_matches_check" CHECK ("identifier" = "prefix" || '/' || "suffix"),
    CONSTRAINT "PersistentIdentifier_no_doi_prefix_check" CHECK ("prefix" NOT LIKE '10.%' AND "identifier" NOT LIKE '10.%'),
    CONSTRAINT "PersistentIdentifier_resource_type_check" CHECK ("resourceType" IN ('DOCUMENT', 'PUBLICATION')),
    CONSTRAINT "PersistentIdentifier_resource_id_present_check" CHECK (btrim("resourceId") <> '' AND "resourceId" = btrim("resourceId"))
);

-- CreateTable
CREATE TABLE "PersistentIdentifierTargetHistory" (
    "id" TEXT NOT NULL,
    "persistentIdentifierId" TEXT NOT NULL,
    "previousTargetUrl" TEXT NOT NULL,
    "newTargetUrl" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "PersistentIdentifierTargetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersistentIdentifier_identifier_key" ON "PersistentIdentifier"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "PersistentIdentifier_prefix_suffix_key" ON "PersistentIdentifier"("prefix", "suffix");

-- CreateIndex
CREATE UNIQUE INDEX "PersistentIdentifier_resourceType_resourceId_key" ON "PersistentIdentifier"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "PersistentIdentifier_status_createdAt_idx" ON "PersistentIdentifier"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PersistentIdentifier_resourceId_idx" ON "PersistentIdentifier"("resourceId");

-- CreateIndex
CREATE INDEX "PersistentIdentifierTargetHistory_persistentIdentifierId_changedAt_idx" ON "PersistentIdentifierTargetHistory"("persistentIdentifierId", "changedAt");

-- AddForeignKey
ALTER TABLE "PersistentIdentifier" ADD CONSTRAINT "PersistentIdentifier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersistentIdentifierTargetHistory" ADD CONSTRAINT "PersistentIdentifierTargetHistory_persistentIdentifierId_fkey" FOREIGN KEY ("persistentIdentifierId") REFERENCES "PersistentIdentifier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersistentIdentifierTargetHistory" ADD CONSTRAINT "PersistentIdentifierTargetHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Identity immutability, INSERT fail-closed, physical delete protection (additive, unapplied migration).
CREATE OR REPLACE FUNCTION prevent_persistent_identifier_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PersistentIdentifier cannot be physically deleted';
  END IF;

  IF NEW."scheme" IS DISTINCT FROM 'BICUNI_PID'
    OR NEW."prefix" IS DISTINCT FROM 'bcu'
    OR NEW."identifier" IS DISTINCT FROM (NEW."prefix" || '/' || NEW."suffix")
    OR NEW."prefix" LIKE '10.%'
    OR NEW."identifier" LIKE '10.%'
    OR NEW."identifier" ILIKE '10.bcu%'
    OR NEW."identifier" ILIKE '10.87878/bicuni%'
    OR NEW."resourceType" NOT IN ('DOCUMENT', 'PUBLICATION')
  THEN
    RAISE EXCEPTION 'PersistentIdentifier must be a BICUNI PID (scheme=BICUNI_PID, prefix=bcu, identifier=bcu/{suffix})';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW."identifier" IS DISTINCT FROM OLD."identifier"
    OR NEW."scheme" IS DISTINCT FROM OLD."scheme"
    OR NEW."prefix" IS DISTINCT FROM OLD."prefix"
    OR NEW."suffix" IS DISTINCT FROM OLD."suffix"
    OR NEW."resourceType" IS DISTINCT FROM OLD."resourceType"
    OR NEW."resourceId" IS DISTINCT FROM OLD."resourceId"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'PersistentIdentifier identity fields are immutable';
  END IF;

  IF OLD."status" = 'TOMBSTONE' AND (
    NEW."status" IS DISTINCT FROM 'TOMBSTONE'
    OR NEW."targetUrl" IS DISTINCT FROM OLD."targetUrl"
  ) THEN
    RAISE EXCEPTION 'TOMBSTONE is a terminal PersistentIdentifier status';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER persistent_identifier_identity_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "PersistentIdentifier"
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_persistent_identifier_identity_mutation();

-- Polymorphic resource binding: a PID must reference a real Document or Publication.
-- Plain EXISTS is not enough under READ COMMITTED/MVCC against a concurrent DELETE.
-- INSERT locks only the single canonical row for (resourceType, resourceId) with
-- FOR KEY SHARE (same row lock as FOREIGN KEY ON DELETE RESTRICT).
-- No table-level lock. No advisory lock. Never lock Document and Publication together.
CREATE OR REPLACE FUNCTION prevent_persistent_identifier_orphan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."resourceId" IS NULL OR btrim(NEW."resourceId") = '' THEN
    RAISE EXCEPTION 'PersistentIdentifier resourceId is required';
  END IF;

  IF NEW."resourceType" = 'DOCUMENT' THEN
    PERFORM 1
    FROM "Document"
    WHERE "id" = NEW."resourceId"
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PersistentIdentifier DOCUMENT resource does not exist';
    END IF;
  ELSIF NEW."resourceType" = 'PUBLICATION' THEN
    PERFORM 1
    FROM "Publication"
    WHERE "id" = NEW."resourceId"
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PersistentIdentifier PUBLICATION resource does not exist';
    END IF;
  ELSE
    RAISE EXCEPTION 'PersistentIdentifier resourceType must be DOCUMENT or PUBLICATION';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER persistent_identifier_resource_bound
  BEFORE INSERT ON "PersistentIdentifier"
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_persistent_identifier_orphan();

-- Physical delete of a Document/Publication bound to a BICUNI PID is forbidden.
-- Additive and unapplied. No data changes. No cascade on PersistentIdentifier.
CREATE OR REPLACE FUNCTION prevent_pid_bound_document_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PersistentIdentifier" p
    WHERE p."resourceType" = 'DOCUMENT'::"PidResourceType"
      AND p."resourceId" = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot physically delete a resource referenced by a persistent identifier';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_pid_bound_document_delete
  BEFORE DELETE ON "Document"
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_pid_bound_document_delete();

CREATE OR REPLACE FUNCTION prevent_pid_bound_publication_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PersistentIdentifier" p
    WHERE p."resourceType" = 'PUBLICATION'::"PidResourceType"
      AND p."resourceId" = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot physically delete a resource referenced by a persistent identifier';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_pid_bound_publication_delete
  BEFORE DELETE ON "Publication"
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_pid_bound_publication_delete();
