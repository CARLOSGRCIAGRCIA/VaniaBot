import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logError } from '@/utils/logger.js';
import type { ConversionAction, ImageFormat } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = './data/temp';
const BRIDGE_SCRIPT = join(__dirname, 'scripts', 'bridge.py');

export class PythonBridge {
  private static instance: PythonBridge;

  private constructor() {
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }
  }

  static getInstance(): PythonBridge {
    if (!PythonBridge.instance) {
      PythonBridge.instance = new PythonBridge();
    }
    return PythonBridge.instance;
  }

  async execute(
    action: ConversionAction,
    inputBuffer: Buffer,
    options?: { format?: ImageFormat },
  ): Promise<Buffer> {
    const inputPath = join(
      TEMP_DIR,
      `bridge-input-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const outputPath = join(
      TEMP_DIR,
      `bridge-output-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );

    try {
      writeFileSync(inputPath, inputBuffer);

      const args = [BRIDGE_SCRIPT, action, inputPath, outputPath];
      if (options?.format) {
        args.push(options.format);
      }

      await this.spawnPython(args);

      if (!existsSync(outputPath)) {
        throw new Error(`Python bridge did not produce output for action: ${action}`);
      }

      return readFileSync(outputPath);
    } catch (error) {
      logError(`[PythonBridge] ${action} failed`, error);
      throw error;
    } finally {
      this.cleanup(inputPath, outputPath);
    }
  }

  private spawnPython(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('python3', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
      });

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python bridge exited code ${code}: ${stderr.slice(0, 500)}`));
        }
      });

      proc.on('error', reject);
    });
  }

  private cleanup(...files: string[]): void {
    for (const file of files) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
        const zipPath = file + '.zip';
        if (existsSync(zipPath)) {
          unlinkSync(zipPath);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
