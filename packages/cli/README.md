# mdl MusicDownLoader

A terminal music downloader for people who want to sync music locally.

Paste a URL, and the `mdl` resolves music metadata, searches YouTube for matches, and downloads tracks. It stores a local sync manifest so future runs can reconcile the folder instead of starting over.

![mdl](https://github.com/user-attachments/assets/796efc3b-9512-4d1c-9377-c51b89aa9437)


### Providers

- Spotify
- Apple Music
- Amazon Music
- YouTube Music
- SoundCloud
- Bandcamp
- Qobuz
- Deezer
- Tidal

### Why use it

- Interactive CLI
- Links work without API keys, we query via public urls
- Downloads are grouped into a music name directory
- A `.mdl.json` manifest is written next to the files for resyncs
- Metadata is resolved directly from the music URL
- Audio is currently sourced from YouTube

## Install

`ffmpeg` must already be installed and available on your `PATH`.

### NPM/BUN/PNPM

```bash
npm install --global @mdlx/cli
```
or
```bash
npx @mdlx/cli
```

### Homebrew

```bash
brew tap labithiotis/homebrew-tap && brew install mdl
```

### Manual

Download the archive for your platform from the project's [Releases](https://github.com/labithiotis/mdl/releases) page, extract the binary, and move it somewhere on your `PATH`.

```bash
chmod +x mdl
mv mdl /usr/local/bin/mdl
mdl --help
```

## Usage

Run the interactive CLI:

```bash
mdl
```

Pass a playlist URL directly:

```bash
mdl "https://open.spotify.com/playlist/..."
```

Choose a base output directory:

```bash
mdl "https://open.spotify.com/playlist/..." --output ./music
```

Control how many tracks download in parallel:

```bash
mdl "https://open.spotify.com/playlist/..." --parallel 5
```

Choose the extracted audio format and quality:

```bash
mdl "https://open.spotify.com/playlist/..." --format m4a --bitrate 192K
```

CLI help:

```bash
mdl --help
```
