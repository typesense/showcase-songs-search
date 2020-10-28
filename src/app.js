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
  sortBy,
} from 'instantsearch.js/es/widgets';

import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';

const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: {
    apiKey: 'xyz', // Be sure to use an API key that only allows searches, in production
    nodes: [
      {
        host: 'localhost',
        port: '8108',
        protocol: 'http',
      },
    ],
  },
  // The following parameters are directly passed to Typesense's search API endpoint.
  //  So you can pass any parameters supported by the search endpoint below.
  //  queryBy is required.
  additionalSearchParameters: {
    queryBy:
      'title,album_name,primary_artist_name,additional_artists,genres,tags',
    highlightAffixNumTokens: 50,
  },
});
const searchClient = typesenseInstantsearchAdapter.searchClient;
const indexName = 's';
const search = instantsearch({
  searchClient,
  indexName: indexName,
  routing: true,
});

search.addWidgets([
  searchBox({
    container: '#searchbox',
    showSubmit: false,
    showReset: false,
    placeholder: 'Enter a song, album, artist or genre name',
    autofocus: true,
    cssClasses: {
      input: 'form-control',
    },
  }),

  // analytics({
  //   pushFunction(formattedParameters, state, results) {
  //     window.ga('set', 'page', (window.location.pathname + window.location.search).toLowerCase());
  //     window.ga('send', 'pageView');
  //   },
  // }),

  stats({
    container: '#stats',
  }),

  infiniteHits({
    container: '#hits',
    cssClasses: {
      list: 'list-unstyled grid-container',
      item: 'bg-light-2',
      loadMore: 'btn btn-primary',
    },
    templates: {
      item: window.$('#hit-template').html(),
      empty: 'No songs found for <q>{{ query }}</q>. Try another search term.',
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

search.start();

$(function() {
  // Set initial topic, if empty
  // if (
  //   $('input[type=search]')
  //     .val()
  //     .trim() === ''
  // ) {
  //   $('input[type=search]').val('Billy');
  //   search.helper.setQuery($('input[type=search]').val()).search();
  // }

  // Handle example search terms
  $('#example-search-terms a').on('click', event => {
    $('input[type=search]').val(event.target.textContent);
    search.helper.setQuery($('input[type=search]').val()).search();

    if (!matchMedia('(min-width: 768px)').matches) {
      setTimeout(() => {
        $('html, body').animate(
          {
            scrollTop: $('#best-experienced-warning').offset().top,
          },
          500
        );
      }, 1000);
    }
  });
});
