export const ACCESSIBLE = {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
};

export const SECURITY_LEVEL = {
  SECURE_SOFTWARE: 'SECURE_SOFTWARE',
};

export const getGenericPassword = async () => false;
export const setGenericPassword = async () => ({ service: 'test' });
export const resetGenericPassword = async () => true;
