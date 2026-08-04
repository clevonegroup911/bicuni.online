-- The enum values are committed in their own migration so PostgreSQL can use
-- them safely as defaults in the following migration.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'USER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MODERATOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INSTITUTION_ADMIN';
