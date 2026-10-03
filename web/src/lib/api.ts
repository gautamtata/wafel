import type { ZodType } from "zod";
import { isAgentRequest } from "@/lib/auth";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(`${what} not found`, 404);
export const badRequest = (message: string) => new ApiError(message, 400);

export const jsonError = (message: string, status: number) =>
  Response.json({ error: message }, { status });

export const noContent = () => new Response(null, { status: 204 });

export async function readBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw: unknown = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest("Invalid request body");
  return parsed.data;
}

type Handler<T extends unknown[]> = (req: Request, ...args: T) => Promise<Response>;

export function handled<T extends unknown[]>(handler: Handler<T>): Handler<T> {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      if (error instanceof ApiError) return jsonError(error.message, error.status);
      console.error(`${req.method} ${new URL(req.url).pathname} failed`, error);
      return jsonError("Internal error", 500);
    }
  };
}

export function withAgent<T extends unknown[]>(handler: Handler<T>): Handler<T> {
  const safe = handled(handler);
  return async (req, ...args) =>
    isAgentRequest(req) ? safe(req, ...args) : jsonError("Unauthorized", 401);
}

export type IdContext = { params: Promise<{ id: string }> };
export const idOf = async ({ params }: IdContext) => (await params).id;
