CREATE TABLE users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL, -- in the backend do username = username.trim()
  password_hash TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL, 
  token_version INTEGER NOT NULL DEFAULT 0, -- for token revocation after password change or other situations (update it with +1)
  -- enforce valid email in the backend (tricky as there are unusual valid emails like user@[192.168.1.10])
  role TEXT NOT NULL DEFAULT 'user', 
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- make it so that a soft deleted user cannot be un-deleted (backend logic in step 5)
  -- TIMESTAMPTZ NOT NULL DEFAULT NOW() does not automatically make it UTC, you have to make it TC by stting it in the current session, the database, and the role/user.
  -- PostgreSQL stores it internally in a UTC-based form, The part that changes is mostly display/output, which follows the session timezone. 
  CONSTRAINT user_role_check CHECK (role IN ('user', 'employee', 'admin')),
  -- add employee role in step 8 (they can only complete a reservation)
  -- admin can fill the manager role
  -- these 3 are simple but enough for a junior project
  -- employee/admin can mark reservations completed
  -- this is a simple model cause one employee in this system has access to all resources/reservations
  -- in a better system it would be per location
  -- can also add a location table in a more advanced version of this booking system after completion in a seperate repo


  CONSTRAINT users_valid_username_length
    CHECK (length(trim(username)) BETWEEN 3 AND 30), 

  CONSTRAINT users_username_must_be_trimmed
    CHECK (username = trim(username)),

  CONSTRAINT users_username_correctness_check 
    CHECK (username ~ '^[a-zA-Z0-9_]+$'),

  CONSTRAINT users_valid_password_hash
    CHECK (length(trim(password_hash)) > 0),

  CONSTRAINT users_password_hash_must_be_trimmed
    CHECK (password_hash = trim(password_hash)),

  -- db reject empty string emails and emails with white space(extra gaurd) while backend enorced email correctness (as well as trim())
  CONSTRAINT users_valid_email
    CHECK (length(trim(email)) > 0), 

  CONSTRAINT users_email_must_be_trimmed
    CHECK (email = trim(email)),

  -- the name constraints only apply if the user chooses to have a name
  CONSTRAINT users_name_must_be_trimmed 
    CHECK ((name IS NULL) OR (name = trim(name))),

  CONSTRAINT users_valid_name
    CHECK ((name IS NULL) OR (length(trim(name)) > 0))
);

CREATE UNIQUE INDEX unique_email_for_non_deleted_user_idx 
ON users (lower(email))
WHERE deleted_at IS NULL;
  -- partial unique index
  -- this is used so that email is only unique if it is not soft deleted, as soon as it is soft deleted, it is no longer unique
  -- this is good because if a user gets soft-deleted, another user can be created using that email
CREATE UNIQUE INDEX unique_username_for_non_deleted_user_idx 
ON users (lower(username))
WHERE deleted_at IS NULL;

-- with backend logic make it so that a soft deleted user cannot creat more resources, or more reservations
-- also make it so that all active reservations for the soft deleted user become cancelled and the resources owned by that soft deleted user also become soft deleted.

CREATE TABLE resources (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL, -- in the backend trim the name
  description TEXT,
  capacity INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- make it so that a soft deleted resource cannot be un-deleted (backend logic in step 5)

  CONSTRAINT resources_valid_name_length_check
    CHECK (length(trim(name)) BETWEEN 1 AND 100), 

  CONSTRAINT resources_name_must_be_trimmed_check
    CHECK (name = trim(name)), -- prevents something like " name "
    -- can trim name in backend before validation/storage (so this contraint is just extra gaurd)

  CONSTRAINT resources_name_allowed_chars_check
    CHECK (name ~ '^[a-zA-Z0-9 #''()-]+$'),
    -- - must be at the end to prevent range
    -- '' allows ' and in postgres you cannot do "[]"
    -- with only one ' it would end the string, so it would not work
    -- '' is for string literals (regex needs a string)
    -- "" is for identifiers like column name or tablle like SELECT "createdAt" FROM users;
  CONSTRAINT resources_name_has_alphanumeric_check
    CHECK (name ~ '[a-zA-Z0-9]'),
    -- prevents resource names with just #, ', and/or -
    -- there must be at least one alphanumeric character
  
  CONSTRAINT resources_no_multi_space_name_check
    CHECK (name NOT LIKE '%  %'),
    -- this is here to prevent someone from inserting:
    --"meeting   room"
    -- this prevents both: "meeting room" and "meeting   room" from existing
    -- for junior scope I will just stop here and not go beyond this with more white space rules and with slug rules (-)
    -- so 'meeting room' and 'meeting-room' can exist.

  CONSTRAINT resources_valid_description_check
    CHECK ((description IS NULL) OR (length(trim(description)) > 0)),

  CONSTRAINT resources_description_must_be_trimmed_check
    CHECK ((description IS NULL) OR (description = trim(description))),

  CONSTRAINT resources_owner_id_fkey
    FOREIGN KEY (owner_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT resource_capacity_check
    CHECK (capacity > 0),
    -- for a PATCH request lowering capacity, reject patch that lowers capacity and there are reservations that exceed the new capacity(dont cancel them, reject the patch request)
    -- A resource capacity cannot be lowered below the party_size of any active reservation for that resource.
    -- capacity in my booking system means that if a room has a capacity of 8 people
    -- it can only fit 8 people not that there can be 8 overlapping reservations
    -- my booking system is one reservation per timeslot for a resource
    -- so 2 people cannot book that resource at one time, only one booking per time slot
  CONSTRAINT valid_is_active_deleted_at_check
    CHECK ( 
         (is_active = TRUE AND deleted_at IS NULL) 
      OR (is_active = FALSE AND deleted_at IS NULL) 
      OR (is_active = FALSE AND deleted_at IS NOT NULL) 
    )
      -- active + deleted is not allowed
      -- can enforce in the backend that deleting a resource automatically makes it in-active and can never become active again
        -- can also do it with triggers
);

CREATE UNIQUE INDEX unique_name_for_non_deleted_resource_per_owner
  ON resources (lower(name), owner_id)
  WHERE deleted_at IS NULL;

-- can enforce backend logic to prevent hard deletion of a resource that has no availability_window pointing to is due to is_active being false (can also do it in the database with triggers, but I dont know that yet)
-- it is also realistic for someone to make a resource as inactive initially so it begins with no availability_window pointing to it.
-- can also make it so that if is_active goes from false to true, that it makes availability windows 
-- can make it so that if it goes from true to false, that the availability_windows are deleted
  -- both of these can be enforced in the backend code.
-- If a resource is deactivated, all availability windows should remain to keep hard delete enforcement (can further enforce in the db level or backend as well). But when reactivated the old activity windows must be removed and replaced with new ones. 

-- can also enforce in the backend logic that once a resource is deleted, it can never become active again.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE availability_windows (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id INTEGER NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL, -- query with end_time >= NOW() AND deleted_at IS NULL to filter out expired windows
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
  deleted_at TIMESTAMPTZ,
  cancellation_notice_minutes INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT availability_windows_no_overlap_or_adjacency
    EXCLUDE USING gist (
      resource_id WITH =,
      tstzrange(start_time, end_time, '[]') WITH &&
    ) -- [] controls whether endpoints are included in the range ([] includes both end points)
    WHERE (deleted_at IS NULL),
    -- no allowing adjacency leads to simplier reads(queries) but is more restrictive (in the advanced version, make it adjacency allowed for flexibility like if 2 adjacent windows want different allowed_durations)
    -- this is fine for my junior project

  CONSTRAINT cancellation_notice_greater_than_or_equal_to_zero_check
    CHECK (cancellation_notice_minutes >= 0),
    -- reservations must not be cancelled after the period (enforce this in the backend)

  CONSTRAINT  valid_availability_window_check
    CHECK (end_time > start_time),

  CONSTRAINT availability_windows_half_hour_boundary_check
  CHECK (
    EXTRACT(MINUTE FROM (start_time AT TIME ZONE 'UTC')) IN (0, 30)
    AND EXTRACT(SECOND FROM (start_time AT TIME ZONE 'UTC')) = 0
    AND EXTRACT(MINUTE FROM (end_time AT TIME ZONE 'UTC')) IN (0, 30)
    AND EXTRACT(SECOND FROM (end_time AT TIME ZONE 'UTC')) = 0
  ), 
    -- In my schema I want to enforce that an availability window can only be on :00 or :30 for both start_time and end_time
    -- my entire project is in UTC for simplicity
    -- in the front end just convert it to local time (in Toronto that sill lines up with :00 and :30)

  CONSTRAINT availability_windows_resource_id_fkey
    FOREIGN KEY (resource_id)
    REFERENCES resources(id)
    ON DELETE RESTRICT,

  UNIQUE(id, resource_id) 
  -- This UNIQUE exists so that the composite foreign key in reservations can reference (id, resource_id) on availability_windows.
  -- Postgres requires that a composite foreign key reference that exact composite(PK or UNIQUE) in the referenced table
);

-- ON DELETE RESTRICT is here as a gaurd against hard deleting a resource (resources are only to be soft deleted)
-- As long as the resource_id points to the resource, hard deleting the resource is impossible in the database level (even without backend logic).
-- this does not prevent someone from seeding a resource that is already deleted. This can be enforced in the backend but I dont know how to do so in the database (to prevent someone from seeding it directly in the database).
-- I will just not account for the extreme case of someone seeding an already deleted resource directly in the database, just can do so in the backend to prevent clients from doing that.
-- Do not not seed it, just test it client side.
-- can also solve this with trigger

-- with backend logic first an with trigger as a gaurd make it so that inactive or soft-deleted resources cannot receive new availability windows

CREATE TABLE availability_window_allowed_durations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  availability_window_id INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,

  CONSTRAINT awad_aw_id_fkey
    FOREIGN KEY (availability_window_id)
    REFERENCES availability_windows(id)
    ON DELETE RESTRICT,

  CONSTRAINT awad_positive_check
    CHECK (duration_minutes > 0),

  CONSTRAINT awad_15_min_interval_check
    CHECK (duration_minutes % 15 = 0), -- enforce with joi as well

  CONSTRAINT unique_duration_per_window
    UNIQUE(availability_window_id, duration_minutes)
);
-- in the backend enforce that a reservation must fall in one of the availability windows plus one of the allowed durrations
-- and make it so that when a resource is created at least one availability window must be created plus at least one allowed durration in that window for an active resource.
-- deactivating a resource should delete allowed durations and soft deleted availability windows on that resource
-- activating a resource must require the same as above making aw's and allowed durations
-- soft deleting aw should delete all allowed durations on that window
-- in the backend make it so that if the duration is longer than the availability window start_time - end_time, the insert or update is rejected.
-- do not make seperate end points for this, instead joiin it with availability_windows ion the end points
-- make it so that you cannot delete the last duration for a non soft deleted window, you can only add or update



CREATE TABLE reservations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id INTEGER NOT NULL,
  availability_window_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL, -- meaning the user who is making the reservation
  staff_completed_by_user_id INTEGER,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  cancelled_at TIMESTAMPTZ, 
  system_completed_at TIMESTAMPTZ, -- for auto complete by extention
  staff_completed_at TIMESTAMPTZ, -- for employee/admin complete
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- add logic to make it so that once a reservation is cancelled, it cannot be un-cancelled (backend)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  party_size INTEGER NOT NULL,
  -- in the backend make it so that the party_size must be less than or equal to the capacity of the resource that is trying to be booked.

  CONSTRAINT reservations_no_overlap
    EXCLUDE USING gist (
      resource_id WITH =,
      tstzrange(start_time, end_time, '[)') WITH &&
    )
    WHERE (status IN ('active', 'completed')),
    -- since my booking system is one booking per resource per time slot, it does not make sense logically for an active and complete reservation to overlap.
    -- this exclusion constraint works because my booking system is one reservation for a resource per timeslot
    -- so it rejects any overlapping bookings for that resource for that timeslot (it works since only one is allowed any way)

  CONSTRAINT min_party_size_is_one
    CHECK (party_size > 0),

  CONSTRAINT valid_reservation_time_check
    CHECK (end_time > start_time), 

  CONSTRAINT reservation_status_check
    CHECK (status IN ('active', 'cancelled', 'completed')), 
    -- remove white space in the backend even a gaurd in here in the db
    -- for list end times for active reservations
    -- filter out cancelled reservations, completed reservations
    -- and reservations that are status = 'active' AND end_time > NOW()
    -- also consider using setInterval every minute plus on start up to
    -- update every reservation from active to complete is NOW() >= end_time
    -- along with the filtering above, not without it
    -- you can also get an extention to clean up the reservations periodically lik:
    -- Graphile Worker (learn this)
    -- with this you still need to query status = 'active' AND end_time > NOW()
    -- fast implementation first(setInterval), then after my backend is more developed and tested, Graphile Worker
    
    -- for creation client(user) should not have access to status, it defaults to active (but it is returned)
    -- on update, they can cancell or complete

  CONSTRAINT valid_status_timestamp_check
    CHECK (
        (
            status = 'active'
          AND cancelled_at IS NULL
          AND system_completed_at IS NULL
          AND staff_completed_at IS NULL
          AND staff_completed_by_user_id IS NULL
        )
      OR (
            status = 'cancelled'
          AND cancelled_at IS NOT NULL
          AND system_completed_at IS NULL
          AND staff_completed_at IS NULL
          AND staff_completed_by_user_id IS NULL
        )
      OR (
            status = 'completed'
          AND cancelled_at IS NULL
          AND (
            system_completed_at IS NOT NULL
            OR staff_completed_at IS NOT NULL
          )
          AND (
            (staff_completed_at IS NULL AND staff_completed_by_user_id IS NULL)
            OR (staff_completed_at IS NOT NULL AND staff_completed_by_user_id IS NOT NULL)
          )
        )
    ),

  CONSTRAINT reservations_quarter_hour_boundary_check
    CHECK (
      EXTRACT(MINUTE FROM (start_time AT TIME ZONE 'UTC')) IN (0, 15, 30, 45)
      AND EXTRACT(SECOND FROM (start_time AT TIME ZONE 'UTC')) = 0
      AND EXTRACT(MINUTE FROM (end_time AT TIME ZONE 'UTC')) IN (0, 15, 30, 45)
      AND EXTRACT(SECOND FROM (end_time AT TIME ZONE 'UTC')) = 0
    ), 
  
  CONSTRAINT reservations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT reservations_resource_id_fkey
    FOREIGN KEY (resource_id)
    REFERENCES resources(id)
    ON DELETE RESTRICT,

  
  CONSTRAINT reservations_staff_completed_by_user_id_fkey
    FOREIGN KEY (staff_completed_by_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT reservations_window_resource_fkey
    FOREIGN KEY (availability_window_id, resource_id)
    REFERENCES availability_windows (id, resource_id)
    ON DELETE RESTRICT
    -- this make querying easier cause instead of querying for all availability windows for the resource being reserved and seeing if it fits in one of them plus fits with one of the allowed durations, I just check the window that is being referenced and reject if it does not fit while ignoring the rest.
    -- This also prevents the availability_window_id from referencing a completely different resource than the one being booked
);
-- can add logic in the backend that so that reservations are only valid if they fall inside the resource availability window.
-- with trigger + backend logic enforce that inactive or soft-deleted resources cannot receive new reservations
-- add overlap logic with exclusion constraint allowing adjancency overlap to exist for one resource
-- only for active reservations
-- also it does not make sense for an active reservation and completed reservation for one resource to exist at the same time in this schema.

-- indexes to start with before backend database logic is even written (may change later)
CREATE INDEX idx_resources_owner_id ON resources(owner_id);
CREATE INDEX idx_resources_is_active ON resources(is_active);
CREATE INDEX idx_resources_deleted_at ON resources(deleted_at);

CREATE INDEX idx_availability_resource_start 
  ON availability_windows(resource_id, start_time);
CREATE INDEX idx_availability_windows_non_deleted_end_time
ON availability_windows(end_time)
WHERE deleted_at IS NULL; -- because I filter out expired windows

CREATE INDEX idx_reservations_user_created 
  ON reservations(user_id, created_at);
CREATE INDEX idx_reservations_resource_start 
  ON reservations(resource_id, start_time);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_active_end_time
ON reservations(end_time)
WHERE status = 'active'; -- because I filter out expired reservations



-- remember updated_at for all the tables needs to be handles consistently by the backend logic, dont forget this

-- Once a user or resource is soft deleted, it cannot be restored. However, a new user may still be created with the same email after the previous user is soft deleted, and a resource owner may still create a new resource with the same name after all of their resources with that name have been soft deleted. These rules are enforced in the backend.

----
-- original step 5 rules wording
----
-- add logic in the backend that so that reservations are only valid if they fall inside the resource availability window
-- The backend can enforce that one owner cannot have more than one of the same resource name unless all the resources with that name belonging to that owner are soft deleted, only then can the owner make the resource again. But if the resource with that name belonging to that owner exists in the resource table and it is not soft deleted, then it is blocked.
-- Test both self-booking and non-self-booking reservation scenarios 
-- reservation-user vs resource-owner relationship testing 



-- prevent invalid overlapping seeding with a trigger(or exclusion constraint) (for seeding) and in the backend for clients
-- js: a.start < b.end && a.end > b.start (a starts before b ends AND a ends after b starts)
-- the main area for overlap logic is the backend not the database

-- for interviews it is better to have most of the overlap logic in the backend, this is better to showcase in interviews
-- so limit the database implementation of overlap logic to seeding


--------------------------------------
-- INVARIANTS/LIFECYCLE 
--------------------------------------

-- make it so that soft deleteing a resource deletes all the availability windows on that resource id and cancells all the reservations on that resource id
-- deactivating a resource should delete all availability windows on that resource id
-- can be done with a trigger

-- soft deleting a user should cancell the reservations that user has
-- soft deleting a user should soft delete all the resources that user owned and all availability windows on the users resources
-- these 2 can be done in one transaction (optional trigger for extra gaurd)

-- these sould be in service-level functions such as 
  -- softDeleteResource(resourceId)
  -- softDeleteUser(userId)
-- they should not be scattered randomly

-- make sure to enforce valid email in the backend (with joi validation) 
-- email: Joi.string().trim().lowercase().email().required()

-- resource exists but is inactive and should not accept new reservations

-- Availability windows for the same resource must not overlap or be adjacent.
-- Boundary-touching windows are not allowed.
--
-- Not allowed:
-- 09:00–10:00
-- 10:00–11:00
--
-- If the owner wants continuous availability, they should create one window:
-- 09:00–11:00
--
-- Allowed:
-- 09:00–10:00
-- 10:01–11:00
--
-- Best enforced at the DB level with and exclusion constraint(EXCLUDE USING gist).

-- Deleting an availability window should cancel active reservations for that
-- resource whose reserved time falls within that deleted window.
--
-- Since availability windows for a resource cannot overlap or be adjacent,
-- a reservation covered by the deleted window cannot remain valid through
-- another overlapping/touching window.
--
-- Best enforced in backend transaction logic.
--
-- But be consistent when updating windows too.
-- For example, if someone edits a window and makes it touch another one, it should be rejected.

-- for overlap detection(on availability windows) do it in both backend end and db(EXCLUDE USING gist) and explain it well in an interview
-- backend for clarity, database for integrity
-- overlap prevention is different for availability windows and reservations
-- for availability windwos you have to reject overlap and adjacent (for one resource)
-- for reservations adjacent reservations(for one resource) is fine overlap is not
-- so reservation 1: 9:00 to 10:00 and reservation 2: 10:00 to 11:00 for that resource is fine unlike availability windows

-- race conditions (e.g., double booking) 
-- SELECT ... FOR UPDATE 
-- transactional integrity for booking

-- test race condition by:
-- fire 5–10 concurrent booking requests (learn how to do this)
-- same resource, same time slot
-- only 1 succeeds
-- others fail cleanly

-- CLI to fire 10 concurrent booking requests (log it)
-- npx autocannon -c 10 -a 10 \
--   -m POST \
--   -H "Content-Type: application/json" \
--   -b '{"resourceId":1,"startTime":"2026-04-20T10:00:00Z","endTime":"2026-04-20T11:00:00Z","partySize":2}' \
--   http://localhost:3000/reservations

-- use a trigger to automate updated_at

-- I plan on adding soft delete for availability windows to block hard deletion of resources(and for historical record) since the soft deleted availability window would always be pointing to that resource even after soft deletion(along with on delete restrict). the only exception is if someone created an in active resource(that would start off with no availability window). I would also enforce that if someone creates an active resource, they must also created availability windows and if someone reactivated an inactive resource, they must include an availability window.
-- also make it so that if an owner inserts an inactive resource, they cannot insert availability windows for it until activation of the resource.

-- in the backend enforce that an availability window insert must be start_time >= now()
-- filter for usable windows by using: deleted_at IS NULL AND end_time > now() 
-- this filters out both expired and soft deleted windows
-- for normal availability

-- reservations should not update resource_id, they must make a new reservation 

-- do not allow updates for foreign keys.
  -- for example, if resource_id is decided in the reservation, you cannot change it, you must cancel the reservation and make a new one
  -- in the bakcned allow list do not list foreign keys
  -- final gaurd as a trigger in the db

-- When a resource is soft-deleted or made inactive, soft-delete that resource’s availability windows whose end_time > NOW(). Keep windows whose end_time <= NOW() for historical record.
-- so do not soft delete historical windows

-- Normal users can cancel their own reservations only before the cancellation deadline.
-- Employees/admins can cancel reservations operationally after the deadline.
-- However, if an employee/admin is cancelling their own reservation, they are treated
-- as the reservation owner, not as staff, so the normal cancellation deadline still applies.
-- add this to the ReservationPolicy class
