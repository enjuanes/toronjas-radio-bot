// commands/radio.js
import { SlashCommandBuilder } from "discord.js";

import { ButtonStyle } from "discord.js";

// Lista de radios visibles en el comando y que usaremos para los botones
export const RADIOS = [
  {
    key: "vibes",
    label: "Simulator Vibes",
    buttonStyle: ButtonStyle.Success,
    emoji: "🚜",
    rowIndex: 0,
  },
  {
    key: "radio_maria",
    label: "Radio María",
    buttonStyle: ButtonStyle.Success,
    emoji: "🙏",
    rowIndex: 0,
  },
  {
    key: "megastar",
    label: "MegaStar",
    buttonStyle: ButtonStyle.Primary,
    emoji: "⭐",
    rowIndex: 1,
  },
  {
    key: "motiva",
    label: "Motiva FM",
    buttonStyle: ButtonStyle.Primary,
    emoji: "🍑",
    rowIndex: 1,
  },
  {
    key: "flaix",
    label: "Flaix FM",
    buttonStyle: ButtonStyle.Primary,
    emoji: "⚡",
    rowIndex: 1,
  },
  {
    key: "cadena_100",
    label: "Cadena 100",
    buttonStyle: ButtonStyle.Primary,
    emoji: "⛓️",
    rowIndex: 1,
  },
  {
    key: "los40",
    label: "LOS40",
    buttonStyle: ButtonStyle.Danger,
    emoji: "🐄",
    rowIndex: 2,
  },
  {
    key: "los40_urban",
    label: "LOS40 Urban",
    buttonStyle: ButtonStyle.Danger,
    emoji: "🐃",
    rowIndex: 2,
  },
  {
    key: "fallout",
    label: "Fallout",
    buttonStyle: ButtonStyle.Primary,
    emoji: "☢️",
    rowIndex: 3,
  },
  {
    key: "fallout_diamon_city_radio",
    label: "Diamon City Radio",
    buttonStyle: ButtonStyle.Primary,
    emoji: "💎",
    rowIndex: 3,
  },
  {
    key: "fallout_radio_new_vegas",
    label: "Radio New Vegas",
    buttonStyle: ButtonStyle.Primary,
    emoji: "🎰",
    rowIndex: 3,
  },
  {
    key: "fallout_galaxy_news_radio",
    label: "Galaxy News Radio",
    buttonStyle: ButtonStyle.Primary,
    emoji: "✨",
    rowIndex: 3,
  },
  {
    key: "fallout_76",
    label: "76",
    buttonStyle: ButtonStyle.Primary,
    emoji: "💩",
    rowIndex: 3,
  },
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
