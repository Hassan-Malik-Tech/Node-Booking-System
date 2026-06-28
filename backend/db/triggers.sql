-------------------------------------------
-- triggers to automate updated_at
-------------------------------------------

CREATE OR REPLACE TRIGGER trg_before_users_set_updated_at
BEFORE UPDATE
ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_before_resources_set_updated_at
BEFORE UPDATE
ON resources
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_before_aw_set_updated_at
BEFORE UPDATE
ON availability_windows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_before_reservations_set_updated_at
BEFORE UPDATE
ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

------------------------------------------------------------------------------
-- triggers to block hard-delete on soft-delete/cancel only tables
------------------------------------------------------------------------------

CREATE OR REPLACE TRIGGER trg_before_users_block_hard_delete
BEFORE DELETE
ON users
FOR EACH ROW
EXECUTE FUNCTION block_hard_delete();

CREATE OR REPLACE TRIGGER trg_before_resources_block_hard_delete
BEFORE DELETE
ON resources
FOR EACH ROW
EXECUTE FUNCTION block_hard_delete();

CREATE OR REPLACE TRIGGER trg_before_aw_block_hard_delete
BEFORE DELETE
ON availability_windows
FOR EACH ROW
EXECUTE FUNCTION block_hard_delete();

CREATE OR REPLACE TRIGGER trg_before_reservations_block_hard_delete
BEFORE DELETE
ON reservations
FOR EACH ROW
EXECUTE FUNCTION reservations_block_hard_delete();

----------------------------------------------------------------
-- Irreversible soft-delete/reservation cancellation triggers
----------------------------------------------------------------

CREATE OR REPLACE TRIGGER trg_before_users_irreversible_soft_delete
BEFORE UPDATE OF deleted_at
ON users
FOR EACH ROW
EXECUTE FUNCTION irreversible_soft_delete();

CREATE OR REPLACE TRIGGER trg_before_resources_irreversible_soft_delete
BEFORE UPDATE OF deleted_at
ON resources
FOR EACH ROW
EXECUTE FUNCTION irreversible_soft_delete();

CREATE OR REPLACE TRIGGER trg_before_aw_irreversible_soft_delete
BEFORE UPDATE OF deleted_at
ON availability_windows
FOR EACH ROW
EXECUTE FUNCTION irreversible_soft_delete();

CREATE OR REPLACE TRIGGER trg_before_reservations_irreversible_cancellation
BEFORE UPDATE OF cancelled_at
ON reservations
FOR EACH ROW
EXECUTE FUNCTION irreversible_reservation_cancellation();

CREATE OR REPLACE TRIGGER trg_before_reservations_irreversible_completion
BEFORE UPDATE OF status
ON reservations
FOR EACH ROW
EXECUTE FUNCTION irreversible_reservation_completion();

----------------------------------------------------------------
-- Block child writes against soft-deleted parents triggers
----------------------------------------------------------------

CREATE OR REPLACE TRIGGER trg_before_reservations_no_booking_inactive_or_deleted_resource
BEFORE INSERT
ON reservations
FOR EACH ROW
EXECUTE FUNCTION no_reservations_for_inactive_or_deleted_resource();

CREATE OR REPLACE TRIGGER trg_before_reservations_deleted_user_cannot_book_a_resource
BEFORE INSERT
ON reservations
FOR EACH ROW
EXECUTE FUNCTION no_reservations_for_deleted_user();

CREATE OR REPLACE TRIGGER trg_before_aw_no_windows_for_inactive_or_deleted_resource
BEFORE INSERT 
ON availability_windows
FOR EACH ROW
EXECUTE FUNCTION no_availability_windows_for_inactive_or_deleted_resource();

CREATE OR REPLACE TRIGGER trg_before_aw_allowed_durations_no_durations_for_deleted_aw
BEFORE INSERT
ON availability_window_allowed_durations
FOR EACH ROW
EXECUTE FUNCTION no_durations_for_deleted_availability_window();

----------------------------------------------------------------
-- Others
----------------------------------------------------------------

CREATE OR REPLACE TRIGGER trg_before_aw_allowed_trg_aw_duration_max_10_for_window
BEFORE INSERT
ON availability_window_allowed_durations
FOR EACH ROW
EXECUTE FUNCTION max_number_of_durations_for_window();

CREATE OR REPLACE TRIGGER trg_before_aw_duration_keep_one
BEFORE DELETE
ON availability_window_allowed_durations
FOR EACH ROW
EXECUTE FUNCTION prevent_deleting_last_allowed_duration();

-- Can only delete admins through db not an http request.
CREATE OR REPLACE TRIGGER trg_before_users_prevent_deleting_last_admin
BEFORE UPDATE OF deleted_at
ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_deleting_last_admin();

CREATE OR REPLACE TRIGGER trg_before_users_prevent_updating_last_admin_role
BEFORE UPDATE OF role
ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_updating_last_admin_role();