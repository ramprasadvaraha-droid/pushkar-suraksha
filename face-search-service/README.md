# Face search service

This private Python 3.12 service creates normalized 128-dimensional SFace vectors and searches them with FAISS CPU. It accepts only service-to-service requests from the Next.js server. It never stores source/query images. Enrolled vectors and member UUIDs are stored in SQLite with AES-GCM encryption; the FAISS index is rebuilt in memory from the encrypted database at startup.

## Local development (Windows PowerShell)

From the repository root:

```powershell
py -3.12 -m venv face-search-service\.venv
& .\face-search-service\.venv\Scripts\python.exe -m pip install -r .\face-search-service\requirements-dev.txt
```

Generate two different secrets and keep them in a password manager:

```powershell
& .\face-search-service\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
& .\face-search-service\.venv\Scripts\python.exe -c "import base64, secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

Set the first output as both `FACE_SEARCH_API_TOKEN` for this service and `FACE_SEARCH_SERVICE_TOKEN` in the Next.js server environment. Set the second output as `FACE_SEARCH_ENCRYPTION_KEY` for the Python service only. Do not commit any of these values.

Start the service:

```powershell
$env:FACE_SEARCH_API_TOKEN = "YOUR_SERVICE_TOKEN"
$env:FACE_SEARCH_ENCRYPTION_KEY = "YOUR_URL_SAFE_BASE64_32_BYTE_KEY"
$env:FAISS_DATA_DIR = ".\face-search-service\data"
$env:FACE_SEARCH_MODEL_DIR = ".\face-search-service\models"
& .\face-search-service\.venv\Scripts\python.exe -m uvicorn app:app --app-dir .\face-search-service --host 127.0.0.1 --port 8080
```

The first start downloads the two pinned OpenCV Zoo ONNX models (about 39 MB total) and verifies their SHA-256 digests. Set `FACE_SEARCH_SERVICE_URL=http://127.0.0.1:8080` and the same token in the Next.js environment, then restart Next.js. The registration API intentionally refuses new registrations if the face-search service is not configured.

Run unit tests:

```powershell
& .\face-search-service\.venv\Scripts\python.exe -m pytest .\face-search-service
```

## Deployment

Build `face-search-service\Dockerfile` on a Linux container platform and mount a **private, encrypted, persistent volume** at `/data`. Configure `FACE_SEARCH_API_TOKEN` and `FACE_SEARCH_ENCRYPTION_KEY` as secret environment variables. Keep `/data` across restarts and backups. Losing the encryption key makes stored templates unrecoverable; back up the key separately and restrict access. Never run multiple independent replicas against separate volumes: each would have only part of the index. Use one replica unless a shared, coordinated index is implemented.

Expose the service over HTTPS. Put it behind the hosting provider's network controls where available. In Vercel, set server-only `FACE_SEARCH_SERVICE_URL` and `FACE_SEARCH_SERVICE_TOKEN`; never add a `NEXT_PUBLIC_` prefix. The Python service token must match the Vercel token exactly.

## Data and safeguards

- Migration `migrations/008_face_search_consent.sql` is required. New family registration requires an explicit adult/guardian consent checkbox. Existing rows default to no consent and are never backfilled or indexed.
- Only `face_front` photos from a consented registration are embedded. Query candidates are rechecked against current consent, active missing status, and non-expired face photos before results are returned.
- Search is available only through the Next.js API after organizer approval. Requests are limited to 10 per volunteer per minute. The app records the volunteer, time, and result count for 90 days; it does not log or persist the query photo.
- Deleting a family's photos disables face search and removes its vectors. The daily cleanup job retries any queued vector deletion and removes vectors when their face photos expire.
- Search returns at most five candidates over a configurable cosine-similarity threshold (`FACE_SEARCH_MIN_COSINE_SCORE`, default `0.363`). This score is not a probability or proof of identity. Calibrate it on appropriate, consented examples before operational use. Guardian-secret verification or the in-person organizer fallback, followed by physical handover confirmation, remains mandatory.
- The embedding database is encrypted at rest; source photos stay in the existing private object store. The query image is sent transiently to the service and released after the request.

The YuNet model is from OpenCV Zoo at pinned revision [`48b10fa`](https://github.com/opencv/opencv_zoo/tree/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_detection_yunet) (MIT). The SFace model is from the same revision's [face-recognition model directory](https://github.com/opencv/opencv_zoo/tree/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_recognition_sface) (Apache-2.0). FAISS is [MIT licensed](https://github.com/facebookresearch/faiss/blob/main/LICENSE). Model checksums are pinned in `app.py`; review upstream licenses and model terms before deployment.
