# 🎶 MusicBrainz Song Search, powered by Typesense

This is a demo that showcases some of Typesense's features using a 30 Million database of songs from MusicBrainz.

View it live here: [http://songs-search.typesense.org/](http://songs-search.typesense.org/)

## Development

To run this project locally, install the dependencies and run the local server:

```sh
yarn
yarn run typesenseServer
BATCH_SIZE=1000 yarn run indexer
yarn start
```

Open http://localhost:3000 to see the app.

## Deployment

The app is hosted on [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform/).

Pushing to master will deploy the app to production.
