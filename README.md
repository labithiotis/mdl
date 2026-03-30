# mdl MusicDownLoader

> WARNING: under active development!!

`mdl` is MusicDownLoader, a terminal music downloader for people who want to sync music locally.

Paste a URL, and the tool resolves music metadata, searches YouTube for matches, and downloads tracks. It stores a local sync manifest so future runs can reconcile the folder instead of starting over.

![mdl](https://github.com/user-attachments/assets/796efc3b-9512-4d1c-9377-c51b89aa9437)


## Provider support

Recognized providers:

- Spotify
- Apple Music
- Amazon Music
- YouTube Music
- SoundCloud
- Bandcamp
- Qobuz
- Deezer
- Tidal

Current implementation status:

- Music metadata import is attempted for every provider listed above.
- Spotify still has the most direct/robust metadata path in the current implementation.
- Audio downloads currently come from YouTube matches for all supported flows.

## Why use it

- Interactive CLI
- Links work without API keys, we query via public urls
- Downloads are grouped into a music name directory
- A `.mdl.json` manifest is written next to the files for resyncs
- Metadata is resolved directly from the music URL
- Audio is currently sourced from YouTube

## Install

`ffmpeg` must already be installed and available on your `PATH`.


### NPM(x)

```bash
npx mdlx-cli
```
> mdl and divrits are all "squated" 😢

### Homebrew (COMING SOON)

```bash
brew install mdl
```

### Manual

Download the archive for your platform from the project's Releases page, extract the binary, and move it somewhere on your `PATH`.

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

`pnpm test` runs the end-to-end CLI test, which performs a real download and can take several minutes.

## Contributing

Issues and pull requests are welcome. Before opening a PR:

1. Run `pnpm lint`, `pnpm check`, and `pnpm test`.
2. Update the documentation if CLI behavior changes.
3. Keep changes focused and explain any test gaps.

See `CONTRIBUTING.md` for the contribution workflow, `CODE_OF_CONDUCT.md` for community expectations, and `SECURITY.md` for responsible disclosure.

## Example urls

```txt
https://open.spotify.com/playlist/37i9dQZF1E37peeAkY9IZs?si=mVwl4zfbTQujVX8-PleBkw
https://open.spotify.com/album/6eUW0wxWtzkFdaEFsTJto6
https://music.apple.com/us/playlist/new-music-daily/pl.2b0e6e332fdf4b7a91164da3162127b5
https://music.amazon.com/playlists/B01M11SBC8
https://soundcloud.com/soundcloud-amped/sets/the-dive-new-rock-now
https://bandcamp.com/sergemedoff/playlist/leipzig-de-rockpop-mix
https://link.deezer.com/s/32LXyVEY8jkF9wlGiSwa1
https://www.qobuz.com/us-en/playlists/hi-res-masters-jazz-essentials/5104639
https://tidal.com/playlist/36ea71a8-445e-41a4-82ab-6628c581535d
https://music.youtube.com/playlist?list=RDCLAK5uy_nHSqCJjDrW9HBhCNdF6tWPdnOMngOv0wA&playnext=1&si=D5Aj97tJAaxyFE4c
```
