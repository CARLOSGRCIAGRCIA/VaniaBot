export class BotError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'BotError';
    
    Error.captureStackTrace(this, this.constructor);
  }
}


export class PermissionError extends BotError {
  constructor(message: string, details?: unknown) {
    super(message, 'PERMISSION_DENIED', details);
    this.name = 'PermissionError';
  }
}

export class ValidationError extends BotError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class CommandExecutionError extends BotError {
  constructor(
    public commandName: string,
    originalError: unknown
  ) {
    const message = originalError instanceof Error 
      ? originalError.message 
      : String(originalError);
    
    super(`Error ejecutando comando '${commandName}': ${message}`, 'COMMAND_ERROR', originalError);
    this.name = 'CommandExecutionError';
  }
}

export class PluginLoadError extends BotError {
  constructor(
    public pluginPath: string,
    originalError: unknown
  ) {
    const message = originalError instanceof Error 
      ? originalError.message 
      : String(originalError);
    
    super(`Error cargando plugin '${pluginPath}': ${message}`, 'PLUGIN_LOAD_ERROR', originalError);
    this.name = 'PluginLoadError';
  }
}