// Package observability defines the Prometheus metrics the API exposes.
//
// These metrics are scraped by Prometheus in Phase 5. Every counter/histogram
// here becomes a queryable time series you can graph in Grafana and alert on in
// Alertmanager. We keep label cardinality LOW on purpose (method, route
// template, status) — high-cardinality labels (like raw user IDs) would blow up
// Prometheus memory.
package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTPRequestsTotal counts every HTTP request the API handles.
	// In Grafana you'll compute error rate as:
	//   sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests processed, labeled by method, route and status.",
		},
		[]string{"method", "route", "status"},
	)

	// HTTPRequestDuration records how long each request takes.
	// Histograms let Prometheus compute percentiles, e.g. p99 latency:
	//   histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route"},
	)
)
