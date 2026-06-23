/**
 * ErrorHandler.ts
 *
 * Centralized error handling for VaniaBot.
 * Provides user-friendly error messages, logging, and retry logic.
 *
 * @author **Carlos G**
 */

import { logger, logError } from '@/utils/logger.js';

export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AI_ERROR = 'AI_ERROR',
  DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
  MEDIA_ERROR = 'MEDIA_ERROR',
  USER_BANNED = 'USER_BANNED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
}

export interface ErrorContext {
  command?: string;
  userId?: string;
  groupId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export class BotError extends Error {
  code: ErrorCode;
  context: ErrorContext;
  isRetryable: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    context: ErrorContext = {},
    isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'BotError';
    this.code = code;
    this.context = context;
    this.isRetryable = isRetryable;
  }
}

export class ErrorHandler {
  static handleCommandError(error: unknown, command: string, ctx?: ErrorContext): string {
    const contextStr = ctx ? JSON.stringify(ctx) : '';

    if (error instanceof BotError) {
      logError(`Command ${command} ${contextStr}`, error);
      return this.getUserMessage(error);
    }

    if (error instanceof Error) {
      logError(`Command ${command} ${contextStr}`, new Error(error.message));
    }

    return '❌ Error al ejecutar el comando. Intenta de nuevo.';
  }

  static handleDatabaseError(error: unknown, operation: string): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      return '❌ Error de base de datos: Archivo no encontrado.';
    }

    if (errorMessage.includes('permission')) {
      return '❌ Error de permisos al acceder a la base de datos.';
    }

    if (errorMessage.includes('JSON')) {
      return '❌ Error de formato en la base de datos.';
    }

    logger.error(`Database error in ${operation}:`, error);
    return '❌ Error de base de datos. Intenta de nuevo más tarde.';
  }

  static handleAIError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('401') || errorMessage.includes('API key')) {
      return '⚠️ API KEY no establecida, esta función se encuentra temporalmente inhabilitada';
    }

    if (errorMessage.includes('429') || errorMessage.includes('rate_limit')) {
      return '⚠️ Límite de uso alcanzado. Intenta en unos segundos.';
    }

    if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
      return '⚠️ Servicio de AI no disponible temporalmente.';
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      return '⏱️ La AI tardó demasiado. Intenta de nuevo.';
    }

    logger.error('AI Error:', error);
    return '❌ Error con el servicio de AI. Intenta más tarde.';
  }

  static handleDownloadError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return '❌ Video/audio no encontrado. Verifica el enlace.';
    }

    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return '❌ No tienes permiso para descargar este contenido.';
    }

    if (errorMessage.includes('size') || errorMessage.includes('too large')) {
      return '❌ El archivo es demasiado grande.';
    }

    if (errorMessage.includes('timeout')) {
      return '⏱️ La descarga tardó demasiado. Intenta con otro enlace.';
    }

    logger.error('Download Error:', error);
    return '❌ Error al descargar. Verifica el enlace e intenta de nuevo.';
  }

  static handleModerationError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('not admin')) {
      return '❌ Necesito ser administrador para eso.';
    }

    if (errorMessage.includes('permission')) {
      return '❌ No tengo permisos suficientes.';
    }

    if (errorMessage.includes('not found')) {
      return '❌ Usuario no encontrado en el grupo.';
    }

    logger.error('Moderation Error:', error);
    return '❌ Error de moderación. Intenta de nuevo.';
  }

  static getUserMessage(error: BotError): string {
    switch (error.code) {
      case ErrorCode.USER_BANNED:
        return '⛔ Has sido baneado del uso del bot.';

      case ErrorCode.INSUFFICIENT_FUNDS:
        return '❌ Fondos insuficientes.';

      case ErrorCode.RATE_LIMIT_ERROR:
        return '⚠️ Estás excediendo el límite. Espera un momento.';

      case ErrorCode.PERMISSION_ERROR:
        return '❌ No tienes permiso para esto.';

      case ErrorCode.NOT_FOUND:
        return '❌ No encontrado.';

      case ErrorCode.VALIDATION_ERROR:
        return `❌ Datos inválidos: ${error.message}`;

      case ErrorCode.DATABASE_ERROR:
        return '❌ Error de base de datos. Intenta más tarde.';

      case ErrorCode.AI_ERROR:
        return this.handleAIError(error);

      case ErrorCode.DOWNLOAD_ERROR:
        return this.handleDownloadError(error);

      default:
        return error.message || '❌ Error desconocido.';
    }
  }

  static isRetryable(error: unknown): boolean {
    if (error instanceof BotError) {
      return error.isRetryable;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    const retryablePatterns = [
      'timeout',
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'network',
      '503',
      '429',
    ];

    return retryablePatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      delayMs?: number;
      backoffMultiplier?: number;
      onRetry?: (attempt: number, error: unknown) => void;
    } = {},
  ): Promise<T> {
    const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2, onRetry } = options;

    let lastError: unknown;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !this.isRetryable(error)) {
          throw error;
        }

        if (onRetry) {
          onRetry(attempt, error);
        }

        logger.warn(`Retry ${attempt}/${maxRetries} after ${currentDelay}ms`);

        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= backoffMultiplier;
      }
    }

    throw lastError;
  }
}

export const errorHandler = ErrorHandler;
