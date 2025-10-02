// index.js
import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  VoiceConnectionStatus,
  entersState,
  demuxProbe,
} from '@discordjs/voice';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { data as radioCmd, STATIONS } from './commands/radio.js';

// ================== CONFIG ==================
// Define aquí las URLs de cada emisora por su "key"
const STATION_URLS = {
  megastar: 'https://megastar-cope.flumotion.com/chunks.m3u8',
  // ejemplo para añadir otra:
  // mi_radio: 'https://mi-servidor/stream.m3u8',
};

// IDs de botones
const BTN_PLAY_PREFIX = 'radio_play:'; // ej: radio_play:megastar
const BTN_STOP = 'radio_stop';

// ============================================

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const body = [radioCmd.toJSON()];
  if (process.env.GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body }
    );
    console.log('✅ Comandos registrados (GUILD)');
  } else {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body });
    console.log('✅ Comandos registrados (GLOBAL)');
  }
}
if (process.argv.includes('--register')) {
  registerCommands().then(() => process.exit(0));
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// por servidor
const players = new Map();     // guildId -> AudioPlayer
const connections = new Map(); // guildId -> VoiceConnection

// ---------- Audio helpers ----------
function ffmpegHlsToOggOpus(hlsUrl) {
  const args = [
    '-re',
    '-i', hlsUrl,
    '-vn',
    '-analyzeduration', '0',
    '-loglevel', 'error',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-ac', '2',
    '-ar', '48000',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-application', 'lowdelay',
    '-f', 'ogg',
    'pipe:1',
  ];
  const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  return proc.stdout;
}

async function createOggOpusResource(hlsUrl) {
  const stream = ffmpegHlsToOggOpus(hlsUrl);
  const probed = await demuxProbe(stream);
  return createAudioResource(probed.stream, { inputType: probed.type });
}

async function ensurePlayer(guildId) {
  let player = players.get(guildId);
  if (!player) {
    const { createAudioPlayer } = await import('@discordjs/voice');
    player = createAudioPlayer();
    players.set(guildId, player);
  }
  return player;
}

async function connectToVoice(channel) {
  const conn = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  await entersState(conn, VoiceConnectionStatus.Ready, 15_000).catch(e => {
    conn.destroy();
    throw e;
  });
  connections.set(channel.guild.id, conn);
  return conn;
}

// ---------- UI helpers ----------
function makeControlsRow() {
  // Botón principal de MegaStar + Stop
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BTN_PLAY_PREFIX + 'megastar')
      .setLabel('⭐MegaStar')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BTN_STOP)
      .setLabel('🟥Stop')
      .setStyle(ButtonStyle.Danger),
  );
  return row;
}

// ---------- Core actions ----------
async function playStationInUserChannel(guild, userId, stationKey) {
  const url = STATION_URLS[stationKey];
  if (!url) throw new Error('Estación no configurada: ' + stationKey);

  const member = await guild.members.fetch(userId);
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) throw new Error('Debes estar en un canal de voz.');

  const connection = await connectToVoice(voiceChannel);
  const { createAudioPlayer } = await import('@discordjs/voice');
  let player = players.get(guild.id);
  if (!player) {
    player = createAudioPlayer();
    players.set(guild.id, player);
  }
  connection.subscribe(player);
  const resource = await createOggOpusResource(url);
  player.play(resource);
}

async function stopInGuild(guild) {
  players.get(guild.id)?.stop(true);
  const conn = connections.get(guild.id);
  if (conn) {
    try { conn.destroy(); } catch {}
    connections.delete(guild.id);
  }
}

// ---------- Events ----------
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Conectado como ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Slash: /radio <estacion>
  if (interaction.isChatInputCommand() && interaction.commandName === 'radio') {
    const stationKey = interaction.options.getString('estacion');

    try {
      await interaction.deferReply({ ephemeral: false }); // público
      await playStationInUserChannel(interaction.guild, interaction.user.id, stationKey);

      const stationLabel = STATIONS.find(s => s.key === stationKey)?.label || stationKey;
      await interaction.editReply({
        content: `▶️ Reproduciendo **${stationLabel}**`,
        components: [makeControlsRow()],
      });
    } catch (e) {
      await interaction.editReply({ content: `❌ ${e.message}`, components: [makeControlsRow()] });
    }
    return;
  }

  // Botones
  if (interaction.isButton()) {
    // Público también (sin ephemeral)
    await interaction.deferReply({ ephemeral: false });

    // Play de una estación
    if (interaction.customId.startsWith(BTN_PLAY_PREFIX)) {
      const stationKey = interaction.customId.split(':')[1];
      try {
        await playStationInUserChannel(interaction.guild, interaction.user.id, stationKey);
        const stationLabel = STATIONS.find(s => s.key === stationKey)?.label || stationKey;
        await interaction.editReply({
          content: `▶️ Reproduciendo **${stationLabel}**`,
          components: [makeControlsRow()],
        });
      } catch (e) {
        await interaction.editReply({ content: `❌ ${e.message}`, components: [makeControlsRow()] });
      }
      return;
    }

    // Stop
    if (interaction.customId === BTN_STOP) {
      await stopInGuild(interaction.guild);
      await interaction.editReply({ content: '⏹️ Radio detenida.', components: [makeControlsRow()] });
      return;
    }
  }
});

// ---------- Login ----------
if (!process.argv.includes('--register')) {
  if (!process.env.DISCORD_TOKEN) {
    console.error('Falta DISCORD_TOKEN en .env');
    process.exit(1);
  }
  client.login(process.env.DISCORD_TOKEN);
}
