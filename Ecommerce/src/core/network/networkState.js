let online = true;

export const getNetworkOnline = () => online;
export const setNetworkOnline = value => {
  online = Boolean(value);
};
