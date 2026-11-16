"""Opt-in OpenTelemetry telemetry with no user IDs or request bodies in labels."""
import logging
import os
from functools import lru_cache

from opentelemetry import metrics, trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def instruments():
    meter = metrics.get_meter('devatlas.business')
    return {
        'quiz': meter.create_counter('devatlas.quiz.submissions', unit='1', description='Submitted quizzes'),
        'quiz_pass': meter.create_counter('devatlas.quiz.passes', unit='1', description='Successful quiz attempts'),
        'progress': meter.create_counter('devatlas.progress.changes', unit='1', description='Learning progress updates'),
        'auth': meter.create_counter('devatlas.auth.attempts', unit='1', description='Authentication attempts'),
    }


def record(name: str, **attributes: str):
    """Only pass low-cardinality, non-personal attributes."""
    if os.getenv('DEVATLAS_OTEL_ENABLED', '').lower() not in ('1', 'true', 'yes'):
        return
    try:
        instruments()[name].add(1, attributes)
    except Exception:
        logger.exception('OpenTelemetry metric recording failed')


def configure(app):
    if os.getenv('DEVATLAS_OTEL_ENABLED', '').lower() not in ('1', 'true', 'yes'):
        return
    endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318').rstrip('/')
    if not endpoint.startswith(('http://', 'https://')):
        raise ValueError('Invalid OTEL_EXPORTER_OTLP_ENDPOINT')
    resource = Resource.create({
        'service.name': 'devatlas-api',
        'deployment.environment.name': os.getenv('DEVATLAS_ENVIRONMENT', 'development'),
        'service.version': os.getenv('DEVATLAS_RELEASE', 'local'),
    })
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=f'{endpoint}/v1/traces')))
    trace.set_tracer_provider(tracer_provider)
    metric_reader = PeriodicExportingMetricReader(OTLPMetricExporter(endpoint=f'{endpoint}/v1/metrics'), export_interval_millis=15000)
    metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[metric_reader]))
    log_provider = LoggerProvider(resource=resource)
    log_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter(endpoint=f'{endpoint}/v1/logs')))
    handler = LoggingHandler(level=logging.WARNING, logger_provider=log_provider)
    # WARNING+ only: avoid request bodies, tokens, cookies, PII and noisy INFO logs.
    logging.getLogger('devatlas').addHandler(handler)
    FastAPIInstrumentor.instrument_app(
        app,
        excluded_urls='/api/v1/health',
        exclude_spans=['receive', 'send'],
    )
