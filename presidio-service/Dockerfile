FROM python:3.11-slim

WORKDIR /app

# Install system deps required by some spaCy tokenizers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the English NLP model used by Presidio's NER recogniser.
# Swap en_core_web_lg → en_core_web_sm for a faster (less accurate) build.
RUN python -m spacy download en_core_web_lg

COPY app.py .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
