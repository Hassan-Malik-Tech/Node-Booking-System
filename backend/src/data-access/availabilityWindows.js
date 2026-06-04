import * as sqlAvailabilityWindowQueries from './sql/availabilityWindowQueries.js';

export const listAvailabilityWindows =
  sqlAvailabilityWindowQueries.listAvailabilityWindows;

export const countAvailabilityWindows =
  sqlAvailabilityWindowQueries.countAvailabilityWindows;

export const getAvailabilityWindowById =
  sqlAvailabilityWindowQueries.getAvailabilityWindowById;

export const createAvailabilityWindow =
  sqlAvailabilityWindowQueries.createAvailabilityWindow;

export const softDeleteAvailabilityWindowById =
  sqlAvailabilityWindowQueries.softDeleteAvailabilityWindowById;

export const createAllowedDuration =
  sqlAvailabilityWindowQueries.createAllowedDuration;

export const createAllowedDurations =
  sqlAvailabilityWindowQueries.createAllowedDurations;

export const createAvailabilityWindowsWithDurations =
  sqlAvailabilityWindowQueries.createAvailabilityWindowsWithDurations;
