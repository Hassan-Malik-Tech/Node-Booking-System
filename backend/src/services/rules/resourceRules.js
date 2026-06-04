import * as resourceQueries from '../../data-access/resources.js';
import {
  forbidden,
  resourceDeleted,
  resourceInactive,
  resourceNotFound,
} from '../../errors/commonErrors.js';

export async function requireOwnedActiveResource({
  resourceId,
  authUserId,
  client,
}) {
  const resource = await resourceQueries.getResourceById({
    resourceId,
    client,
  });

  if (!resource) {
    throw resourceNotFound();
  }

  if (resource.owner_id !== authUserId) {
    throw forbidden();
  }

  if (resource.deleted_at !== null) {
    throw resourceDeleted();
  }

  if (resource.is_active === false) {
    throw resourceInactive();
  }
}
