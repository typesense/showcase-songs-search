import jQuery from 'jquery';

window.$ = jQuery; // workaround for https://github.com/parcel-bundler/parcel/issues/333

import 'popper.js';
import 'bootstrap';

import instantsearch from 'instantsearch.js/es';
import {
  searchBox,
  infiniteHits,
  configure,
  stats,
  analytics,
  refinementList,
  menu,
  sortBy,
  currentRefinements,
} from 'instantsearch.js/es/widgets';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import { SearchClient as TypesenseSearchClient } from 'typesense'; // To get the total number of docs
import images from '../images/*.*';
import STOP_WORDS from './utils/stop_words.json';

// Source: https://stackoverflow.com/a/901144/123545
const anchorParams = new Proxy(
  new URLSearchParams(window.location.hash.replace('#', '')),
  {
    get: (anchorParams, prop) => anchorParams.get(prop),
  }
);

let TYPESENSE_SERVER_CONFIG = {
  apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY, // Be sure to use an API key that only allows searches, in production
  nodes: [
    {
      host: anchorParams.host ? anchorParams.host : process.env.TYPESENSE_HOST,
      port: process.env.TYPESENSE_PORT,
      protocol: process.env.TYPESENSE_PROTOCOL,
    },
  ],
  numRetries: 8,
  useServerSideSearchCache: true,
};

// [2, 3].forEach(i => {
//   if (process.env[`TYPESENSE_HOST_${i}`]) {
//     TYPESENSE_SERVER_CONFIG.nodes.push({
//       host: process.env[`TYPESENSE_HOST_${i}`],
//       port: process.env.TYPESENSE_PORT,
//       protocol: process.env.TYPESENSE_PROTOCOL,
//     });
//   }
// });

// Unfortunately, dynamic process.env keys don't work with parcel.js
// So need to enumerate each key one by one

if (process.env[`TYPESENSE_HOST_2`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: anchorParams.host
      ? anchorParams.host
      : process.env[`TYPESENSE_HOST_2`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_3`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: anchorParams.host
      ? anchorParams.host
      : process.env[`TYPESENSE_HOST_3`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_NEAREST`]) {
  TYPESENSE_SERVER_CONFIG['nearestNode'] = {
    host: anchorParams.host
      ? anchorParams.host
      : process.env[`TYPESENSE_HOST_NEAREST`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  };
}

const INDEX_NAME = process.env.TYPESENSE_COLLECTION_NAME;

async function getIndexSize() {
  let typesenseSearchClient = new TypesenseSearchClient(
    TYPESENSE_SERVER_CONFIG
  );
  let results = await typesenseSearchClient
    .collections(INDEX_NAME)
    .documents()
    .search({ q: '*' });

  return results['found'];
}

let indexSize;

(async () => {
  indexSize = await getIndexSize();
})();

function iconForUrlObject(urlObject) {
  if (
    urlObject['type'] === 'amazon asin' ||
    urlObject['url'].includes('amazon.com')
  ) {
    return images['amazon_icon']['svg'];
  } else if (urlObject['url'].includes('spotify.com')) {
    return images['spotify_icon']['svg'];
  } else if (urlObject['url'].includes('itunes.apple.com')) {
    return images['itunes_icon']['svg'];
  } else if (urlObject['url'].includes('music.apple.com')) {
    return images['apple_music_icon']['svg'];
  } else if (urlObject['url'].includes('youtube.com')) {
    return images['youtube_icon']['svg'];
  } else if (urlObject['url'].includes('soundcloud.com')) {
    return images['soundcloud_icon']['svg'];
  } else if (
    urlObject['url'].includes('tidal.com') ||
    urlObject['url'].includes('tidalhifi.com')
  ) {
    return images['tidal_icon']['svg'];
  } else if (urlObject['url'].includes('play.google.com')) {
    return images['google_play_icon']['svg'];
  } else if (urlObject['url'].includes('bandcamp.com')) {
    return images['bandcamp_icon']['svg'];
  } else if (urlObject['url'].includes('deezer.com')) {
    return images['deezer_icon']['svg'];
  } else if (urlObject['url'].includes('archive.org')) {
    return images['archive_icon']['svg'];
  } else {
    return images['generic_song_link_icon']['svg'];
  }
}

function queryWithoutStopWords(query) {
  const words = query.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').split(' ');
  return words
    .map(word => {
      if (STOP_WORDS.includes(word.toLowerCase())) {
        return null;
      } else {
        return word;
      }
    })
    .filter(w => w)
    .join(' ')
    .trim();
}

const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: TYPESENSE_SERVER_CONFIG,
  // The following parameters are directly passed to Typesense's search API endpoint.
  //  So you can pass any parameters supported by the search endpoint below.
  //  queryBy is required.
  additionalSearchParameters: {
    query_by: 'primary_artist_name,title,album_name',
    query_by_weights: '2,2,1',
    sort_by: '_text_match(buckets: 10):desc'
  },
});
const searchClient = typesenseInstantsearchAdapter.searchClient;

const search = instantsearch({
  searchClient,
  indexName: INDEX_NAME,
  routing: true,
  searchFunction(helper) {
    if (helper.state.query === '') {
      $('#results-section').addClass('d-none');
    } else {
      $('#results-section').removeClass('d-none');
      helper.search();
    }
  },
});

search.addWidgets([
  searchBox({
    container: '#searchbox',
    showSubmit: false,
    showReset: false,
    placeholder: 'Type in a song, artist or album name',
    autofocus: true,
    cssClasses: {
      input: 'form-control',
    },
    queryHook(query, search) {
      const modifiedQuery = queryWithoutStopWords(query);
      if (modifiedQuery.trim() !== '') {
        search(modifiedQuery);
      }
    },
  }),

  analytics({
    pushFunction(formattedParameters, state, results) {
      window.ga(
        'set',
        'page',
        (window.location.pathname + window.location.search).toLowerCase()
      );
      window.ga('send', 'pageView');
    },
  }),

  stats({
    container: '#stats',
    templates: {
      text: ({ nbHits, hasNoResults, hasOneResult, processingTimeMS }) => {
        let statsText = '';
        if (hasNoResults) {
          statsText = 'No results';
        } else if (hasOneResult) {
          statsText = '1 result';
        } else {
          statsText = `${nbHits.toLocaleString()} results`;
        }
        return `${statsText} found ${
          indexSize ? ` - Searched ${indexSize.toLocaleString()} songs` : ''
        } in ${processingTimeMS}ms.`;
      },
    },
  }),
  infiniteHits({
    container: '#hits',
    cssClasses: {
      list: 'list-unstyled grid-container',
      item: 'd-flex flex-column search-result-card bg-light-2 p-3',
      loadMore: 'btn btn-primary mx-auto d-block mt-4',
    },
    templates: {
      item: `
            <h6 class="text-primary font-weight-light font-letter-spacing-loose mb-0">
              {{#helpers.highlight}}{ "attribute": "title" }{{/helpers.highlight}}
            </h6>
            <div>
              by
              <a role="button" class="clickable-search-term">{{#helpers.highlight}}{ "attribute": "primary_artist_name" }{{/helpers.highlight}}</a>
            </div>
            <div class="mt-3">
              from {{#helpers.highlight}}{ "attribute": "album_name" }{{/helpers.highlight}}
            </div>
            <div class="text-muted small mb-2">
              {{ release_date_display }}
            </div>

            <div class="mt-auto text-right">
              {{#urls}}
              <a href="{{ url }}" target="_blank" class="ml-1"><img src="{{ icon }}" alt="{{ type }}" height="14"></a>
              {{/urls}}
            </div>
        `,
      empty: 'No songs found for <q>{{ query }}</q>. Try another search term.',
    },
    transformItems: items => {
      return items.map(item => {
        return {
          ...item,
          release_date_display: (() => {
            const parsedDate = new Date(item.release_date * 1000);
            return `${parsedDate.getUTCFullYear()}/${(
              '0' +
              (parsedDate.getUTCMonth() + 1)
            ).slice(-2)}`;
          })(),
          urls: item.urls.map(urlObj => {
            return {
              icon: iconForUrlObject(urlObj),
              ...urlObj,
            };
          }),
        };
      });
    },
  }),
  refinementList({
    container: '#genres-refinement-list',
    attribute: 'genres',
    searchable: true,
    searchablePlaceholder: 'Search genres',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm align-content-center',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),
  refinementList({
    container: '#artists-refinement-list',
    attribute: 'primary_artist_name',
    searchable: true,
    searchablePlaceholder: 'Search artists',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),
  refinementList({
    container: '#release-type-refinement-list',
    attribute: 'release_group_types',
    searchable: true,
    searchablePlaceholder: 'Search release types',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),
  refinementList({
    container: '#countries-refinement-list',
    attribute: 'country',
    searchable: true,
    searchablePlaceholder: 'Search countries',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),
  menu({
    container: '#release-date-selector',
    attribute: 'release_decade',
    sortBy: ['name:asc'],
    cssClasses: {
      list: 'list-unstyled',
      item: 'pl-2 mb-2 text-normal',
      count: 'badge badge-light bg-light-2 ml-2',
      selectedItem: 'bg-secondary p-2 pl-3',
    },
  }),
  configure({
    hitsPerPage: 15,
  }),
  sortBy({
    container: '#sort-by',
    items: [
      { label: 'Recent first', value: `${INDEX_NAME}` },
      { label: 'Oldest first', value: `${INDEX_NAME}/sort/release_date:asc` },
    ],
    cssClasses: {
      select: 'custom-select custom-select-sm',
    },
  }),
  currentRefinements({
    container: '#current-refinements',
    cssClasses: {
      list: 'list-unstyled',
      label: 'd-none',
      item: 'h5',
      category: 'badge badge-light bg-light-2 px-3',
      delete: 'btn btn-sm btn-link p-0 pl-2',
    },
    transformItems: items => {
      const modifiedItems = items.map(item => {
        return {
          ...item,
          label: '',
        };
      });
      return modifiedItems;
    },
  }),
]);

function handleSearchTermClick(event) {
  const $searchBox = $('#searchbox input[type=search]');
  search.helper.clearRefinements();
  $searchBox.val(event.currentTarget.textContent);
  search.helper.setQuery($searchBox.val()).search();
}

search.on('render', function() {
  // Make artist names clickable
  $('#hits .clickable-search-term').on('click', handleSearchTermClick);
});

search.start();

$(function() {
  const $searchBox = $('#searchbox input[type=search]');
  // Set initial search term
  // if ($searchBox.val().trim() === '') {
  //   $searchBox.val('Song');
  //   search.helper.setQuery($searchBox.val()).search();
  // }

  // Handle example search terms
  $('.clickable-search-term').on('click', handleSearchTermClick);

  // Clear refinements, when searching
  $searchBox.on('keydown', event => {
    search.helper.clearRefinements();
  });

  if (!matchMedia('(min-width: 768px)').matches) {
    $searchBox.on('focus, keydown', () => {
      $('html, body').animate(
        {
          scrollTop: $('#searchbox-container').offset().top,
        },
        500
      );
    });
  }
});
