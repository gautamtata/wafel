type Method = "POST" | "PATCH" | "DELETE";

export const SAVE_FAILED = "Couldn't save that. Try again.";

export async function send(path: string, method: Method, body?: unknown): Promise<Response> {
  const res = await fetch(path, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${path} failed with ${res.status}`);
  return res;
}
