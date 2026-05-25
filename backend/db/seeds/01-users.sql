INSERT INTO users (username, password_hash, name, email, role, deleted_at)
VALUES
  (
    'admin1',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Hassan',
    'admin1@dev.com',
    'admin',
    NULL
  ), -- U1 - admin user
  (
    'active_owner1',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Zain',
    'zain@dev.com',
    'user',
    NULL
  ), -- U2 - active owner 1
  (
    'active_owner2',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Cody',
    'cody@dev.com',
    'user',
    NULL
  ), -- U3 - active owner 2
  (
    'reused_username',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Zack',
    'zack@dev.com',
    'user',
    NULL
  ), -- U4 - active user with no resources yet, re-uses U8 user name
  (
    'active_booking_user1',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Umar',
    'umar@dev.com',
    'user',
    NULL
  ), -- U5 - active booking user 1
  (
    'active_booking_user2',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Zainab',
    'zainab@dev.com',
    'user',
    NULL
  ), -- U6 - active booking user 2
  (
    'active_blank_user',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Aisha',
    'aisha@dev.com',
    'user',
    NULL
  ), -- U7 - active user with no reservations or resources
  (
    'reused_username',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Bob',
    'bob@dev.com',
    'user',
    '2026-03-24T9:00:00Z'
  ), -- U8 - soft deleted user
  (
    'bob_username',
    '$2b$12$fWQPRCWqZF.hejC9693Xue11cuxpk2XG2ta10RckJcUpZlaqGzcje',
    'Bob',
    'bob@dev2.com',
    'employee',
    NULL
  ); -- U9 employee 

-- Password for all users: BookingDevPassword