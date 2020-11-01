import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { Permutation } from 'js-combinatorics';
import STOP_WORDS from '../../src/utils/stop_words.json';

const TYPESENSE_HOSTS = [
  'fow3nytvs6zejdarp-1.a1.typesense.net',
  'fow3nytvs6zejdarp-2.a1.typesense.net',
  'fow3nytvs6zejdarp-3.a1.typesense.net',
];
const TYPESENSE_API_KEY = 'el0TVwNVbyqEi1SkLV7HNVmptsbzTM6b';
const HEADERS = {
  accept: 'application/json, text/plain, */*',
  'x-typesense-api-key': TYPESENSE_API_KEY,
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36',
  'content-type': 'application/json',
  'accept-encoding': 'gzip, deflate, br',
};
const CHARACTER_SPACE = 'abcdefghijklmnopqrstuvwxyz';
const SEARCH_PHRASE_LENGTH = 3;
const SEARCH_PHRASES = new Permutation(CHARACTER_SPACE, SEARCH_PHRASE_LENGTH);
const NUM_VUS = 15;

export let options = {
  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'p(50)',
    'p(75)',
    'p(90)',
    'p(95)',
    'p(99)',
    'p(100)',
  ],
  scenarios: {
    constant_vus: {
      executor: 'constant-vus',
      vus: NUM_VUS,
      duration: '12h',
    },
  },
};

let timeouts = new Counter('timeouts');
let searchProcessingTimes = new Trend('search_processing_time_ms');

export default function() {
  // Pick search phrase
  const vuOffset = Math.ceil(SEARCH_PHRASES.length / NUM_VUS) * (__VU - 1);
  const searchPhraseIndex = (vuOffset + __ITER) % SEARCH_PHRASES.length;
  let searchPhrase = SEARCH_PHRASES.nth(searchPhraseIndex).join('');

  console.log(
    `VU:${__VU} SEARCH_PHRASES[${searchPhraseIndex}]: ${searchPhrase}`
  );

  // Break the search phrase out into characters to simulate users typing
  const queries = instantSearchQueriesForSearchPhrase(searchPhrase);

  queries
    .filter(query => !STOP_WORDS.includes(query))
    .map(query => {
      group(`query: ${query}`, () => {
        let host = TYPESENSE_HOSTS[__ITER % TYPESENSE_HOSTS.length];
        let url = `https://${host}/collections/s/documents/search?query_by=primary_artist_name,title,album_name&highlight_full_fields=primary_artist_name,title,album_name&facet_by=genres,primary_artist_name,release_group_types,country,release_decade&filter_by=&max_facet_values=20&page=1&per_page=15&q=${encodeURIComponent(
          query
        )}`;
        const response = http.get(url, { headers: HEADERS });
        check(response, { 'status was 200': r => r.status === 200 });

        if (response.status === 200) {
          searchProcessingTimes.add(
            JSON.parse(response.body)['search_time_ms'],
            { query: query }
          );
        }

        if (
          'error' in response &&
          response.error.toLowerCase().indexOf('timeout') !== -1
        ) {
          timeouts.add(1);
        }
      });
    });
}

function instantSearchQueriesForSearchPhrase(searchPhrase) {
  let instantSearchQueries = [];
  for (let i = 0; i < searchPhrase.length; i++) {
    instantSearchQueries.push(searchPhrase.substring(0, i + 1));
  }
  return instantSearchQueries;
}
