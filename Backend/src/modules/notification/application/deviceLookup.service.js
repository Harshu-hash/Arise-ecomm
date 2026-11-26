import { Device } from '../infrastructure/persistence/device.model.js';

/** The phones each of these customers has used (by app-install id), for spotting two accounts on one phone. Never exposes tokens. */
export async function getDeviceIds(userIds) {
  const rows = await Device.find({ userId: { $in: userIds.map(String) } }, 'userId deviceId').lean();
  const byUser = new Map(userIds.map((id) => [String(id), new Set()]));
  for (const row of rows) byUser.get(row.userId)?.add(row.deviceId);
  return byUser;
}
