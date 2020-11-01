# How-to benchmark

We use k6 to run benchmarks.

```
brew install k6 grafana influxdb
```

Create DB to store metrics:

```
influxdb
> CREATE DATABASE k6
```

Import [this dashboard](https://grafana.com/grafana/dashboards/2587) into Grafana, add a new panel to track the metric `search_processing_time_ms`.

Now run k6:

```
yarn
yarn run benchmark
```

View queries that take a long time to process:

```
influxdb
> use k6
> select MEAN(value) from search_processing_time_ms WHERE value > 50 GROUP BY "query"
```
