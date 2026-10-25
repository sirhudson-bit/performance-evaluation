import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Validates and replaces `req.body` with the parsed value.
 *
 * The schema is typed loosely (`ZodTypeAny`) because `.default()`/`.transform()`
 * make a schema's input and output types differ; the handler body is then cast
 * to the concrete type where it is used.
 */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}

/**
 * Validates the query string and stores the parsed value on `req.validatedQuery`
 * (rather than mutating `req.query`, which is a getter on newer Express).
 */
export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    (req as unknown as { validatedQuery: unknown }).validatedQuery = result.data;
    next();
  };
}

export function query<T>(req: Request): T {
  return (req as unknown as { validatedQuery?: unknown }).validatedQuery as T;
}
