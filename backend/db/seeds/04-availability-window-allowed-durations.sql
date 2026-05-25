INSERT INTO availability_window_allowed_durations (availability_window_id, duration_minutes)
VALUES
  -- W1 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-20T9:00:00Z')
       AND (end_time = '2036-03-20T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    15
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-20T9:00:00Z')
       AND (end_time = '2036-03-20T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    30
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-20T9:00:00Z')
       AND (end_time = '2036-03-20T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-20T9:00:00Z')
       AND (end_time = '2036-03-20T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-20T9:00:00Z')
       AND (end_time = '2036-03-20T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    75
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-20T9:00:00Z')
       AND (end_time = '2036-03-20T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    90
  ),

  -- W2 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-24T9:00:00Z')
       AND (end_time = '2036-03-24T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    15
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-24T9:00:00Z')
       AND (end_time = '2036-03-24T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    30
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-24T9:00:00Z')
       AND (end_time = '2036-03-24T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-03-24T9:00:00Z')
       AND (end_time = '2036-03-24T17:00:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),

  -- W3 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T10:00:00Z')
       AND (end_time = '2036-06-24T12:00:00Z')
       AND (deleted_at IS NULL)
    ),
    15
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T10:00:00Z')
       AND (end_time = '2036-06-24T12:00:00Z')
       AND (deleted_at IS NULL)
    ),
    30
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T10:00:00Z')
       AND (end_time = '2036-06-24T12:00:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T10:00:00Z')
       AND (end_time = '2036-06-24T12:00:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T10:00:00Z')
       AND (end_time = '2036-06-24T12:00:00Z')
       AND (deleted_at IS NULL)
    ),
    75
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T10:00:00Z')
       AND (end_time = '2036-06-24T12:00:00Z')
       AND (deleted_at IS NULL)
    ),
    90
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T10:00:00Z')
       AND (end_time = '2036-06-24T12:00:00Z')
       AND (deleted_at IS NULL)
    ),
    120
  ), -- max window duration

  -- W4 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T14:30:00Z')
       AND (end_time = '2036-06-24T16:30:00Z')
       AND (deleted_at IS NULL)
    ),
    15
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T14:30:00Z')
       AND (end_time = '2036-06-24T16:30:00Z')
       AND (deleted_at IS NULL)
    ),
    30
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T14:30:00Z')
       AND (end_time = '2036-06-24T16:30:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T14:30:00Z')
       AND (end_time = '2036-06-24T16:30:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T14:30:00Z')
       AND (end_time = '2036-06-24T16:30:00Z')
       AND (deleted_at IS NULL)
    ),
    75
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T14:30:00Z')
       AND (end_time = '2036-06-24T16:30:00Z')
       AND (deleted_at IS NULL)
    ),
    90
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2036-06-24T14:30:00Z')
       AND (end_time = '2036-06-24T16:30:00Z')
       AND (deleted_at IS NULL)
    ),
    120
  ),

  -- W5 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-20T13:00:00Z')
       AND (end_time = '2035-06-20T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-20T13:00:00Z')
       AND (end_time = '2035-06-20T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-20T13:00:00Z')
       AND (end_time = '2035-06-20T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    75
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-20T13:00:00Z')
       AND (end_time = '2035-06-20T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    90
  ),

  -- W6 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-07-22T13:00:00Z')
       AND (end_time = '2035-07-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-07-22T13:00:00Z')
       AND (end_time = '2035-07-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-07-22T13:00:00Z')
       AND (end_time = '2035-07-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    75
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-07-22T13:00:00Z')
       AND (end_time = '2035-07-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    90
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-07-22T13:00:00Z')
       AND (end_time = '2035-07-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    120
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Soccer Field')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-07-22T13:00:00Z')
       AND (end_time = '2035-07-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    180
  ), -- max window duration

  -- W7 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Basket Ball Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-22T13:00:00Z')
       AND (end_time = '2035-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Basket Ball Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-22T13:00:00Z')
       AND (end_time = '2035-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Basket Ball Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-22T13:00:00Z')
       AND (end_time = '2035-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    75
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Basket Ball Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2035-06-22T13:00:00Z')
       AND (end_time = '2035-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    90
  ),

  -- W8 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Tennis Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-01-24T10:30:00Z')
       AND (end_time = '2025-01-24T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    15
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Tennis Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-01-24T10:30:00Z')
       AND (end_time = '2025-01-24T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Tennis Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-01-24T10:30:00Z')
       AND (end_time = '2025-01-24T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),

  -- W9 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Tennis Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-02-26T10:30:00Z')
       AND (end_time = '2025-02-26T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Tennis Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-02-26T10:30:00Z')
       AND (end_time = '2025-02-26T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Tennis Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-02-26T10:30:00Z')
       AND (end_time = '2025-02-26T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    75
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner2') AND (deleted_at IS NULL)))
          AND (name = 'Tennis Court')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2025-02-26T10:30:00Z')
       AND (end_time = '2025-02-26T12:30:00Z')
       AND (deleted_at IS NULL)
    ),
    120
  ), -- max window duration

  -- W10 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Gym')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2022-06-22T14:00:00Z')
       AND (end_time = '2022-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    15
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Gym')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2022-06-22T14:00:00Z')
       AND (end_time = '2022-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    45
  ),
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Gym')
          AND (deleted_at IS NULL)
       ))
       AND (start_time = '2022-06-22T14:00:00Z')
       AND (end_time = '2022-06-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  ),

  -- W13 durations
  (
    (
      SELECT id FROM availability_windows
      WHERE
       (resource_id = (
         SELECT id FROM resources
         WHERE
          (owner_id = (SELECT id FROM users WHERE (username = 'active_owner1') AND (deleted_at IS NULL)))
          AND (name = 'Meeting Room 1')
          AND (deleted_at = '2026-02-24T9:00:00Z')
       ))
       AND (start_time = '2026-01-22T14:00:00Z')
       AND (end_time = '2026-01-22T16:00:00Z')
       AND (deleted_at IS NULL)
    ),
    60
  );
