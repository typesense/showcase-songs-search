# 🎶 Typesense Song Search [Demo]

This is a demo that showcases some of Typesense's features using a 30 Million database of songs from MusicBrainz.

**This is still a work in progress, and will be published with more details shortly.**

## Development

To run this project locally, install the dependencies and run the local server:

```sh
yarn
yarn run typesenseServer
BATCH_SIZE=1000 yarn run indexer
yarn start
```

Open http://localhost:3000 to see the app.
