# 🍊 Toronja Radio Bot

A Discord radio bot that plays curated radio streams (HLS/MP3/AAC/OGG) in a voice channel and lets you control playback via Discord interactions (slash commands/buttons).

## Requirements

- **Node.js >= 22.14.0**
- A **Discord Bot Token** (create an app/bot in the Discord Developer Portal)
- A **.env file** with your credentials
- **FFmpeg**: included via `ffmpeg-static` (usually no manual install needed)

### Environment variables

Create a `.env` file in the project root:

- `DISCORD_TOKEN=...`
- `CLIENT_ID=...`
- (Optional / depending on your `index.js`) `GUILD_ID=...` to register commands to a specific guild for faster updates.

> Variable names can vary depending on your implementation, but `DISCORD_TOKEN` and `CLIENT_ID` are the common ones.

## Install

```bash
npm install
```

## Register commands

Before running the bot for the first time (or whenever you change slash commands), register them:

```bash
npm run register
```

## Run the bot

```bash
npm start
```
---

## Radios List

- [🚜 Simulator Vibes](https://gamingrelay.simulatorvibes.com/)
- [🙏 Radio María](http://dreamsiteradiocp2.com:8006/stream)
- [⭐ MegaStar](https://megastar-cope.flumotion.com/chunks.m3u8)
- [🍑 Motiva FM](https://stream.motivafm.com/listen/motiva/motiva.mp3)
- [⚡ Flaix FM](https://us-b4-p-e-jn18-audio.cdn.mdstrm.com/live-audio-aw/65afe4a0357cec56667ac739)
- [🐄 LOS40](https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40AAC.aac)
- [🐃 LOS40 Urban](https://25483.live.streamtheworld.com/LOS40_URBANAAC_SC)
- [⛓️ Cadena 100](https://cadena100-cope.flumotion.com/chunks.m3u8)
- [⛓️‍💥 Cadena Dial](https://25453.live.streamtheworld.com/CADENADIALAAC_SC)
- [☢️ Fallout](https://fallout.fm:8444/falloutfm1.ogg)
- [💎 Diamon City Radio](https://fallout.fm:8444/falloutfm6.ogg)
- [🎰 Radio New Vegas](https://fallout.fm:8444/falloutfm3.ogg)
- [✨ Galaxy News Radio](https://fallout.fm:8444/falloutfm2.ogg)
- [💩 76](https://fallout.fm:8444/falloutfm10.ogg)
