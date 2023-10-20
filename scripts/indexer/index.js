const { Client } = require('typesense');
const fs = require('fs').promises;
const readline = require('readline');

const BATCH_SIZE = process.env.BATCH_SIZE || 100;
const CHUNK_SIZE = process.env.CHUNK_SIZE || 3;
const MAX_LINES = process.env.MAX_LINES || Infinity;
const DATA_FILE = process.env.DATA_FILE || './scripts/data/1K-records.json';

async function extractUrls(parsedRecord) {
  return parsedRecord.relations
    .filter((r) =>
      [
        'amazon asin',
        'streaming',
        'free streaming',
        'download for free',
        'purchase for download',
      ].includes(r.type)
    )
    .map((r) => ({ type: r.type, url: r.url.resource }));
}

async function addSongsToTypesense(songs, typesense, collectionName) {
  const returnDataChunks = await Promise.all(
    songs
      .reduce((chunks, song) => {
        const jsonlString = chunks[chunks.length - 1].length >= CHUNK_SIZE
          ? chunks.push([]) && chunks[chunks.length - 1]
          : chunks[chunks.length - 1];
        jsonlString.push(stringify(song));
        return chunks;
      }, [[]])
      .map((songsChunk) =>
        typesense
          .collections(collectionName)
          .documents()
          .import(songsChunk.join('\n'))
      )
  );

  const failedItems = returnDataChunks
    .map((returnData) =>
      returnData
        .split('\n')
        .map((r) => JSON.parse(r))
        .filter((item) => item.success === false)
    )
    .flat();
  if (failedItems.length > 0) {
    throw new Error(`Error indexing items ${JSON.stringify(failedItems, null, 2)}`);
  }
}

(async () => {
  const typesense = new Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST,
        port: process.env.TYPESENSE_PORT,
        protocol: process.env.TYPESENSE_PROTOCOL,
      },
    ],
    apiKey: process.env.TYPESENSE_ADMIN_API_KEY,
  });

  const collectionName = `songs_${Date.now()}`;
  const schema = {
    name: collectionName,
    fields: [
      { name: 'track_id', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'album_name', type: 'string', optional: true },
      { name: 'primary_artist_name', type: 'string', facet: true },
      { name: 'genres', type: 'string[]', facet: true },
      { name: 'country', type: 'string', facet: true },
      { name: 'release_date', type: 'int64' },
      { name: 'release_decade', type: 'string', facet: true },
      { name: 'release_group_types', type: 'string[]', facet: true },
      // { name: 'urls'},
    ],
    default_sorting_field: 'release_date',
  };

  console.log(`Populating new collection in Typesense ${collectionName}`);

  console.log('Creating schema: ');
  // console.log(JSON.stringify(schema, null, 2));
  await typesense.collections().create(schema);

  console.log('Adding records: ');

  const fileStream = await fs.open(DATA_FILE, 'r');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let songs = [];
  let currentLine = 0;
  for await (const line of rl) {
    currentLine += 1;
    const parsedRecord = JSON.parse(line);
    try {
      songs.push(
        ...parsedRecord.media
          .map((media) => media.tracks)
          .flat()
          .filter((track) => track) // To remove nulls
          .map((track) => {
            const releaseDate =
              Math.round(
                Date.parse(parsedRecord['release-group']['first-release-date']) / 1000
              ) || 0;

            const song = {
              track_id: track.id,
              title: track.title,
              album_name: parsedRecord.title,
              primary_artist_name: parsedRecord['artist-credit'][0].artist.name,
              genres: [
                ...track.recording.genres.map((g) => g.name),
                ...parsedRecord.genres.map((g) => g.name),
                ...parsedRecord['release-group'].genres.map((g) => g.name),
              ].map(
                ([firstChar, ...rest]) =>
                  firstChar.toUpperCase() + rest.join('').toLowerCase()
              ),
              country: parsedRecord.country || 'Unknown',
              release_date: releaseDate,
              release_decade: `${Math.round(
                new Date(releaseDate * 1000).getUTCFullYear() / 10
              ) * 10}s`,
              release_group_types: [
                parsedRecord['release-group']['primary-type'] || 'Unknown',
                parsedRecord['release-group']['secondary-types'] || null,
              ]
                .flat()
                .filter((e) => e),
              urls: extractUrls(parsedRecord),
            };
            process.stdout.write('.');
            return song;
          })
      );
    } catch (e) {
      console.error(e);
      console.error(parsedRecord);
      throw e;
    }

    if (currentLine % BATCH_SIZE === 0) {
      await addSongsToTypesense(songs, typesense, collectionName);
      console.log(` Lines up to ${currentLine} ✅`);
      songs = [];
    }

    if (currentLine >= MAX_LINES) {
      break;
    }
  }

  if (songs.length > 0) {
    await addSongsToTypesense(songs, typesense, collectionName);
    console.log('✅');
  }

  let oldCollectionName;
  try {
    oldCollectionName = (await typesense.aliases('s').retrieve())['collection_name'];
  } catch (error) {
    // Do nothing
  }

  try {
    console.log(`Update alias s -> ${collectionName}`);
    await typesense.aliases().upsert('s', { collection_name: collectionName });

    if (oldCollectionName) {
      console.log(`Deleting old collection ${oldCollectionName}`);
      await typesense.collections(oldCollectionName).delete();
    }
  } catch (error) {
    console.error(error);
  }
})();

