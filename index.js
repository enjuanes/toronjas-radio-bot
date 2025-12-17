// index.js
import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  VoiceConnectionStatus,
  entersState,
  demuxProbe,
} from "@discordjs/voice";
import { spawn } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { data as radioCmd, RADIOS } from "./commands/radio.js";

// ================== CONFIG ==================
// Mapea cada "key" a su URL real
const RADIOS_URLS = {
  megastar: "https://megastar-cope.flumotion.com/chunks.m3u8", // HLS
  vibes: "https://gamingrelay.simulatorvibes.com/", // MP3/Icecast
  motiva: "https://stream.motivafm.com/listen/motiva/motiva.mp3",
  radio_maria: "http://dreamsiteradiocp2.com:8006/stream",
  los40:
    "https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40AAC.aac",
  los40_urban: "https://25483.live.streamtheworld.com/LOS40_URBANAAC_SC",
  flaix:
    "https://us-b4-p-e-jn18-audio.cdn.mdstrm.com/live-audio-aw/65afe4a0357cec56667ac739",
  cadena_100: "https://cadena100-cope.flumotion.com/chunks.m3u8",
  cadena_dial: "https://25453.live.streamtheworld.com/CADENADIALAAC_SC",
  fallout: "https://fallout.fm:8444/falloutfm1.ogg",
  fallout_diamon_city_radio: "https://fallout.fm:8444/falloutfm6.ogg",
  fallout_radio_new_vegas: "https://fallout.fm:8444/falloutfm3.ogg",
  fallout_galaxy_news_radio: "https://fallout.fm:8444/falloutfm2.ogg",
  fallout_76: "https://fallout.fm:8444/falloutfm10.ogg",
};

// IDs de botones
const BTN_PLAY_PREFIX = "radio_play:"; // p.ej. radio_play:megastar
const BTN_STOP = "radio_stop";

// ============================================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const body = [radioCmd.toJSON()];
  if (process.env.GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body }
    );
    console.log("✅ Comandos registrados (GUILD)");
  } else {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body });
    console.log("✅ Comandos registrados (GLOBAL)");
  }
}
if (process.argv.includes("--register")) {
  registerCommands().then(() => process.exit(0));
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// por servidor
const players = new Map(); // guildId -> AudioPlayer
const connections = new Map(); // guildId -> VoiceConnection

// ---------- Audio helpers ----------
function ffmpegToOggOpus(inputUrl) {
  // Soporta HLS, MP3/Icecast, AAC, etc. y reconecta.
  const args = [
    // Opcional (algunas radios Icecast prefieren User-Agent):
    "-user_agent",
    "DiscordBot/1.0 (+https://discord.com)",
    // Si quisieras metadatos ICY (título), pon '1'; para solo audio, deja '0' o elimina la flag.
    "-icy",
    "0",

    "-re",
    "-i",
    inputUrl,
    "-vn",
    "-analyzeduration",
    "0",
    "-loglevel",
    "error",
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",

    // audio -> Opus
    "-ac",
    "2",
    "-ar",
    "48000",
    "-c:a",
    "libopus",
    "-b:a",
    "128k",
    "-application",
    "lowdelay",

    "-f",
    "ogg",
    "pipe:1",
  ];
  const proc = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
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
  await entersState(conn, VoiceConnectionStatus.Ready, 15_000).catch((e) => {
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
  const buttons = [
    ...RADIOS.map((radio) =>
      new ButtonBuilder()
        .setCustomId(BTN_PLAY_PREFIX + radio.key)
        .setLabel(radio.label)
        .setStyle(radio.buttonStyle)
        .setEmoji(radio.emoji)
    ),
    new ButtonBuilder()
      .setCustomId(BTN_STOP)
      .setLabel("Stop")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🟥"),
  ];

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
  }

  // 3) Máximo 5 filas por mensaje
  return rows.slice(0, 5);
}

function makeControlsRowLegacy() {
  // Botones para TODAS las radios + Stop
  const rows = [];
  const rowsNum = Math.max(...RADIOS.map((r) => r.rowIndex));

  for (let index = 0; index <= rowsNum; index++) {
    const row = new ActionRowBuilder();

    for (const radio of RADIOS.filter((r) => r.rowIndex === index)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(BTN_PLAY_PREFIX + radio.key)
          .setLabel(radio.label)
          .setStyle(radio.buttonStyle)
          .setEmoji(radio.emoji)
      );
    }

    rows.push(row);
  }

  const endRow = new ActionRowBuilder();
  endRow.addComponents(
    new ButtonBuilder()
      .setCustomId(BTN_STOP)
      .setLabel("Stop")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🟥")
  );

  rows.push(endRow);

  return rows;
}

function makeControlsRowLegacy2() {
  // Botones para TODAS las radios + Stop
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("pedo")
      .setLabel("pedo")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🟥")
  );
  return row;
}

// ---------- Core actions ----------
async function playRadioInUserChannel(guild, userId, radioKey) {
  const url = RADIOS_URLS[radioKey];
  if (!url) throw new Error("Radio no configurada: " + radioKey);

  const member = await guild.members.fetch(userId);
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) throw new Error("Debes estar en un canal de voz.");

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
    try {
      conn.destroy();
    } catch {}
    connections.delete(guild.id);
  }
}

// ---------- Events ----------
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Conectado como ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Slash: /radio <radio>
  if (interaction.isChatInputCommand() && interaction.commandName === "radio") {
    const radioKey = interaction.options.getString("radio");
    await interaction.deferReply({ ephemeral: false }); // público
    try {
      await playRadioInUserChannel(
        interaction.guild,
        interaction.user.id,
        radioKey
      );
      const label = RADIOS.find((s) => s.key === radioKey)?.label || radioKey;
      await interaction.editReply({
        content: `▶️ Reproduciendo **${label}**`,
        components: makeControlsRowLegacy(),
      });
    } catch (e) {
      await interaction.editReply({
        content: `❌ ${e.message}`,
        components: makeControlsRowLegacy(),
      });
    }
    return;
  }

  // Botones (públicos)
  if (interaction.isButton()) {
    await interaction.deferReply({ ephemeral: false });

    if (interaction.customId.startsWith(BTN_PLAY_PREFIX)) {
      const radioKey = interaction.customId.split(":")[1];
      try {
        await playRadioInUserChannel(
          interaction.guild,
          interaction.user.id,
          radioKey
        );
        const label = RADIOS.find((s) => s.key === radioKey)?.label || radioKey;
        await interaction.editReply({
          content: `▶️ Reproduciendo **${label}**`,
          components: makeControlsRowLegacy(),
        });
      } catch (e) {
        await interaction.editReply({
          content: `❌ ${e.message}`,
          components: makeControlsRowLegacy(),
        });
      }
      return;
    }

    if (interaction.customId === BTN_STOP) {
      await stopInGuild(interaction.guild);
      await interaction.editReply({
        content: "⏹️ Radio detenida.",
        components: makeControlsRowLegacy(),
      });
      return;
    }
  }
});

// ---------- Login ----------
if (!process.argv.includes("--register")) {
  if (!process.env.DISCORD_TOKEN) {
    console.error("Falta DISCORD_TOKEN en .env");
    process.exit(1);
  }
  client.login(process.env.DISCORD_TOKEN);
}
