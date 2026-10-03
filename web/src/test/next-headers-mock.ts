export const cookieJar = new Map<string, string>();

export const cookies = async () => ({
  get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
});
