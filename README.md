# tv-shows-cli

[![Build Status][ci-img]][ci]

Personal TV shows manager.

![](https://github.com/niksy/tv-shows-cli/raw/master/media/usage.gif)

## Install

```sh
npm install -g @niksy/tv-shows-cli
```

## Usage

```
tv-shows

  Personal TV shows manager.

  Usage
    $ tv-shows [options]

  Options
    -d, --date [human date]  Display TV shows for given (airing) date or range of dates in human readable format (Default: yesterday)
    -s, --choose-show  Choose TV show regardless of date
    -o, --organize-files  Organize subtitle and video files (optionally refreshing Plex Media Server library)
```

## Configuration

Configuration is stored in `.tvshowsrc` file and parsed with [cosmiconfig][cosmiconfig].

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `subtitleLanguage` | `String|Number` | | [Subtitle language][subtitle-language]. |
| `quality` | `String[]` | | [Video/audio quality][quality]. |
| `country` | `String[]` | | [Country schedule][country-schedule]. |
| `showsDir` | `String` | [OS homedir][os-homedir] | Shows directory location. Used for default subtitle download location. |
| `maxItems` | `Number` | `15` | Maximum number of torrents and subtitles to display. |
| `refreshPlexLibrary` | `Boolean` | `false` | Refresh [Plex][plex] library when organizing files. |
| `shows` | `Object[]` | | [List of shows][shows]. |

### Example

```json
{
	"subtitleLanguage": "en_US",
	"quality": ["720p"],
	"country": ["US", "GB"],
	"showsDir": "~/Movies",
	"maxItems": 15,
	"refreshPlexLibrary": false,
	"shows": [
		{
			"title": "Game of Thrones",
			"webChannel": false,
			"tvmazeId": 123,
			"addic7edId": 456,
			"searchQuery": [
				"game of thrones",
				"of thrones"
			]
		}
	]
}
```

## License

MIT © [Ivan Nikolić](http://ivannikolic.com)

[ci]: https://travis-ci.org/niksy/tv-shows-cli
[ci-img]: https://travis-ci.org/niksy/tv-shows-cli.svg?branch=master
[subtitle-language]: https://github.com/niksy/tv-shows#subtitlelanguage
[quality]: https://github.com/niksy/tv-shows#quality
[shows]: https://github.com/niksy/tv-shows#show-configuration
[cosmiconfig]: https://github.com/davidtheclark/cosmiconfig
[os-homedir]: https://github.com/sindresorhus/os-homedir
[country-schedule]: https://github.com/niksy/tv-shows#country
[plex]: https://www.plex.tv/
