import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const message =
      typeof body === 'string' ? body : ((body as Record<string, unknown>).message as string) ?? 'Error';
    const errors = typeof body === 'object' ? (body as Record<string, unknown>).errors : undefined;

    res.status(status).json({ statusCode: status, message, ...(errors ? { errors } : {}) });
  }
}
