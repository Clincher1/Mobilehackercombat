// The game stores its entire local database under one versioned key on this device.
export const SAVE_KEY = 'hk_offline_save_v1';
export default {
  existsSync: (_path: string) => localStorage.getItem(SAVE_KEY) !== null,
  readFileSync: (_path: string) => {
    const data = localStorage.getItem(SAVE_KEY);
    if (data === null) throw new Error('Save not found');
    return data;
  },
  writeFileSync: (_path: string, value: string) => localStorage.setItem(SAVE_KEY, value),
};
