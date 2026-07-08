import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { ZodError } from 'zod';

// Known Prisma error codes -> client-facing status + message. Anything not
// listed here is an unexpected server fault and falls through to 500. Prisma's
// own messages (table/column names, query internals) are never forwarded.
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Resource not found' },
  P2003: { status: HttpStatus.CONFLICT, message: 'Resource is referenced by other records' },
  P2002: { status: HttpStatus.CONFLICT, message: 'Resource already exists' },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    // Zod validation errors from manual schema.parse() in controllers -> 400 with field errors.
    if (exception instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        const key = issue.path.join('.') || '_';
        (errors[key] ??= []).push(issue.message);
      }
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    // Map expected Prisma constraint/lookup failures to 4xx instead of a raw 500.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_ERROR_MAP[exception.code];
      if (mapped) {
        res.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
        return;
      }
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const message =
      typeof body === 'string' ? body : ((body as Record<string, unknown>).message as string) ?? 'Error';
    const errors = typeof body === 'object' ? (body as Record<string, unknown>).errors : undefined;

    res.status(status).json({ statusCode: status, message, ...(errors ? { errors } : {}) });
  }
}
