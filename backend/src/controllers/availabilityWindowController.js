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

  // Add location header to /api/resources/:resourceId/availability-windows/:availabilityWindowId
  // once it is added
  return res.status(201).json(success({ data }));
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
