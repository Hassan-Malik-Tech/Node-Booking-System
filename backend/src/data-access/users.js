import * as sqlUserQueries from './sql/userQueries.js';

export const createUserForRegistration =
  sqlUserQueries.createUserForRegistration;
export const activeUsernameExists = sqlUserQueries.activeUsernameExists;
export const activeEmailExists = sqlUserQueries.activeEmailExists;
export const getActiveUserForLogin = sqlUserQueries.getActiveUserForLogin;
export const getCurrentUserForAuth = sqlUserQueries.getCurrentUserForAuth;
export const getActiveUserById = sqlUserQueries.getActiveUserById;
