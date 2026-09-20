// Keeps the reader testable as a normal local page while using native Chrome APIs in the extension.
if (!self.chrome?.runtime?.getURL) {
  const fallbackStorage = {
    async get(key) {
      const keys = Array.isArray(key) ? key : [key];
      return Object.fromEntries(keys.map((name) => {
        try { return [name, JSON.parse(localStorage.getItem(name))]; }
        catch { return [name, undefined]; }
      }));
    },
    async set(values) {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
    }
  };
  self.chrome = {
    ...(self.chrome || {}),
    runtime: { getURL: (path) => new URL(path, location.href).href },
    storage: { local: fallbackStorage }
  };
}
