"""
Critterboard Presidio Guard-Rails Service

Exposes Presidio analyzer + anonymizer over a minimal FastAPI interface so that
the Cloudflare Worker and the React Native client can call a single REST endpoint
for richer PII detection and redaction without bundling a Python runtime.

Endpoints:
  GET  /health     — liveness probe
  POST /analyze    — detect PII entities in text, returns a list of hits
  POST /anonymize  — detect + replace PII in text, returns scrubbed text

Run locally:
  pip install -r requirements.txt
  python -m spacy download en_core_web_lg
  uvicorn app:app --reload --port 8000

Or via Docker:
  docker compose up
"""

from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from presidio_analyzer import AnalyzerEngine, RecognizerResult
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Globals — initialised in the lifespan context so startup errors surface cleanly
# ---------------------------------------------------------------------------

_analyzer: Optional[AnalyzerEngine] = None
_anonymizer: Optional[AnonymizerEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _analyzer, _anonymizer
    _analyzer = AnalyzerEngine()
    _anonymizer = AnonymizerEngine()
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Critterboard Presidio Guard-Rails",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Default entity sets
# ---------------------------------------------------------------------------

# Entities that are always suspect in user-generated INPUT to an LLM
INPUT_PII_ENTITIES = [
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "CREDIT_CARD",
    "IBAN_CODE",
    "US_SSN",
    "US_DRIVER_LICENSE",
    "US_PASSPORT",
    "IP_ADDRESS",
    "MEDICAL_LICENSE",
]

# Broader set for redacting LLM OUTPUT
OUTPUT_PII_ENTITIES = INPUT_PII_ENTITIES + [
    "PERSON",
    "LOCATION",
    "DATE_TIME",
    "URL",
    "NRP",
]

# Token substitutions applied when anonymizing
_OPERATOR_MAP = {
    "DEFAULT":          OperatorConfig("replace", {"new_value": "[redacted]"}),
    "EMAIL_ADDRESS":    OperatorConfig("replace", {"new_value": "[email]"}),
    "PHONE_NUMBER":     OperatorConfig("replace", {"new_value": "[phone]"}),
    "CREDIT_CARD":      OperatorConfig("replace", {"new_value": "[credit_card]"}),
    "IBAN_CODE":        OperatorConfig("replace", {"new_value": "[iban]"}),
    "US_SSN":           OperatorConfig("replace", {"new_value": "[ssn]"}),
    "US_DRIVER_LICENSE": OperatorConfig("replace", {"new_value": "[id_number]"}),
    "US_PASSPORT":      OperatorConfig("replace", {"new_value": "[passport]"}),
    "IP_ADDRESS":       OperatorConfig("replace", {"new_value": "[ip_address]"}),
    "MEDICAL_LICENSE":  OperatorConfig("replace", {"new_value": "[medical_id]"}),
    "PERSON":           OperatorConfig("replace", {"new_value": "[name]"}),
    "LOCATION":         OperatorConfig("replace", {"new_value": "[location]"}),
    "URL":              OperatorConfig("replace", {"new_value": "[url]"}),
}

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    text: str
    language: str = "en"
    entities: Optional[List[str]] = None
    score_threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class EntityHit(BaseModel):
    entity_type: str
    start: int
    end: int
    score: float
    text: str


class AnonymizeRequest(BaseModel):
    text: str
    language: str = "en"
    entities: Optional[List[str]] = None
    score_threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class AnonymizeResponse(BaseModel):
    text: str
    entities_found: List[str]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "analyzer": _analyzer is not None,
        "anonymizer": _anonymizer is not None,
    }


@app.post("/analyze", response_model=List[EntityHit])
async def analyze(req: AnalyzeRequest):
    if _analyzer is None:
        raise HTTPException(status_code=503, detail="Analyzer not initialised")

    entities = req.entities if req.entities is not None else INPUT_PII_ENTITIES
    results: list[RecognizerResult] = _analyzer.analyze(
        text=req.text,
        language=req.language,
        entities=entities,
        score_threshold=req.score_threshold,
    )
    return [
        EntityHit(
            entity_type=r.entity_type,
            start=r.start,
            end=r.end,
            score=r.score,
            text=req.text[r.start : r.end],
        )
        for r in results
    ]


@app.post("/anonymize", response_model=AnonymizeResponse)
async def anonymize(req: AnonymizeRequest):
    if _analyzer is None or _anonymizer is None:
        raise HTTPException(status_code=503, detail="Service not initialised")

    entities = req.entities if req.entities is not None else OUTPUT_PII_ENTITIES
    results = _analyzer.analyze(
        text=req.text,
        language=req.language,
        entities=entities,
        score_threshold=req.score_threshold,
    )

    if not results:
        return AnonymizeResponse(text=req.text, entities_found=[])

    anonymized = _anonymizer.anonymize(
        text=req.text,
        analyzer_results=results,
        operators=_OPERATOR_MAP,
    )
    entities_found = sorted(set(r.entity_type for r in results))
    return AnonymizeResponse(text=anonymized.text, entities_found=entities_found)
