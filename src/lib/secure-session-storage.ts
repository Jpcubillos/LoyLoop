type SecureStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
type LegacyStore = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
};
type Manifest = { id: string; count: number };
const PART_SIZE = 1500;

// SecureStore values can be size-limited. A small manifest commits a complete
// generation only after all parts have been written; tokens never go in logs.
export function createSecureSessionStorage(
  secure: SecureStore,
  legacy: LegacyStore,
) {
  const base = (key: string) =>
    `loyloop.${key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const partKey = (key: string, m: Manifest, part: number) =>
    `${base(key)}.${m.id}.${part}`;
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await secure.getItemAsync(base(key));
    if (!raw) return null;
    try {
      const m = JSON.parse(raw) as Manifest;
      if (
        !m ||
        !/^[a-z0-9]+$/.test(m.id) ||
        !Number.isInteger(m.count) ||
        m.count < 1 ||
        m.count > 128
      )
        throw new Error("Invalid session manifest");
      return m;
    } catch {
      // Corrupt state must not trap the user in a session that cannot be removed,
      // or allow an older plaintext copy to become the active account again.
      await legacy.removeItem(key);
      await secure.deleteItemAsync(base(key));
      return null;
    }
  }
  async function removeParts(key: string, m: Manifest) {
    await Promise.all(
      Array.from({ length: m.count }, (_, i) =>
        secure.deleteItemAsync(partKey(key, m, i)),
      ),
    );
  }
  const storage = {
    async getItem(key: string): Promise<string | null> {
      const m = await manifest(key);
      if (m) {
        const parts = await Promise.all(
          Array.from({ length: m.count }, (_, i) =>
            secure.getItemAsync(partKey(key, m, i)),
          ),
        );
        try {
          if (parts.some((p) => p === null))
            throw new Error("Incomplete session");
          const value: unknown = JSON.parse(parts.join(""));
          if (typeof value !== "string") throw new Error("Invalid session");
          return value;
        } catch {
          await storage.removeItem(key);
          return null;
        }
      }
      const old = await legacy.getItem(key);
      if (old !== null) await storage.setItem(key, old);
      return old;
    },
    async setItem(key: string, value: string) {
      const previous = await manifest(key);
      // Encode to ASCII first so each part stays below the native byte limit.
      const encoded = JSON.stringify(value).replace(
        /[\u007f-\uffff]/g,
        (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
      );
      const next = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
        count: Math.ceil(encoded.length / PART_SIZE),
      };
      if (next.count > 128)
        throw new Error(
          "La sesión es demasiado grande para guardarse de forma segura.",
        );
      try {
        for (let i = 0; i < next.count; i++)
          await secure.setItemAsync(
            partKey(key, next, i),
            encoded.slice(i * PART_SIZE, (i + 1) * PART_SIZE),
          );
        await secure.setItemAsync(base(key), JSON.stringify(next));
      } catch (error) {
        await removeParts(key, next).catch(() => {});
        throw error;
      }
      await legacy.removeItem(key);
      if (previous) await removeParts(key, previous);
    },
    async removeItem(key: string) {
      const m = await manifest(key);
      // Remove the legacy copy first so the next read cannot resurrect it.
      await legacy.removeItem(key);
      await secure.deleteItemAsync(base(key));
      if (m) await removeParts(key, m);
    },
  };
  return storage;
}
