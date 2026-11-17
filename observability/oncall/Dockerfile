FROM python:3.12-alpine
WORKDIR /srv
COPY responder.py ./responder.py
# Persist alert fingerprints across restarts and avoid running as root.
RUN mkdir -p /data && chown 65534:65534 /data
USER 65534:65534
EXPOSE 8080
CMD ["python", "responder.py"]
