INSERT INTO availability_windows (resource_id, start_time, end_time, deleted_at, cancellation_notice_minutes)
VALUES
  -- R1 windows (W1 and W2)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-1') 
       AND (deleted_at IS NULL)
    ),
    '2036-03-20T9:00:00Z',
    '2036-03-20T17:00:00Z',
    NULL,
    1440
  ), -- W1, future window with only active reservations
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-1') 
       AND (deleted_at IS NULL)
    ),
    '2036-03-24T9:00:00Z',
    '2036-03-24T17:00:00Z',
    NULL,
    120
  ), -- W2, future window with both active and cancelled reservations

  -- R2 windows (W3 and W4)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-2') 
       AND (deleted_at IS NULL)
    ),
    '2036-06-24T10:00:00Z',
    '2036-06-24T12:00:00Z',
    NULL,
    120
  ), -- W3, future same day window # 1
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-2') 
       AND (deleted_at IS NULL)
    ),
    '2036-06-24T14:30:00Z',
    '2036-06-24T16:30:00Z',
    NULL,
    180
  ), -- W4, future same day window # 2

  -- R3 windows (W5 and W6)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-3') 
       AND (deleted_at IS NULL)
    ),
    '2035-06-20T13:00:00Z',
    '2035-06-20T16:00:00Z',
    NULL,
    90
  ), -- W5, future window with no reservations # 1
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-3') 
       AND (deleted_at IS NULL)
    ),
    '2035-07-22T13:00:00Z',
    '2035-07-22T16:00:00Z',
    NULL,
    90
  ), -- W6, future window with no reservations # 2

  -- R4 window (W7)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-4') 
       AND (deleted_at IS NULL)
    ),
    '2035-06-22T13:00:00Z',
    '2035-06-22T16:00:00Z',
    NULL,
    60
  ), -- W7, only non deleted window for R4

  -- R5 windows (W8 and W9)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-5') 
       AND (deleted_at IS NULL)
    ),
    '2025-01-24T10:30:00Z',
    '2025-01-24T12:30:00Z',
    NULL,
    240
  ), -- W8, expired historical window # 1 for active resource
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-5') 
       AND (deleted_at IS NULL)
    ),
    '2025-02-26T10:30:00Z',
    '2025-02-26T12:30:00Z',
    NULL,
    180
  ), -- W9, expired historical window # 2 for active resource

  -- R6 windows (W10 and W11) (inactive resources may still have historical/soft deleted windows)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'inactive-resource-1') 
       AND (deleted_at IS NULL)
    ),
    '2022-06-22T14:00:00Z',
    '2022-06-22T16:00:00Z',
    NULL,
    220
  ), -- W10, historical/expired window for inactive resource
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'inactive-resource-1') 
       AND (deleted_at IS NULL)
    ),
    '2037-06-22T14:00:00Z',
    '2037-06-22T16:00:00Z',
    '2026-01-22T16:00:00Z',
    220
  ), -- W11, soft deleted window for inactive resource

  -- R7 windows (W12 and W13), soft deleting a resource should only soft delete future windows, not historical
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'deleted-resource-1') 
       AND (deleted_at = '2026-02-24T9:00:00Z')
    ),
    '2037-06-22T14:00:00Z',
    '2037-06-22T16:00:00Z',
    '2026-02-24T9:00:00Z',
    1440
  ), -- W12, soft deleted window for soft deleted resource
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'deleted-resource-1') 
       AND (deleted_at = '2026-02-24T9:00:00Z')
    ),
    '2026-01-22T14:00:00Z',
    '2026-01-22T16:00:00Z',
    NULL,
    1440
  ); -- W13, expired window for soft deleted resource (expired windows do not get soft deleted)
