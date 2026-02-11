import qrcode from "qrcode-terminal";
import chalk from "chalk";

const SEPARATOR = chalk.bold.cyan(
  "═══════════════════════════════════════════════════",
);

export function displayQR(qr: string): void {
  console.log("\n");
  console.log(SEPARATOR);
  console.log(chalk.bold.magenta("            ESCANEA EL CÓDIGO QR "));
  console.log(SEPARATOR);
  console.log(chalk.yellow("\n1. Abre WhatsApp en tu teléfono"));
  console.log(chalk.yellow("2. Toca Menú (⋮) o Configuración"));
  console.log(chalk.yellow("3. Toca Dispositivos vinculados"));
  console.log(chalk.yellow("4. Toca Vincular un dispositivo"));
  console.log(chalk.yellow("5. Escanea este código QR\n"));
  qrcode.generate(qr, { small: true });
  console.log(SEPARATOR);
  console.log(
    chalk.gray("💡 El código QR se actualiza automáticamente cada 20 segundos"),
  );
  console.log(SEPARATOR + "\n");
}

export function displayPairingCode(code: string): void {
  const formattedCode = code.match(/.{1,4}/g)?.join("-") ?? code;

  console.log("\n");
  console.log(SEPARATOR);
  console.log(chalk.bold.magenta("        🔢 CÓDIGO DE PAREAMIENTO 🔢"));
  console.log(SEPARATOR);
  console.log(chalk.yellow("\n1. Abre WhatsApp en tu teléfono"));
  console.log(chalk.yellow("2. Toca Menú (⋮) o Configuración"));
  console.log(chalk.yellow("3. Toca Dispositivos vinculados"));
  console.log(chalk.yellow("4. Toca Vincular con número de teléfono"));
  console.log(chalk.yellow("5. Ingresa este código:\n"));
  console.log(chalk.bold.hex("#00FF00")(`              ${formattedCode}`));
  console.log("");
  console.log(chalk.yellow("   → Copia y pega exactamente como aparece"));
  console.log(chalk.gray("   ⚠️  El código expira en ~1-2 minutos"));
  console.log(SEPARATOR + "\n");
}

export function validatePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");

  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  const digits = cleaned.replace(/\+/g, "");

  if (digits.length < 10 || digits.length > 15) {
    throw new Error(
      `Número de teléfono inválido: ${phone}. Debe tener 10-15 dígitos (incluyendo código de país).`,
    );
  }

  return cleaned;
}
