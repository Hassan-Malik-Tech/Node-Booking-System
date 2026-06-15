-- =========================================
-- Trigger Functions
-- =========================================

----------------------------------------
-- function to automate updated_at
----------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

---------------------------------------------------------------
-- functions to prevent hard delete on soft delete tables
---------------------------------------------------------------

CREATE OR REPLACE FUNCTION block_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
   RAISE EXCEPTION 'Hard delete is not allowed on the % table', TG_TABLE_NAME;
END;
$$;
-- custom version for reservations:
CREATE OR REPLACE FUNCTION reservations_block_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
   RAISE EXCEPTION 'Hard delete is not allowed on the reservations table, you must cancel or complete the reservation';
END;
$$;

----------------------------------------------------------------
-- Irreversible soft-delete/reservation/ cancellation functions
----------------------------------------------------------------

CREATE OR REPLACE FUNCTION irreversible_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL
    THEN RAISE EXCEPTION 'You cannot reverse soft delete on the % table', TG_TABLE_NAME;
  END IF;
  
  RETURN NEW;
END;
$$;
-- custom version for resevations cancelled_at
CREATE OR REPLACE FUNCTION irreversible_reservation_cancellation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.cancelled_at IS NOT NULL
    THEN RAISE EXCEPTION 'Reservation cancellation is irreversible..';
  END IF;
  
  RETURN NEW;
END;
$$; -- make one for completed_at for both staff and automation
-- custom version for resevations status 'completed'
CREATE OR REPLACE FUNCTION irreversible_reservation_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status <> 'completed'
    THEN RAISE EXCEPTION 'Reservation completion is irreversible.';
  END IF;
  
  RETURN NEW;
END;
$$;


-------------------------------------------------------------------------
-- Block child writes against soft-deleted/inactive parents functions
-------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION no_reservations_for_inactive_or_deleted_resource()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT deleted_at FROM resources WHERE id = NEW.resource_id) IS NOT NULL
    THEN RAISE EXCEPTION 'You cannot reserve a soft deleted resource';
  ELSIF (SELECT is_active FROM resources WHERE id = NEW.resource_id) IS FALSE
    THEN RAISE EXCEPTION 'You cannot reserve an inactive resource';
  END IF;

RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION no_reservations_for_deleted_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF  (SELECT deleted_at FROM users WHERE id = NEW.user_id) IS NOT NULL
    THEN RAISE EXCEPTION 'A soft deleted user cannot reserve';
  END IF;

RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION no_availability_windows_for_inactive_or_deleted_resource()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT deleted_at FROM resources WHERE id = NEW.resource_id) IS NOT NULL
    THEN RAISE EXCEPTION 'You cannot create availability windows for a soft deleted resource';
  ELSIF (SELECT is_active FROM resources WHERE id = NEW.resource_id) IS FALSE
    THEN RAISE EXCEPTION 'You cannot create availability windows for an inactive resource';
  END IF;

RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION no_durations_for_deleted_availability_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT deleted_at FROM availability_windows WHERE id = NEW.availability_window_id) IS NOT NULL
    THEN RAISE EXCEPTION 'You cannot create durations for a soft deleted availability_window';
  END IF;

RETURN NEW;
END;
$$;

----------------------------------------------------------------
-- Others
----------------------------------------------------------------

CREATE OR REPLACE FUNCTION max_number_of_durations_for_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM availability_window_allowed_durations
    WHERE availability_window_id = NEW.availability_window_id
  ) >= 10
    THEN RAISE EXCEPTION 'The maximum number of durations you can have for one availability window is 10.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_deleting_last_allowed_duration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM availability_window_allowed_durations
    WHERE availability_window_id = OLD.availability_window_id
  ) <= 1
  AND (
    SELECT deleted_at
    FROM availability_windows
    WHERE id = OLD.availability_window_id
  ) IS NULL THEN
    RAISE EXCEPTION 'Cannot delete the last allowed duration for an active availability window.';
  END IF;

  RETURN OLD;
END;
$$;
