FROM python:3.12-alpine
WORKDIR /srv
COPY responder.py ./responder.py
USER 65534:65534
EXPOSE 8080
CMD ["python", "responder.py"]
