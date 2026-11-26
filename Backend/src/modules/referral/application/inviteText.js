export const formatINR = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;
