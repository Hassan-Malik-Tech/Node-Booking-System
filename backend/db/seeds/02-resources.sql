INSERT INTO resources (owner_id, name, description, capacity, is_active, deleted_at)
VALUES
  ( 
    (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL) ),
    'active-resource-1',
    'active resource 1 description',
    12,
    TRUE,
    NULL
  ), -- R1 - active, main resource for reservations, owner is U2

  (
    (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL) ),
    'active-resource-2',
    'active resource 2 description',
    8,
    TRUE,
    NULL
  ), -- R2 - active, multiple same day windows + secondary resource for reservations, owner is U3

  (
    (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL) ),
    'active-resource-3',
    'active resource 3 description',
    26,
    TRUE,
    NULL
  ), -- R3 - active, has windows but no resevations, owner is U2

  (
    (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL) ),
    'active-resource-4',
    'active resource 4 description',
    12,
    TRUE,
    NULL
  ), -- R4 - active, only one window, owner is U2

  (
    (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL) ),
    'active-resource-5',
    'active resource 5 description',
    9,
    TRUE,
    NULL
  ), -- R5 - active, only has expired windows, owner is U3

  (
    (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL) ),
    'inactive-resource-1',
    'inactive resource 1 description',
     30,
     FALSE,
     NULL
  ), -- R6 - inactive, not deleted, owner is U2 

  (
    (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL) ),
    'deleted-resource-1',
    'deleted resource 1 description',
    12,
    FALSE,
    '2026-02-24T9:00:00Z'
  ); -- R7 - deleted, owner is U2 (non deleted user)
