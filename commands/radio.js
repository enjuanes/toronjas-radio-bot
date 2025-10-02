// commands/radio.js
import { SlashCommandBuilder } from 'discord.js';

export const STATIONS = [
  { key: 'megastar', label: '⭐MegaStar' },
  // añade aquí más estaciones: { key: 'mi_radio', label: '🎵Mi Radio' }
];

export const data = new SlashCommandBuilder()
  .setName('radio')
  .setDescription('Reproduce una emisora en tu canal de voz')
  .addStringOption(o =>
    o.setName('estacion')
      .setDescription('Emisora a reproducir')
      .setRequired(true)
      .addChoices(
        ...STATIONS.map(s => ({ name: s.label, value: s.key }))
      )
  );
