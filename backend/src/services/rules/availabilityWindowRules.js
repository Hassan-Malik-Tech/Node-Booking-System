import AppError from '../../errors/AppError.js';
import ERROR_CODES from '../../errors/errorCodes.js';

export function validateAllowedDurationsFitWindow({
  startTime,
  endTime,
  allowedDurations,
}) {
  // joi validation shold convert these values to Date objects first.
  // getTime gets the time in ms from a Date object since jan 01 1970 midnight.
  const windowLengthMs = endTime.getTime() - startTime.getTime();
  // There are 60000 ms in a min (60 seconds in a min * 1000 ms in a second )
  const windowLengthMins = windowLengthMs / 60000;

  // Returns a boolean, if one of the items returns true, it stops the loop.
  const allowedDurationLongerThanWindow = allowedDurations.some(
    (allowedDuration) => allowedDuration > windowLengthMins,
  );

  if (allowedDurationLongerThanWindow) {
    throw AppError.badRequest(
      'Allowed duration cannot be longer than the availability window.',
      {
        code: ERROR_CODES.ALLOWED_DURATION_LONGER_THAN_WINDOW,
      },
    );
  }
}
