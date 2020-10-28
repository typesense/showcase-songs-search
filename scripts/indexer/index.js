const BATCH_SIZE = process.env.BATCH_SIZE || 100;
const DATA_FILE = process.env.DATA_FILE || './scripts/data/1K-songs.json';

const fs = require('fs');
const readline = require('readline');
const Typesense = require('typesense');

function extractUrls(parsedRecord) {
  return parsedRecord['relations']
    .filter(r =>
      [
        'amazon asin',
        'streaming',
        'free streaming',
        'download for free',
        'purchase for download',
        'purchase for mail-order',
      ].includes(r['type'])
    )
    .map(r => {
      return { type: r['type'], url: r['url']['resource'] };
    });
}

async function addSongsToTypesense(songs, typesense, collectionName) {
  try {
    const returnData = await typesense
      .collections(collectionName)
      .documents()
      .import(songs);
    // console.log(returnData);

    const failedItems = returnData.filter(item => item.success === false);
    if (failedItems.length > 0) {
      throw new Error(
        `Error indexing items ${JSON.stringify(failedItems, null, 2)}`
      );
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports = (async () => {
  const typesense = new Typesense.Client({
    nodes: [
      {
        host: 'localhost',
        port: '8108',
        protocol: 'http',
      },
    ],
    apiKey: 'xyz',
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
      { name: 'song_length', type: 'int32', facet: true, optional: true },
      { name: 'country', type: 'string', facet: true },
      { name: 'release_date', type: 'int64', facet: true },
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

  const fileStream = fs.createReadStream(DATA_FILE);
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
        ...parsedRecord['media']
          .map(media => media['tracks'])
          .flat()
          .filter(track => track) // To remove nulls
          .map(track => {
            const song = {
              track_id: track['id'],
              title: track['title'],
              album_name: parsedRecord['title'],
              primary_artist_name:
                parsedRecord['artist-credit'][0]['artist']['name'],
              genres: [
                ...track['recording']['genres'].map(g => g.name),
                ...parsedRecord['genres'].map(g => g.name),
                ...parsedRecord['release-group']['genres'].map(g => g.name),
              ].map(
                ([firstChar, ...rest]) =>
                  firstChar.toUpperCase() + rest.join('').toLowerCase()
              ),
              tags: [
                ...track['recording']['tags'].map(t => t.name),
                ...parsedRecord['tags'].map(t => t.name),
                ...parsedRecord['release-group']['tags'].map(t => t.name),
              ],
              song_length: track['length'] || 0,
              country: parsedRecord['country'] || 'Unknown',
              release_date:
                Date.parse(
                  parsedRecord['release-group']['first-release-date']
                ) || 0,
              release_group_types: [
                parsedRecord['release-group']['primary-type'] || 'Unknown',
                parsedRecord['release-group']['secondary-types'] || null,
              ]
                .flat()
                .filter(e => e),
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
      console.log('✅');
      songs = [];
    }
  }

  if (songs.length > 0) {
    await addSongsToTypesense(songs, typesense, collectionName);
    console.log('✅');
  }

  let oldCollectionName;
  try {
    oldCollectionName = await typesense.aliases('s').retrieve()[
      'collection_name'
    ];
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
