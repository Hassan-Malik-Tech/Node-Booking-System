import * as availabilityWindowService from '../services/availabilityWindowService.js';
import { success } from '../utils/response.js';

export async function listAvailabilityWindows(req, res) {
  const queryParams = req.validated.query;

  const { data, pagination } =
    await availabilityWindowService.listAvailabilityWindows(queryParams);

  return res.status(200).json(success({ data, pagination }));
}

export async function getAvailabilityWindowById(req, res) {
  const availabilityWindowId = req.validated.params.availabilityWindowId;

  const { data } =
    await availabilityWindowService.getAvailabilityWindowById(
      availabilityWindowId,
    );

  return res.status(200).json(success({ data }));
}

export async function listActiveAvailabilityWindowsByResourceId(req, res) {
  const resourceId = req.validated.params.resourceId;
  const queryParams = req.validated.query;

  const { data, pagination } =
    await availabilityWindowService.listActiveAvailabilityWindowsByResourceId({
      resourceId,
      queryParams,
    });

  return res.status(200).json(success({ data, pagination }));
}

export async function getActiveAvailabilityWindowByResourceIdAndWindowId(
  req,
  res,
) {
  const { resourceId, availabilityWindowId: windowId } = req.validated.params;

  const { data } =
    await availabilityWindowService.getActiveAvailabilityWindowByResourceIdAndWindowId(
      { resourceId, windowId },
    );

  return res.status(200).json(success({ data }));
}

export async function createAvailabilityWindow(req, res) {
  const resourceId = req.validated.params.resourceId;
  const authUserId = req.user.id;
  const availabilityWindowData = req.validated.body;

  const { data } = await availabilityWindowService.createAvailabilityWindow({
    resourceId,
    authUserId,
    availabilityWindowData,
  });

  return res
    .status(201)
    .location(`/api/resources/${resourceId}/availability-windows/${data.id}`)
    .json(success({ data }));
}

export async function createAvailabilityWindowsInBulk(req, res) {
  const resourceId = req.validated.params.resourceId;
  const authUserId = req.user.id;
  const availabilityWindowDataList = req.validated.body;

  const { data } =
    await availabilityWindowService.createAvailabilityWindowsInBulk({
      resourceId,
      authUserId,
      availabilityWindowDataList,
    });

  return res.status(201).json(success({ data }));
}

export async function updateFutureAvailabilityWindow(req, res) {
  const windowId = req.validated.params.availabilityWindowId;
  const authUserId = req.user.id;
  const updateData = req.validated.body;

  const { data } =
    await availabilityWindowService.updateFutureAvailabilityWindow({
      windowId,
      authUserId,
      updateData,
    });

  return res.status(200).json(success({ data }));
}

export async function softDeleteAvailabilityWindow(req, res) {
  const windowId = req.validated.params.availabilityWindowId;
  const authUserId = req.user.id;
  const userRole = req.user.role;

  const { data } = await availabilityWindowService.softDeleteAvailabilityWindow(
    { windowId, authUserId, userRole },
  );

  return res.status(200).json(success({ data }));
}

export async function createAllowedDurations(req, res) {
  const windowId = req.validated.params.availabilityWindowId;
  const authUserId = req.user.id;
  const allowedDurations = req.validated.body;

  const { data } = await availabilityWindowService.createAllowedDurations({
    windowId,
    authUserId,
    allowedDurations,
  });

  return res.status(201).json(success({ data }));
}

export async function deleteAllowedDuration(req, res) {
  const windowId = req.validated.params.availabilityWindowId;
  const durationId = req.validated.params.allowedDurationId;
  const authUserId = req.user.id;

  const { data } = await availabilityWindowService.deleteAllowedDuration({
    windowId,
    durationId,
    authUserId,
  });

  return res.status(200).json(success({ data }));
}
