#!/bin/sh
# web:     apply migrations, then serve the app with gunicorn on port 8000
# cleanup: delete expired exams, outputs and sessions every few minutes
# other:   run the given command (e.g. "python manage.py shell")
set -eu

case "${1:-web}" in
  web)
    python manage.py migrate --noinput
    exec gunicorn pdfnum.wsgi \
      --bind 0.0.0.0:8000 \
      --worker-class gthread \
      --workers "${GUNICORN_WORKERS:-2}" \
      --threads "${GUNICORN_THREADS:-8}" \
      --timeout "${GUNICORN_TIMEOUT:-120}" \
      --graceful-timeout 60 \
      --access-logfile -
    ;;
  cleanup)
    while true; do
      python manage.py cleanup || echo "cleanup failed; retrying in the next round" >&2
      sleep "${PDFNUM_CLEANUP_INTERVAL:-300}"
    done
    ;;
  *)
    exec "$@"
    ;;
esac
