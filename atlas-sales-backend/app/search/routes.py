from __future__ import annotations

import re
import unicodedata

from flask import Blueprint, request
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import Algorithm, Material

bp = Blueprint("search", __name__, url_prefix="/api/search")


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.lower().replace("ё", "е")
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(text: str) -> list[str]:
    return [t for t in _normalize(text).split(" ") if len(t) >= 2]


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if abs(len(a) - len(b)) > max(2, len(a) // 3):
        return max(len(a), len(b))
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            cur.append(min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1]


def _token_similarity(query: str, candidate: str) -> float:
    if not query or not candidate:
        return 0.0
    if query == candidate:
        return 1.0
    if query in candidate or candidate in query:
        shorter = min(len(query), len(candidate))
        longer = max(len(query), len(candidate))
        return 0.85 + 0.15 * (shorter / longer)
    dist = _levenshtein(query, candidate)
    maxlen = max(len(query), len(candidate))
    sim = 1.0 - dist / maxlen
    return sim if sim >= 0.65 else 0.0


def _score_doc(query_tokens: list[str], title: str, body: str) -> float:
    if not query_tokens:
        return 0.0
    title_tokens = _tokens(title)
    body_tokens = _tokens(body)
    if not title_tokens and not body_tokens:
        return 0.0

    total = 0.0
    for qt in query_tokens:
        best_title = max((_token_similarity(qt, t) for t in title_tokens), default=0.0)
        best_body = max((_token_similarity(qt, t) for t in body_tokens), default=0.0)
        best = max(best_title * 1.8, best_body)
        if best < 0.65:
            return 0.0
        total += best
    score = total / len(query_tokens)

    phrase = " ".join(query_tokens)
    title_n = _normalize(title)
    body_n = _normalize(body)
    if phrase and (phrase in title_n or phrase in body_n):
        score += 0.35
    return score


def _build_corpus() -> list[dict]:
    items: list[dict] = []

    materials = db.session.scalars(db.select(Material).order_by(Material.id)).all()
    for m in materials:
        body = " ".join(
            filter(
                None,
                [m.summary or "", m.content or "", m.keywords or "", m.slug or ""],
            )
        )
        items.append(
            {
                "type": "article",
                "id": m.slug,
                "title": m.title,
                "subtitle": (m.summary or "")[:160],
                "text": body,
            }
        )

    algorithms = db.session.scalars(
        db.select(Algorithm)
        .options(joinedload(Algorithm.steps))
        .order_by(Algorithm.group_order, Algorithm.sort_order, Algorithm.id)
    ).unique().all()

    for algo in algorithms:
        step_parts = []
        for step in algo.steps:
            step_parts.append(step.title or "")
            if step.description:
                step_parts.append(step.description)
        body = " ".join(
            filter(
                None,
                [algo.description or "", algo.group_title or "", " ".join(step_parts)],
            )
        )
        items.append(
            {
                "type": "algorithm",
                "id": algo.code,
                "title": algo.title,
                "subtitle": (algo.description or algo.group_title or "")[:160],
                "text": body,
            }
        )

    return items


@bp.get("/corpus")
def search_corpus():
    return {"items": _build_corpus()}


@bp.get("")
def search():
    q = str(request.args.get("q", "")).strip()
    if len(q) < 2:
        return {"items": [], "query": q}

    query_tokens = _tokens(q)
    if not query_tokens:
        return {"items": [], "query": q}

    scored = []
    for doc in _build_corpus():
        score = _score_doc(query_tokens, doc["title"], doc["text"])
        if score <= 0:
            continue
        scored.append(
            {
                "type": doc["type"],
                "id": doc["id"],
                "title": doc["title"],
                "subtitle": doc["subtitle"],
                "score": round(score, 4),
            }
        )

    scored.sort(key=lambda x: (-x["score"], x["title"]))
    return {"items": scored[:20], "query": q}
