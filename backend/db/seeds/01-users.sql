INSERT INTO users (username, password_hash, name, email, role, deleted_at)
VALUES
  (
    'admin_1',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'admin_1_name',
    'admin1@example.com',
    'admin',
    NULL
  ), -- U1 - admin user
  (
    'dev_username_1',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'dev_name_1',
    'dev1@example.com',
    'user',
    NULL
  ), -- U2 - active owner 1
  (
    'dev_username_2',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'dev_name_2',
    'dev2@example.com',
    'user',
    NULL
  ), -- U3 - active owner 2
  (
    'dev_username_3',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'dev_name_3',
    'dev3@example.com',
    'user',
    NULL
  ), -- U4 - active user with no resources yet
  (
    'dev_username_4',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'dev_name_4',
    'dev4@example.com',
    'user',
    NULL
  ), -- U5 - active booking user 1
  (
    'dev_username_5',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'dev_name_5',
    'dev5@example.com',
    'user',
    NULL
  ), -- U6 - active booking user 2
  (
    'dev_username_6',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'dev_name_6',
    'dev6@example.com',
    'user',
    NULL
  ), -- U7 - active user with no reservations or resources
  (
    'deleted_username_1',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'deleted_name_1',
    'deleted1@example.com',
    'user',
    '2026-03-24T9:00:00Z'
  ), -- U8 - soft deleted user
  (
    'employee_username_1',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'employee_name_1',
    'employee1@example.com',
    'employee',
    NULL
  ); -- U9 employee 

-- Password for all users: BookingDevPassword
