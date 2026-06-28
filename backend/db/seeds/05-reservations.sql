INSERT INTO reservations (resource_id, availability_window_id, user_id, staff_completed_by_user_id, start_time, end_time, status, cancelled_at, system_completed_at, staff_completed_at, party_size)
VALUES
  -- R1, W1 (RES 1 and RES 2) (only active reservations)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-1') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-20T9:00:00Z')
       AND (end_time = '2036-03-20T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    NULL,
    '2036-03-20T9:00:00Z',
    '2036-03-20T9:15:00Z',
    'active',
    NULL,
    NULL,
    NULL,
    10
  ), -- RES 1, active, 15-minute duration
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-1') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-20T9:00:00Z')
       AND (end_time = '2036-03-20T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_5') AND (deleted_at IS NULL) ),
    NULL,
    '2036-03-20T9:15:00Z',
    '2036-03-20T10:00:00Z',
    'active',
    NULL,
    NULL,
    NULL,
    12
  ), -- RES 2, active adjacent to RES 1, 45-minute duration

  -- R1, W2 (RES 3 and RES 4) (both active and cancelled reservations)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-1') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-24T9:00:00Z')
       AND (end_time = '2036-03-24T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    NULL,
    '2036-03-24T10:00:00Z',
    '2036-03-24T10:45:00Z',
    'cancelled',
    '2025-03-24T7:00:00Z',
    NULL,
    NULL,
    10
  ), -- RES 3, cancelled, 45-minute duration
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-1') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-24T9:00:00Z')
       AND (end_time = '2036-03-24T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_5') AND (deleted_at IS NULL) ),
    NULL,
    '2036-03-24T10:00:00Z',
    '2036-03-24T10:45:00Z',
    'active',
    NULL,
    NULL,
    NULL,
    8
  ), -- RES 4, active, 45-minute duration

   -- R2, W3 (future same day window # 1) (RES 5)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-2') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-2')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T10:00:00Z')
       AND (end_time = '2036-06-24T12:00:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    NULL,
    '2036-06-24T10:00:00Z',
    '2036-06-24T11:15:00Z',
    'active',
    NULL,
    NULL,
    NULL,
    8
  ), -- RES 5, active, 75-minute duration
  
  -- R2, W4 (future same day window # 2) (RES 6)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-2') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-2')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T14:30:00Z')
       AND (end_time = '2036-06-24T16:30:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_5') AND (deleted_at IS NULL) ),
    NULL,
    '2036-06-24T14:45:00Z',
    '2036-06-24T16:00:00Z',
    'active',
    NULL,
    NULL,
    NULL,
    6
  ), -- RES 6, active, 75-minute duration

  -- R4, W7 (one window only) (RES 7)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-4') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-4')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-22T13:00:00Z')
       AND (end_time = '2035-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    NULL,
    '2035-06-22T14:00:00Z',
    '2035-06-22T15:15:00Z',
    'active',
    NULL,
    NULL,
    NULL,
    12
  ), -- RES 7, active, 75-minute duration

  -- R5, W8 (historical window # 1) (RES 8, RES 9, RES 10, and RES 11)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-5') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-5')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-01-24T10:30:00Z')
       AND (end_time = '2025-01-24T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_5') AND (deleted_at IS NULL) ),
    (SELECT id FROM users WHERE (username = 'employee_username_1') AND (deleted_at IS NULL) ),
    '2025-01-24T10:30:00Z',
    '2025-01-24T11:15:00Z',
    'completed',
    NULL,
    NULL,
    '2025-01-24T11:15:00Z',
    4
  ), -- RES 8, completed, 45-minute duration
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-5') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-5')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-01-24T10:30:00Z')
       AND (end_time = '2025-01-24T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    (SELECT id FROM users WHERE (username = 'employee_username_1') AND (deleted_at IS NULL) ),
    '2025-01-24T11:15:00Z',
    '2025-01-24T12:00:00Z',
    'completed',
    NULL,
    NULL,
    '2025-01-24T12:00:00Z',
    6
  ), -- RES 9, completed adjacent to RES 8, 45-minute duration
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-5') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-5')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-01-24T10:30:00Z')
       AND (end_time = '2025-01-24T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_5') AND (deleted_at IS NULL) ),
    NULL,
    '2025-01-24T12:00:00Z',
    '2025-01-24T12:15:00Z',
    'completed',
    NULL,
    '2025-01-24T12:15:00Z',
    NULL,
    4
  ), -- RES 10, system-only completed, 15-minute duration
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-5') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-5')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-01-24T10:30:00Z')
       AND (end_time = '2025-01-24T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    (SELECT id FROM users WHERE (username = 'employee_username_1') AND (deleted_at IS NULL) ),
    '2025-01-24T12:15:00Z',
    '2025-01-24T12:30:00Z',
    'completed',
    NULL,
    '2025-01-24T12:30:00Z',
    '2025-01-24T12:25:00Z',
    6
  ), -- RES 11, staff + system completed, 15-minute duration

  -- R5, W9 (historical window # 2) (RES 12 and RES 13)
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-5') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-5')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-02-26T10:30:00Z')
       AND (end_time = '2025-02-26T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_5') AND (deleted_at IS NULL) ),
    NULL,
    '2025-02-26T10:30:00Z',
    '2025-02-26T11:45:00Z',
    'cancelled',
    '2025-02-26T6:30:00Z',
    NULL,
    NULL,
    9
  ), -- RES 12, cancelled, 75-minute duration
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
       AND (name = 'active-resource-5') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_2') AND (deleted_at IS NULL)))
          AND (name = 'active-resource-5')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-02-26T10:30:00Z')
       AND (end_time = '2025-02-26T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    (SELECT id FROM users WHERE (username = 'employee_username_1') AND (deleted_at IS NULL) ),
    '2025-02-26T10:30:00Z',
    '2025-02-26T12:30:00Z',
    'completed',
    NULL,
    NULL,
    '2025-02-26T12:30:00Z',
    9
  ), -- RES 13, completed max duration

  -- R6(inactive), W10(expired), RES 14
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'inactive-resource-1') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'inactive-resource-1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2022-06-22T14:00:00Z')
       AND (end_time = '2022-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    (SELECT id FROM users WHERE (username = 'employee_username_1') AND (deleted_at IS NULL) ),
    '2022-06-22T14:00:00Z',
    '2022-06-22T14:45:00Z',
    'completed',
    NULL,
    NULL,
    '2022-06-22T14:45:00Z',
    30
  ), -- RES 14, completed, 45-minute duration. Completed historical reservations do not get cancelled by deactivation; only future windows do.

  -- R6(inactive), W11(soft deleted, so no durations), RES 15
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'inactive-resource-1') 
       AND (deleted_at IS NULL)
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'inactive-resource-1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2037-06-22T14:00:00Z')
       AND (end_time = '2037-06-22T16:00:00Z')
       AND (deleted_at = '2026-01-22T16:00:00Z')
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_5') AND (deleted_at IS NULL) ),
    NULL,
    '2037-06-22T14:00:00Z',
    '2037-06-22T15:00:00Z',
    'cancelled',
    '2026-01-22T16:00:00Z',
    NULL,
    NULL,
    25
  ), -- RES 15, cancelled due to window being soft deleted

  -- R7(soft deleted), W12(soft deleted window) also no durations, RES 16
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'deleted-resource-1') 
       AND (deleted_at = '2026-02-24T9:00:00Z')
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'deleted-resource-1')
          AND (deleted_at = '2026-02-24T9:00:00Z')
       ))
       AND (start_time = '2037-06-22T14:00:00Z')
       AND (end_time = '2037-06-22T16:00:00Z')
       AND (deleted_at = '2026-02-24T9:00:00Z')
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_4') AND (deleted_at IS NULL) ),
    NULL,
    '2037-06-22T15:00:00Z',
    '2037-06-22T16:00:00Z',
    'cancelled',
    '2026-02-24T9:00:00Z',
    NULL,
    NULL,
    12
  ), -- RES 16, cancelled for soft deleted resource

  -- R7(soft deleted), W13(expired window), RES 17
  (
    (
      SELECT id FROM resources 
      WHERE 
       (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
       AND (name = 'deleted-resource-1') 
       AND (deleted_at = '2026-02-24T9:00:00Z')
    ),
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'dev_username_1') AND (deleted_at IS NULL)))
          AND (name = 'deleted-resource-1')
          AND (deleted_at = '2026-02-24T9:00:00Z')
       ))
       AND (start_time = '2026-01-22T14:00:00Z')
       AND (end_time = '2026-01-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    (SELECT id FROM users WHERE (username = 'dev_username_5') AND (deleted_at IS NULL) ),
    (SELECT id FROM users WHERE (username = 'employee_username_1') AND (deleted_at IS NULL) ),
    '2026-01-22T14:00:00Z',
    '2026-01-22T15:00:00Z',
    'completed',
    NULL,
    NULL,
    '2026-01-22T15:00:00Z',
    8
  ); -- RES 17, Expired for soft deleted resource
