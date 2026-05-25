INSERT INTO resources (owner_id, name, description, capacity, is_active, deleted_at)
VALUES
  ( 
    (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL) ),
    'Meeting Room 1',
    'Medium sized dedicated office room for meetings',
    12,
    TRUE,
    NULL
  ), -- R1 - active, main resource for reservations, owner is U2 (re-uses name from deleted resource, R7)

  (
    (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL) ),
    'Meeting Room 1',
    'Small dedicated office room for meetings',
    8,
    TRUE,
    NULL
  ), -- R2 - active, multiple same day windows + secondary resource for reservations, owner is U3 (same name as R1, different user)

  (
    (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL) ),
    'Soccer Field',
    'average size soccer field',
    26,
    TRUE,
    NULL
  ), -- R3 - active, has windows but no resevations, owner is U2

  (
    (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL) ),
    'Basket Ball Court',
    'An average sized basket ball court',
    12,
    TRUE,
    NULL
  ), -- R4 - active, only one window, owner is U2

  (
    (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL) ),
    'Tennis Court',
    'Average size tennis court',
    9,
    TRUE,
    NULL
  ), -- R5 - active, only has expired windows, owner is U3

  (
    (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL) ),
    'Gym',
    'large room to workout',
     30,
     FALSE,
     NULL
  ), -- R6 - inactive, not deleted, owner is U2 

  (
    (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL) ),
    'Meeting Room 1',
    'Medium sized dedicated office room for meetings',
    12,
    FALSE,
    '2026-02-24T9:00:00Z'
  ); -- R7 - deleted, owner is U2 (non deleted user)