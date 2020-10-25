import jQuery from 'jquery';

window.$ = jQuery; // workaround for https://github.com/parcel-bundler/parcel/issues/333

import 'popper.js';
import 'bootstrap';

import instantsearch from 'instantsearch.js/es';
import {
  searchBox,
  index,
  infiniteHits,
  configure,
  stats,
  analytics,
  sortBy,
} from 'instantsearch.js/es/widgets';

import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';

const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: {
    apiKey: 'JI4dMXT5jzAEce1MGjBLm629uhW6f054', // Be sure to use an API key that only allows searches, in production
    nodes: [
      {
        host: 'jyesxngqh9543pbip-1.a1.typesense.net',
        port: '443',
        protocol: 'https',
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
    typoTokensThreshold: 2,
  },
});
const searchClient = typesenseInstantsearchAdapter.searchClient;

const search = instantsearch({
  searchClient,
  indexName: 's',
  routing: true,
  searchFunction(helper) {
    if (helper.state.query === '') {
      $('#hitsSection,#loadMoreSection').addClass('d-none');
    } else {
      $('#hitsSection,#loadMoreSection').removeClass('d-none');
    }
    helper.search();
  },
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
      list: 'list-unstyled',
      loadMore: 'btn btn-primary',
    },
    templates: {
      item: window.$('#hit-template').html(),
      empty: 'No results for <q>{{ query }}</q>. Try another topic.',
    },
  }),
  configure({
    hitsPerPage: 25,
  }),
  sortBy({
    container: '#sort-by',
    items: [
      { label: 'Recent first', value: 's' },
      { label: 'Oldest first', value: 's/sort/release_date:asc' },
    ],
    cssClasses: {
      select: 'custom-select custom-select-sm',
    },
  }),
]);

search.start();

$(function() {
  // Set initial topic, if empty
  if (
    $('input[type=search]')
      .val()
      .trim() === ''
  ) {
    $('input[type=search]').val('Pop');
    search.helper.setQuery($('input[type=search]').val()).search();
  }

  // Handle example topics
  $('#example-topics span[role=button]').on('click', event => {
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

  // Back to top button
  $('#backToTop').on('click', event => {
    $('html, body').animate({ scrollTop: 0 }, 'slow');
    $('input[type=search]').focus();
  });
});
