// commands/radio.js
import { SlashCommandBuilder } from "discord.js";

import { ButtonStyle } from "discord.js";

// Lista de radios visibles en el comando y que usaremos para los botones
export const RADIOS = [
  {
    key: "megastar",
    label: "MegaStar",
    buttonStyle: ButtonStyle.Primary,
    emoji: "⭐",
  },
  {
    key: "vibes",
    label: "Simulator Vibes",
    buttonStyle: ButtonStyle.Success,
    emoji: "🚜",
  }, // <- nueva emisora (MP3/Icecast)
];

export const data = new SlashCommandBuilder()
  .setName("radio")
  .setDescription("Reproduce una radio en tu canal de voz")
  .addStringOption((option) =>
    option
      .setName("radio")
      .setDescription("Radio a reproducir")
      .setRequired(true)
      .addChoices(...RADIOS.map((s) => ({ name: s.label, value: s.key })))
  );
