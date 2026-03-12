import { createInterface } from 'readline';
import chalk from 'chalk';

const FRAMES_VANIA = [
  chalk.hex('#FF69B4')(`
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⣀⣤⣴⣶⣶⣶⣶⣶⣤⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀⠀⠀
⠀⢠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀
⠀⣾⣿⣿⣿⡿⠟⠛⠛⠛⠛⠛⠻⢿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀
⢠⣿⣿⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿⣿⡆⠀⠀⠀⠀
⢸⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⡇⠀⠀⠀⠀
⢸⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⡇⠀⠀⠀⠀
⢸⣿⣿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⡇⠀⠀⠀⠀
⠸⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⡿⠀⠀⠀⠀⠀
⠀⢻⣿⣿⣿⣦⣄⣀⣀⣀⣀⣀⣠⣴⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀
⠀⠀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠈⠛⠿⣿⣿⣿⣿⣿⣿⣿⠿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀

        VANIABOT v1.0
       ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
`),
  chalk.hex('#FF1493')(`
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣀⣤⣶⣶⣶⣶⣶⣶⣶⣶⣶⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀
⠀⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀
⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀
⢀⣿⣿⣿⡿⠛⠋⠉⠉⠉⠉⠉⠛⠻⢿⣿⣿⣿⣿⡀⠀⠀⠀⠀
⢸⣿⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣿⣿⡇⠀⠀⠀⠀
⢸⣿⣿⡇⠀⠀⠀⢀⣀⣀⣀⣀⡀⠀⠀⠀⣿⣿⣿⡇⠀⠀⠀⠀
⢸⣿⣿⣇⠀⢀⣴⣿⣿⣿⣿⣿⣿⣦⡀⠀⣿⣿⣿⡇⠀⠀⠀⠀
⠸⣿⣿⣿⡄⢸⣿⣿⣿⣿⣿⣿⣿⣿⡇⢠⣿⣿⣿⠇⠀⠀⠀⠀
⠀⢻⣿⣿⣿⡄⠻⣿⣿⣿⣿⣿⣿⠟⢠⣿⣿⣿⡟⠀⠀⠀⠀⠀
⠀⠀⠻⣿⣿⣿⣦⡈⠛⠿⠿⠛⢁⣴⣿⣿⣿⠟⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠈⠛⢿⣿⣿⣷⣶⣶⣾⣿⣿⡿⠛⠁⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠈⠉⠛⠛⠛⠛⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀

    🦋💖 VANIABOT READY! 💖🦋
    ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
      ¡Sistema Operativo!
`),
];

const LOADING_FRAMES = [
  '[🦋] Inicializando Vania-Core...',
  '[✨] Sincronizando módulos inteligentes...',
  '[🌸] Activando red neuronal adaptativa...',
  '[💫] Procesando flujos de datos...',
  '[🧠] Calibrando inteligencia artificial...',
  '[⚙️] Estabilizando sistema autónomo...',
  '[✅] VANIABOT LISTA PARA OPERAR.',
];

async function wait(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

async function playFrames(frames: string[], durationMs: number): Promise<void> {
  const delay = Math.floor(durationMs / frames.length);
  for (const frame of frames) {
    console.clear();
    console.log(frame);
    await wait(delay);
  }
}

async function playLoadingBar(): Promise<void> {
  for (const frame of LOADING_FRAMES) {
    process.stdout.write('\r' + chalk.magentaBright(frame));
    await wait(350);
  }
  console.log('\n');
}

export async function mostrarBannerVania(): Promise<void> {
  console.clear();
  console.log(chalk.bold.magentaBright('\n⟦ ✦ ACCESO CONCEDIDO | VANIA-BOT V.1 ✦ ⟧'));
  console.log(chalk.gray('✦ 𝘾𝙖𝙣𝙖𝙡𝙞𝙯𝙖𝙣𝙙𝙤 𝙖𝙘𝙘𝙚𝙨𝙤 𝙖𝙡 𝙨𝙞𝙨𝙩𝙚𝙢𝙖...'));

  await wait(400);
  await playFrames(FRAMES_VANIA, 1500);
  await playLoadingBar();

  console.log(chalk.hex('#FF1493')('☰✦☰═☰  𝙑𝘼𝙉𝙄𝘼-𝘽𝙊𝙏  ☰═☰✦☰'));
  console.log(
    chalk.bold.hex('#FF69B4')(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██╗   ██╗ █████╗ ███╗   ██╗██╗ █████╗     ██████╗       ║
║   ██║   ██║██╔══██╗████╗  ██║██║██╔══██╗    ██╔══██╗      ║
║   ██║   ██║███████║██╔██╗ ██║██║███████║    ██████╔╝      ║
║   ╚██╗ ██╔╝██╔══██║██║╚██╗██║██║██╔══██║    ██╔══██╗      ║
║    ╚████╔╝ ██║  ██║██║ ╚████║██║██║  ██║    ██████╔╝      ║
║     ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝    ╚═════╝       ║
║                                                           ║
║              ${chalk.cyan('WhatsApp Bot Avanzado v2.0')}                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        [ ACCESO CONCEDIDO ]
  `),
  );

  console.log(chalk.bold.hex('#FF1493')('\n✦═════════════════════════════════✦'));
  console.log(chalk.bold.white('    SISTEMA CREADO POR: ') + chalk.bold.hex('#FFD700')('Carlos G'));
  console.log(chalk.bold.hex('#FF1493')('✦═════════════════════════════════✦\n'));

  await wait(400);
}

export async function seleccionarMetodoAuth(): Promise<'qr' | 'code'> {
  return new Promise(resolve => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(chalk.bold.cyan('\nSelecciona el método de autenticación:\n'));
    console.log(
      chalk.white('  1) 📱 ') +
        chalk.bold.green('Código QR') +
        chalk.gray(' (Escanear con WhatsApp)'),
    );
    console.log(
      chalk.white('  2) 🔢 ') +
        chalk.bold.yellow('Código de Pareamiento') +
        chalk.gray(' (Vincular número)'),
    );

    rl.question(chalk.yellow('\n➤ Selecciona una opción (1 o 2): '), answer => {
      rl.close();
      const option = answer.trim();

      if (option === '1') {
        console.log(chalk.green('\n✓ Método seleccionado: ') + chalk.bold('Código QR'));
        resolve('qr');
      } else if (option === '2') {
        console.log(chalk.green('\n✓ Método seleccionado: ') + chalk.bold('Código de Pareamiento'));
        resolve('code');
      } else {
        console.log(
          chalk.red('\n❌ Opción inválida. ') + chalk.yellow('Usando Código QR por defecto.'),
        );
        resolve('qr');
      }
    });
  });
}

export function mostrarAyuda(): void {
  const c = chalk.bold.cyan;
  const w = chalk.bold.white;
  const cy = chalk.cyan;
  const g = chalk.gray;

  console.log(c('\n╔═══════════════════════════════════════════╗'));
  console.log(c('║') + '    VANIABOT - COMANDOS DISPONIBLES    ' + c('║'));
  console.log(c('╚═══════════════════════════════════════════╝\n'));

  console.log(w('Inicio:'));
  console.log(cy('  npm start') + g('        → Menú interactivo'));
  console.log(cy('  npm start qr') + g('     → Usar código QR'));
  console.log(cy('  npm start code') + g('   → Usar código de pareamiento'));

  console.log(w('\nDesarrollo:'));
  console.log(cy('  npm run dev') + g('      → Modo desarrollo (watch)'));
  console.log(cy('  npm run build') + g('    → Compilar TypeScript'));
  console.log(cy('  npm run lint') + g('     → Verificar código'));

  console.log(w('\nMantenimiento:'));
  console.log(cy('  npm run clean') + g('    → Limpiar sesión y archivos'));
  console.log();
}
