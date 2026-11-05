export function sendData(res, data, { status = 200, meta } = {}) {
  return res.status(status).json(meta === undefined ? { data } : { data, meta });
}

export function sendCommand(res, data, { status = 200 } = {}) {
  return res.status(status).json({ data });
}

