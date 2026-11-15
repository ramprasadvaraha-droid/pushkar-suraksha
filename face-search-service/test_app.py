import numpy as np

from app import EMBEDDING_DIMENSION, EmbeddingStore


ENCRYPTION_KEY = b"x" * 32


def _unit_vector(position: int) -> np.ndarray:
    vector = np.zeros(EMBEDDING_DIMENSION, dtype=np.float32)
    vector[position] = 1
    return vector


def test_embeddings_persist_and_search_only_allowed_missing_candidates(tmp_path):
    first_id = "00000000-0000-0000-0000-000000000001"
    second_id = "00000000-0000-0000-0000-000000000002"
    store = EmbeddingStore(tmp_path / "vectors.sqlite3", ENCRYPTION_KEY)
    store.upsert(first_id, _unit_vector(0))
    store.upsert(second_id, _unit_vector(1))

    matches = store.search(_unit_vector(0), [second_id], limit=5, min_score=0.3)
    assert matches == []

    store.close()
    with (tmp_path / "vectors.sqlite3").open("rb") as database:
        assert ENCRYPTION_KEY not in database.read()
    restored = EmbeddingStore(tmp_path / "vectors.sqlite3", ENCRYPTION_KEY)
    matches = restored.search(_unit_vector(0), [first_id, second_id], limit=5, min_score=0.3)
    assert matches == [{"memberId": first_id, "similarity": 1.0}]

    assert restored.delete([first_id]) == 1
    assert restored.search(_unit_vector(0), [first_id], limit=5, min_score=0.3) == []
    restored.close()


def test_reenrollment_replaces_vector_without_duplicate_member(tmp_path):
    member_id = "00000000-0000-0000-0000-000000000001"
    store = EmbeddingStore(tmp_path / "vectors.sqlite3", ENCRYPTION_KEY)
    store.upsert(member_id, _unit_vector(0))
    store.upsert(member_id, _unit_vector(1))

    assert store.count() == 1
    assert store.search(_unit_vector(1), [member_id], limit=1, min_score=0.9) == [
        {"memberId": member_id, "similarity": 1.0}
    ]
    store.close()
