import * as sqlUserQueries from './sql/userQueries.js';

export const createUserForRegistration =
  sqlUserQueries.createUserForRegistration;
export const activeUsernameExists = sqlUserQueries.activeUsernameExists;
export const activeEmailExists = sqlUserQueries.activeEmailExists;
export const getActiveUserByUsername = sqlUserQueries.getActiveUserByUsername;
export const getActiveUserById = sqlUserQueries.getActiveUserById;
export const updateActiveUserById = sqlUserQueries.updateActiveUserById;
export const updatePassword = sqlUserQueries.updatePassword;
