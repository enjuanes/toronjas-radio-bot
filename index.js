// index.js
import 'dotenv/config';
import {
  Client, GatewayIntentBits, REST, Routes, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  VoiceConnectionStatus, entersState, demuxProbe,
} from '@discordjs/voice';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { data as radioCmd, RADIOS } from './commands/radio.js';

// ================== CONFIG ==================
// Mapea cada "key" a su URL real
const RADIOS_URLS = {
  megastar: 'https://megastar-cope.flumotion.com/chunks.m3u8',  // HLS
  vibes:    'https://gamingrelay.simulatorvibes.com/',          // MP3/Icecast (pon la URL correcta)
};

// IDs de botones
const BTN_PLAY_PREFIX = 'radio_play:'; // p.ej. radio_play:megastar
const BTN_STOP = 'radio_stop';

// ============================================

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const body = [radioCmd.toJSON()];
  if (process.env.GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body });
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
function ffmpegToOggOpus(inputUrl) {
  // Soporta HLS, MP3/Icecast, AAC, etc. y reconecta.
  const args = [
    // Opcional (algunas radios Icecast prefieren User-Agent):
    '-user_agent', 'DiscordBot/1.0 (+https://discord.com)',
    // Si quisieras metadatos ICY (título), pon '1'; para solo audio, deja '0' o elimina la flag.
    '-icy', '0',

    '-re',
    '-i', inputUrl,
    '-vn',
    '-analyzeduration', '0',
    '-loglevel', 'error',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',

    // audio -> Opus
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

async function createOggOpusResource(url) {
  const stream = ffmpegToOggOpus(url);
  const probed = await demuxProbe(stream);
  return createAudioResource(probed.stream, { inputType: probed.type });
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

function ensurePlayer(guildId) {
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    players.set(guildId, player);
  }
  return player;
}

// ---------- UI helpers ----------
function makeControlsRow() {
  // Botones para TODAS las radios + Stop
  const row = new ActionRowBuilder();
  for (const radio of RADIOS) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BTN_PLAY_PREFIX + radio.key)
        .setLabel(radio.label)
        .setStyle(radio.buttonStyle)
        .setEmoji(radio.emoji)
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(BTN_STOP)
      .setLabel('Stop')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🟥')
  );
  return row;
}

// ---------- Core actions ----------
async function playRadioInUserChannel(guild, userId, radioKey) {
  const url = RADIOS_URLS[radioKey];
  if (!url) throw new Error('Radio no configurada: ' + radioKey);

  const member = await guild.members.fetch(userId);
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) throw new Error('Debes estar en un canal de voz.');

  const connection = await connectToVoice(voiceChannel);
  const player = ensurePlayer(guild.id);
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
  // Slash: /radio <radio>
  if (interaction.isChatInputCommand() && interaction.commandName === 'radio') {
    const radioKey = interaction.options.getString('radio');
    await interaction.deferReply({ ephemeral: false }); // público
    try {
      await playRadioInUserChannel(interaction.guild, interaction.user.id, radioKey);
      const label = RADIOS.find(s => s.key === radioKey)?.label || radioKey;
      await interaction.editReply({
        content: `▶️ Reproduciendo **${label}**`,
        components: [makeControlsRow()],
      });
    } catch (e) {
      await interaction.editReply({ content: `❌ ${e.message}`, components: [makeControlsRow()] });
    }
    return;
  }

  // Botones (públicos)
  if (interaction.isButton()) {
    await interaction.deferReply({ ephemeral: false });

    if (interaction.customId.startsWith(BTN_PLAY_PREFIX)) {
      const radioKey = interaction.customId.split(':')[1];
      try {
        await playRadioInUserChannel(interaction.guild, interaction.user.id, radioKey);
        const label = RADIOS.find(s => s.key === radioKey)?.label || radioKey;
        await interaction.editReply({
          content: `▶️ Reproduciendo **${label}**`,
          components: [makeControlsRow()],
        });
      } catch (e) {
        await interaction.editReply({ content: `❌ ${e.message}`, components: [makeControlsRow()] });
      }
      return;
    }

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
