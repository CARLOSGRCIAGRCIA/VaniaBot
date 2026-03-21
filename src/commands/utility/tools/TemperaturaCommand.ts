import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { weatherService } from '@/services/external/WeatherService.js';

export class TemperaturaCommand extends Command {
  name = 'clima';
  description = 'Consulta el clima de una ciudad';
  category = CommandCategory.UTILITY;
  aliases = ['clima', 'tiempo', 'weather', 'temperatura'];
  usage = '!clima <ciudad>';
  examples = ['!clima Ciudad de México', '!clima Tokio', '!clima Madrid'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const city = ctx.args.join(' ').trim();

    if (!city) {
      await ctx.reply(
        `🌤️ *Clima - VaniaBot*\n\n` +
          `*Uso:* !clima <ciudad>\n\n` +
          `*Ejemplos:*\n` +
          `  !clima Ciudad de México\n` +
          `  !clima Tokio\n` +
          `  !clima Buenos Aires`,
      );
      return;
    }

    await ctx.react('🔍');

    const cities = await weatherService.searchCity(city);

    if (cities.length === 0) {
      await ctx.reply(`❌ No encontré resultados para *"${city}"*.`);
      return;
    }

    const selected = cities[0];
    const weather = await weatherService.getWeather(selected.latitude, selected.longitude);

    if (!weather) {
      await ctx.reply(`❌ Error al obtener el clima. Intenta más tarde.`);
      return;
    }

    const weatherInfo = weatherService.getWeatherInfo(weather.weatherCode);
    const location = selected.admin1
      ? `${selected.name}, ${selected.admin1}, ${selected.country}`
      : `${selected.name}, ${selected.country}`;

    const dayNight = weather.isDay ? '☀️' : '🌙';

    const msg =
      `${weatherInfo.emoji} *Clima en ${selected.name}*\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `${dayNight} ${weatherInfo.description}\n\n` +
      `🌡️ *Temperatura:* ${weather.temperature}°C\n` +
      `🤔 *Sensación:* ${weather.feelsLike}°C\n` +
      `💧 *Humedad:* ${weather.humidity}%\n` +
      `💨 *Viento:* ${weather.windSpeed} km/h\n\n` +
      `📍 ${location}`;

    await ctx.reply(msg);
    await ctx.react('✅');
  }
}
