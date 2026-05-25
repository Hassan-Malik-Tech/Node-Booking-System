-- FOR DEVELOPMENT
-- Rebuilds the development database 

-- Stop the psql script on the first error.
-- Because the rebuild runs inside one transaction, COMMIT is only reached if every
--  file succeeds. If an error stops the script before COMMIT,
-- PostgreSQL discards the uncommitted transaction when the session ends.
-- It is hard to apply normal ROLLBACK here.
\set ON_ERROR_STOP on 

BEGIN;

\i db/dev/reset.sql
\i db/schema.sql

\i db/seeds/01-users.sql
\i db/seeds/02-resources.sql
\i db/seeds/03-availability-windows.sql
\i db/seeds/04-availability-window-allowed-durations.sql
\i db/seeds/05-reservations.sql

\i db/functions.sql
\i db/triggers.sql

COMMIT;