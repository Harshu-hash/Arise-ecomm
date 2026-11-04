const values = new Map();

export class MMKV {
  getBoolean(key) {
    return values.get(key);
  }

  getString(key) {
    return values.get(key);
  }

  set(key, value) {
    values.set(key, value);
  }

  delete(key) {
    values.delete(key);
  }

  clearAll() {
    values.clear();
  }
}
