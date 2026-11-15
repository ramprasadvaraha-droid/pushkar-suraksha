from __future__ import annotations

import hashlib
import hmac
import json
import os
import base64
import binascii
import sqlite3
import urllib.request
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from threading import RLock
from typing import Annotated

import cv2
import faiss
import numpy as np
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

EMBEDDING_DIMENSION = 128
MAX_ENROLL_BYTES = 10 * 1024 * 1024
MAX_QUERY_BYTES = 4 * 1024 * 1024
MAX_CANDIDATES = 100_000
MODEL_REVISION = "48b10fa505aeb51fbd127fc60a5c660040e823b7"
MODEL_SPECS = {
    "yunet.onnx": (
        f"https://media.githubusercontent.com/media/opencv/opencv_zoo/{MODEL_REVISION}/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "sface.onnx": (
        f"https://media.githubusercontent.com/media/opencv/opencv_zoo/{MODEL_REVISION}/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
}


class FaceImageError(ValueError):
    pass


def _download_model(path: Path, url: str, expected_sha256: str) -> None:
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == expected_sha256:
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".download")
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "PushkarSurakshaFaceSearch/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as target:
            while chunk := response.read(1024 * 1024):
                target.write(chunk)
        actual = hashlib.sha256(temporary.read_bytes()).hexdigest()
        if not hmac.compare_digest(actual, expected_sha256):
            raise RuntimeError(f"Downloaded model checksum did not match: {path.name}")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


class FaceEncoder:
    def __init__(self, model_dir: Path) -> None:
        for filename, (url, checksum) in MODEL_SPECS.items():
            _download_model(model_dir / filename, url, checksum)

        self.detector = cv2.FaceDetectorYN.create(
            str(model_dir / "yunet.onnx"), "", (320, 320), 0.8, 0.3, 5000
        )
        self.recognizer = cv2.FaceRecognizerSF.create(str(model_dir / "sface.onnx"), "")

    def encode(self, image_bytes: bytes) -> np.ndarray:
        image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None or image.size == 0:
            raise FaceImageError("Upload a valid JPEG, PNG, or WebP image.")

        height, width = image.shape[:2]
        scale = min(1.0, 1920 / max(height, width))
        if scale < 1:
            image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            height, width = image.shape[:2]

        self.detector.setInputSize((width, height))
        _, faces = self.detector.detect(image)
        if faces is None or len(faces) == 0:
            raise FaceImageError("No clear face was detected. Use a well-lit, front-facing photo.")
        if len(faces) != 1:
            raise FaceImageError("Use a photo with only one visible face.")

        aligned = self.recognizer.alignCrop(image, faces[0])
        feature = self.recognizer.feature(aligned).astype(np.float32).reshape(-1)
        if feature.shape != (EMBEDDING_DIMENSION,) or not np.isfinite(feature).all():
            raise FaceImageError("Could not create a valid face template from this photo.")
        norm = float(np.linalg.norm(feature))
        if norm <= 0:
            raise FaceImageError("Could not create a valid face template from this photo.")
        return feature / norm


class EmbeddingStore:
    def __init__(self, database_path: Path, encryption_key: bytes) -> None:
        if len(encryption_key) != 32:
            raise RuntimeError("FACE_SEARCH_ENCRYPTION_KEY must decode to exactly 32 bytes.")
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = RLock()
        self.cipher = AESGCM(encryption_key)
        self.connection = sqlite3.connect(database_path, check_same_thread=False, timeout=10)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS embeddings (
                member_id TEXT PRIMARY KEY,
                vector_id INTEGER NOT NULL UNIQUE,
                vector BLOB NOT NULL
            )
            """
        )
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value INTEGER NOT NULL)"
        )
        self.connection.execute(
            "INSERT OR IGNORE INTO metadata (key, value) VALUES ('next_vector_id', 1)"
        )
        self.connection.commit()
        self.index: faiss.IndexIDMap2
        self.member_to_vector_id: dict[str, int]
        self.vectors_by_id: dict[str, np.ndarray]
        self._rebuild()

    def _build(self, rows: list[tuple[str, int, bytes]]) -> tuple[
        faiss.IndexIDMap2, dict[str, int], dict[str, np.ndarray]
    ]:
        index = faiss.IndexIDMap2(faiss.IndexFlatIP(EMBEDDING_DIMENSION))
        member_to_vector_id: dict[str, int] = {}
        vectors_by_id: dict[str, np.ndarray] = {}
        if rows:
            vectors = np.stack([
                self._decrypt(member_id, blob) for member_id, _, blob in rows
            ]).astype(np.float32, copy=False)
            vector_ids = np.asarray([vector_id for _, vector_id, _ in rows], dtype=np.int64)
            index.add_with_ids(vectors, vector_ids)
            member_to_vector_id = {member_id: vector_id for member_id, vector_id, _ in rows}
            vectors_by_id = {
                member_id: vectors[position]
                for position, (member_id, _, _) in enumerate(rows)
            }
        return index, member_to_vector_id, vectors_by_id

    def _encrypt(self, member_id: str, vector: np.ndarray) -> bytes:
        nonce = os.urandom(12)
        ciphertext = self.cipher.encrypt(
            nonce, vector.astype("<f4").tobytes(), member_id.encode("ascii")
        )
        return nonce + ciphertext

    def _decrypt(self, member_id: str, encrypted: bytes) -> np.ndarray:
        if len(encrypted) < 29:
            raise RuntimeError(f"Encrypted face template is invalid for member {member_id}.")
        vector = self.cipher.decrypt(
            encrypted[:12], encrypted[12:], member_id.encode("ascii")
        )
        result = np.frombuffer(vector, dtype="<f4").copy()
        if result.shape != (EMBEDDING_DIMENSION,) or not np.isfinite(result).all():
            raise RuntimeError(f"Decrypted face template is invalid for member {member_id}.")
        return result

    def _rebuild(self) -> None:
        rows = self.connection.execute(
            "SELECT member_id, vector_id, vector FROM embeddings ORDER BY vector_id"
        ).fetchall()
        self.index, self.member_to_vector_id, self.vectors_by_id = self._build(rows)

    def upsert(self, member_id: str, vector: np.ndarray) -> None:
        normalized = np.asarray(vector, dtype=np.float32).reshape(-1)
        if normalized.shape != (EMBEDDING_DIMENSION,) or not np.isfinite(normalized).all():
            raise ValueError("Invalid embedding vector.")

        with self.lock:
            try:
                self.connection.execute("BEGIN IMMEDIATE")
                row = self.connection.execute(
                    "SELECT vector_id FROM embeddings WHERE member_id = ?", (member_id,)
                ).fetchone()
                if row:
                    vector_id = int(row[0])
                else:
                    vector_id = int(self.connection.execute(
                        "SELECT value FROM metadata WHERE key = 'next_vector_id'"
                    ).fetchone()[0])
                    self.connection.execute(
                        "UPDATE metadata SET value = ? WHERE key = 'next_vector_id'",
                        (vector_id + 1,),
                    )
                self.connection.execute(
                    """
                    INSERT INTO embeddings (member_id, vector_id, vector) VALUES (?, ?, ?)
                    ON CONFLICT(member_id) DO UPDATE SET vector = excluded.vector
                    """,
                    (member_id, vector_id, self._encrypt(member_id, normalized)),
                )
                rows = self.connection.execute(
                    "SELECT member_id, vector_id, vector FROM embeddings ORDER BY vector_id"
                ).fetchall()
                next_index = self._build(rows)
                self.connection.commit()
            except Exception:
                self.connection.rollback()
                raise
            self.index, self.member_to_vector_id, self.vectors_by_id = next_index

    def delete(self, member_ids: list[str]) -> int:
        if not member_ids:
            return 0
        with self.lock:
            try:
                self.connection.execute("BEGIN IMMEDIATE")
                deleted = 0
                for start in range(0, len(member_ids), 500):
                    batch = member_ids[start : start + 500]
                    placeholders = ",".join("?" for _ in batch)
                    cursor = self.connection.execute(
                        f"DELETE FROM embeddings WHERE member_id IN ({placeholders})", batch
                    )
                    deleted += cursor.rowcount
                rows = self.connection.execute(
                    "SELECT member_id, vector_id, vector FROM embeddings ORDER BY vector_id"
                ).fetchall()
                next_index = self._build(rows)
                self.connection.commit()
            except Exception:
                self.connection.rollback()
                raise
            self.index, self.member_to_vector_id, self.vectors_by_id = next_index
            return deleted

    def search(
        self, vector: np.ndarray, candidate_ids: list[str], limit: int, min_score: float
    ) -> list[dict[str, str | float]]:
        with self.lock:
            members = [member_id for member_id in candidate_ids if member_id in self.vectors_by_id]
            if not members:
                return []
            candidate_index = faiss.IndexFlatIP(EMBEDDING_DIMENSION)
            vectors = np.stack([self.vectors_by_id[member_id] for member_id in members])
            candidate_index.add(vectors)
            query = np.asarray(vector, dtype=np.float32).reshape(1, EMBEDDING_DIMENSION)
            scores, positions = candidate_index.search(query, min(limit, len(members)))

        return [
            {"memberId": members[int(position)], "similarity": float(score)}
            for score, position in zip(scores[0], positions[0], strict=True)
            if position >= 0 and float(score) >= min_score
        ]

    def count(self) -> int:
        with self.lock:
            return int(self.index.ntotal)

    def close(self) -> None:
        with self.lock:
            self.connection.close()


def _api_token() -> str:
    token = os.environ.get("FACE_SEARCH_API_TOKEN", "")
    if len(token) < 32:
        raise RuntimeError("FACE_SEARCH_API_TOKEN must contain at least 32 characters.")
    return token


def _encryption_key() -> bytes:
    encoded = os.environ.get("FACE_SEARCH_ENCRYPTION_KEY", "")
    try:
        key = base64.b64decode(encoded.encode("ascii"), altchars=b"-_", validate=True)
    except (binascii.Error, ValueError, UnicodeEncodeError) as error:
        raise RuntimeError("FACE_SEARCH_ENCRYPTION_KEY must be URL-safe base64.") from error
    if len(key) != 32:
        raise RuntimeError("FACE_SEARCH_ENCRYPTION_KEY must decode to exactly 32 bytes.")
    return key


def _verify_token(credentials: Annotated[
    HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))
]) -> None:
    expected = _api_token()
    supplied = credentials.credentials if credentials else ""
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized.")


class DeleteRequest(BaseModel):
    memberIds: list[str] = Field(max_length=MAX_CANDIDATES)


def _valid_uuid_list(candidate_ids_json: str) -> list[str]:
    try:
        raw_ids = json.loads(candidate_ids_json)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Candidate list is invalid.") from error
    if not isinstance(raw_ids, list) or len(raw_ids) > MAX_CANDIDATES:
        raise HTTPException(status_code=400, detail="Candidate list is invalid.")
    try:
        return list(dict.fromkeys(str(uuid.UUID(item)) for item in raw_ids))
    except (ValueError, TypeError, AttributeError) as error:
        raise HTTPException(status_code=400, detail="Candidate list is invalid.") from error


def _encode_or_422(encoder: FaceEncoder, image_bytes: bytes) -> np.ndarray:
    try:
        return encoder.encode(image_bytes)
    except FaceImageError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@asynccontextmanager
async def lifespan(application: FastAPI):
    _api_token()
    data_dir = Path(os.environ.get("FAISS_DATA_DIR", "./data")).resolve()
    model_dir = Path(os.environ.get("FACE_SEARCH_MODEL_DIR", "./models")).resolve()
    encoder = FaceEncoder(model_dir)
    store = EmbeddingStore(data_dir / "embeddings.sqlite3", _encryption_key())
    application.state.encoder = encoder
    application.state.store = store
    yield
    store.close()


app = FastAPI(
    title="Pushkar Suraksha face search",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)
bearer = Depends(_verify_token)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/enroll/{member_id}", dependencies=[bearer])
async def enroll(member_id: str, request: Request) -> dict[str, str]:
    try:
        normalized_id = str(uuid.UUID(member_id))
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Member ID is invalid.") from error
    if not request.headers.get("content-type", "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Send an image file.")
    image_bytes = bytearray()
    async for chunk in request.stream():
        image_bytes.extend(chunk)
        if len(image_bytes) > MAX_ENROLL_BYTES:
            raise HTTPException(status_code=413, detail="Image exceeds the 10 MB limit.")
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image is empty.")
    vector = await run_in_threadpool(
        _encode_or_422, request.app.state.encoder, bytes(image_bytes)
    )
    await run_in_threadpool(request.app.state.store.upsert, normalized_id, vector)
    return {"status": "indexed"}


@app.post("/v1/search", dependencies=[bearer])
async def search(
    request: Request,
    candidate_ids: Annotated[str, Form()],
    image: Annotated[UploadFile, File()],
) -> dict[str, object]:
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Use a JPEG, PNG, or WebP image.")
    image_bytes = await image.read(MAX_QUERY_BYTES + 1)
    if not image_bytes or len(image_bytes) > MAX_QUERY_BYTES:
        raise HTTPException(status_code=413, detail="Search photo exceeds the 4 MB limit.")
    candidates = _valid_uuid_list(candidate_ids)
    vector = await run_in_threadpool(_encode_or_422, request.app.state.encoder, image_bytes)
    minimum_score = float(os.environ.get("FACE_SEARCH_MIN_COSINE_SCORE", "0.363"))
    matches = await run_in_threadpool(
        request.app.state.store.search, vector, candidates, 5, minimum_score
    )
    return {"matches": matches, "minimumSimilarity": minimum_score}


@app.post("/v1/embeddings/delete", dependencies=[bearer])
async def delete_embeddings(body: DeleteRequest, request: Request) -> dict[str, int]:
    try:
        member_ids = list(dict.fromkeys(str(uuid.UUID(item)) for item in body.memberIds))
    except (ValueError, TypeError, AttributeError) as error:
        raise HTTPException(status_code=400, detail="Member IDs are invalid.") from error
    deleted = await run_in_threadpool(request.app.state.store.delete, member_ids)
    return {"deleted": deleted}


@app.get("/health/ready")
def ready(request: Request) -> dict[str, object]:
    store = getattr(request.app.state, "store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="Service is not ready.")
    return {"status": "ready", "indexedFaces": store.count()}
