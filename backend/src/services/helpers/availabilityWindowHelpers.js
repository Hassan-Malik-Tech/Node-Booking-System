import * as availabilityWindowQueries from '../../data-access/availabilityWindows.js';
import * as availabilityWindowRules from '../rules/availabilityWindowRules.js';

export async function createAvailabilityWindowsForResource({
  resourceId,
  availabilityWindowDataList,
  client,
}) {
  // This checks if any of the durations are longer than the window
  // first before doing any db writes.
  for (const availabilityWindowData of availabilityWindowDataList) {
    const { startTime, endTime, allowedDurations } = availabilityWindowData;

    availabilityWindowRules.validateAllowedDurationsFitWindow({
      startTime,
      endTime,
      allowedDurations,
    });
  }

  // Sort before inserting so the returned ids are ordered by startTime,
  // not by whatever order the client sent the windows in.
  // Example: if the client sends day 3, day 1, and day 2,
  // the returned id list might be [10, 11, 12],
  // representing the day 1, day 2, and day 3 windows.
  availabilityWindowDataList.sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  const availabilityWindowIds = [];
  let allowedDurationsCount = 0;

  for (const availabilityWindowData of availabilityWindowDataList) {
    const { startTime, endTime, cancellationNoticeMinutes, allowedDurations } =
      availabilityWindowData;

    const availabilityWindow =
      await availabilityWindowQueries.createAvailabilityWindow({
        windowData: {
          resourceId,
          startTime,
          endTime,
          cancellationNoticeMinutes,
        },
        client,
      });

    const createdAllowedDurations =
      await availabilityWindowQueries.createAllowedDurations({
        windowId: availabilityWindow.id,
        minutesList: allowedDurations,
        client,
      });

    availabilityWindowIds.push(availabilityWindow.id);
    allowedDurationsCount += createdAllowedDurations.length;
  }

  return {
    availabilityWindowsCreated: availabilityWindowIds.length,
    allowedDurationsCreated: allowedDurationsCount,
    availabilityWindowIds,
  };
}
