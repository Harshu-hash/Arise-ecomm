import { BlockList, isIP } from 'node:net';
import { env } from '../../config/env.js';
import { ForbiddenError } from '../errors/AppError.js';

// Optional network restriction for admin routes (ADMIN_IP_ALLOWLIST="1.2.3.4,10.0.0.0/8"). Empty = allow all.
function buildList(entries) {
  const list = new BlockList();
  for (const entry of entries) {
    const [address, prefix] = entry.split('/');
    const family = isIP(address) === 6 ? 'ipv6' : 'ipv4';
    if (prefix) list.addSubnet(address, Number(prefix), family);
    else list.addAddress(address, family);
  }
  return list;
}

export function ipAllowlist(entries = env.adminIpAllowlist) {
  if (entries.length === 0) return (_req, _res, next) => next();
  const list = buildList(entries);
  return (req, _res, next) => {
    const ip = req.ip?.replace(/^::ffff:/, '');
    const family = isIP(ip) === 6 ? 'ipv6' : 'ipv4';
    next(isIP(ip) && list.check(ip, family) ? undefined : new ForbiddenError('Access from this network is not allowed.'));
  };
}
