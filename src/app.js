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
  numericMenu,
  sortBy,
} from 'instantsearch.js/es/widgets';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import images from '../images/*.*';

function iconForUrlObject(urlObject) {
  if (urlObject['type'] === 'amazon asin') {
    return images['amazon_icon']['svg'];
  } else if (urlObject['url'].includes('spotify.com')) {
    return images['spotify_icon']['svg'];
  } else if (urlObject['url'].includes('itunes.apple.com')) {
    return images['itunes_icon']['svg'];
  } else if (urlObject['url'].includes('music.apple.com')) {
    return images['apple_music_icon']['svg'];
  } else if (urlObject['url'].includes('youtube.com')) {
    return images['youtube_icon']['svg'];
  } else if (urlObject['url'].includes('tidal.com')) {
    return images['tidal_icon']['svg'];
  } else if (urlObject['url'].includes('play.google.com')) {
    return images['google_play_icon']['svg'];
  } else if (urlObject['url'].includes('deezer.com')) {
    return images['deezer_icon']['svg'];
  } else if (urlObject['url'].includes('archive.org')) {
    return images['archive_icon']['svg'];
  } else {
    return images['generic_song_link_icon']['svg'];
  }
}

const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: {
    apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY, // Be sure to use an API key that only allows searches, in production
    nodes: [
      {
        host: process.env.TYPESENSE_HOST,
        port: process.env.TYPESENSE_PORT,
        protocol: process.env.TYPESENSE_PROTOCOL,
      },
    ],
  },
  // The following parameters are directly passed to Typesense's search API endpoint.
  //  So you can pass any parameters supported by the search endpoint below.
  //  queryBy is required.
  additionalSearchParameters: {
    queryBy: 'title,album_name,primary_artist_name',
  },
});
const searchClient = typesenseInstantsearchAdapter.searchClient;
const indexName = process.env.TYPESENSE_COLLECTION_NAME;
const search = instantsearch({
  searchClient,
  indexName: indexName,
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
    placeholder: 'Search for a song, album or artist',
    autofocus: true,
    cssClasses: {
      input: 'form-control',
    },
  }),

  analytics({
    pushFunction(formattedParameters, state, results) {
      window.gtag(
        'set',
        'page',
        (window.location.pathname + window.location.search).toLowerCase()
      );
      window.gtag('send', 'pageView');
    },
  }),

  stats({
    container: '#stats',
    templates: {
      text: `
      {{#hasNoResults}}No results{{/hasNoResults}}
      {{#hasOneResult}}1 result{{/hasOneResult}}
      {{#hasManyResults}}{{#helpers.formatNumber}}{{nbHits}}{{/helpers.formatNumber}} results{{/hasManyResults}}
      found. Searched 32 Million songs in {{processingTimeMS}}ms.
    `,
    },
  }),
  infiniteHits({
    container: '#hits',
    cssClasses: {
      list: 'list-unstyled grid-container',
      item: 'd-flex flex-column search-result-card bg-light-2 p-4 pt-5 p-md-3',
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
            <div class="text-muted small mb-3">
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
  numericMenu({
    container: '#release-date-selector',
    attribute: 'release_date',
    items: [
      { label: 'All' },
      { label: '1950s', start: -631152000, end: -315619201 },
      { label: '1960s', start: -315619200, end: -1 },
      { label: '1970s', start: 0, end: 315532799 },
      { label: '1980s', start: 315532800, end: 631151999 },
      { label: '1990s', start: 631152000, end: 946684799 },
      { label: '2000s', start: 946684800, end: 1262303999 },
      { label: '2010s', start: 1262304000, end: 1577836799 },
      { label: '2020s', start: 1577836800, end: 1893455999 },
    ],
    cssClasses: {
      list: 'list-unstyled',
      radio: 'mr-1',
    },
  }),
  configure({
    hitsPerPage: 15,
  }),
  sortBy({
    container: '#sort-by',
    items: [
      { label: 'Recent first', value: `${indexName}` },
      { label: 'Oldest first', value: `${indexName}/sort/release_date:asc` },
    ],
    cssClasses: {
      select: 'custom-select custom-select-sm',
    },
  }),
]);

search.on('render', function() {
  const $searchBox = $('#searchbox input[type=search]');

  // Make artist names clickable
  $('#hits .clickable-search-term').on('click', event => {
    $searchBox.val(event.currentTarget.textContent);
    search.helper.setQuery($searchBox.val()).search();
  });
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
  $('.clickable-search-term').on('click', event => {
    $searchBox.val(event.currentTarget.textContent);
    search.helper.setQuery($searchBox.val()).search();
  });

  // Clear refinements, when searching
  $searchBox.on('keydown', event => {
    search.helper.clearRefinements();
  });
});
