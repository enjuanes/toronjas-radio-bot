// commands/radio.js
import { SlashCommandBuilder } from 'discord.js';

// Lista de emisoras visibles en el comando y que usaremos para los botones
export const STATIONS = [
  { key: 'megastar', label: '⭐MegaStar' },
  { key: 'vibes',    label: '🚜Simulator Vibes' }, // <- nueva emisora (MP3/Icecast)
];

export const data = new SlashCommandBuilder()
  .setName('radio')
  .setDescription('Reproduce una emisora en tu canal de voz')
  .addStringOption(o =>
    o.setName('estacion')
      .setDescription('Emisora a reproducir')
      .setRequired(true)
      .addChoices(...STATIONS.map(s => ({ name: s.label, value: s.key })))
  );
