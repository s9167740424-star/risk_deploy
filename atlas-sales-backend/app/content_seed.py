from __future__ import annotations
import json
import re
from pathlib import Path
from app.extensions import db
from app.models import (
    Algorithm,
    AlgorithmStep,
    Document,
    DocumentSource,
    Material,
    SurveySchema,
    UserAlgorithmStep,
    UserDocument,
)
PUBLIC_ROOT = Path(__file__).resolve().parent.parent.parent / "frontend" / "public"
ALGORITHMS_DIR = PUBLIC_ROOT / "algorithms"
ARTICLES_DIR = PUBLIC_ROOT / "articles"
DOCUMENTS_DIR = PUBLIC_ROOT / "documents"
QUESTIONNAIRE_DIR = PUBLIC_ROOT / "questionnaire"

def humanize_id(value: str) -> str:
    text = value.replace("_", " ").strip()
    return text[:1].upper() + text[1:] if text else value

def reset_algorithm_tables():
    db.session.execute(db.delete(UserAlgorithmStep))
    db.session.execute(db.delete(AlgorithmStep))
    db.session.execute(db.delete(Algorithm))
    db.session.commit()

def reset_material_tables():
    db.session.execute(db.delete(Material))
    db.session.commit()

def reset_document_tables():
    db.session.execute(db.delete(UserDocument))
    db.session.execute(db.delete(Document))
    db.session.execute(db.delete(DocumentSource))
    db.session.commit()

def seed_document_sources_from_files() -> int:
    path = DOCUMENTS_DIR / "sources.json"
    if not path.exists():
        return 0
    payload = json.loads(path.read_text(encoding="utf-8"))
    sources = payload.get("sources") if isinstance(payload, dict) else payload
    if not isinstance(sources, list):
        return 0
    db.session.execute(db.delete(DocumentSource))
    count = 0
    for idx, src in enumerate(sources, start=1):
        db.session.add(
            DocumentSource(
                id=src["id"],
                title=src["title"],
                download_header=src.get("downloadHeader") or src.get("download_header") or "",
                sort_order=int(src.get("order") or idx),
            )
        )
        count += 1
    db.session.commit()
    return count

def seed_documents_from_files() -> int:
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(
        p for p in DOCUMENTS_DIR.glob("*.json") if p.name != "sources.json"
    )
    if not files:
        return 0
    db.session.execute(db.delete(UserDocument))
    db.session.execute(db.delete(Document))
    db.session.commit()
    count = 0
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        code = data["code"]
        notes = data.get("note") or data.get("notes") or []
        if isinstance(notes, str):
            notes = [notes]
        conditions = data.get("conditions")
        if conditions == []:
            conditions = None
        db.session.add(
            Document(
                code=code,
                title=data["title"],
                description=(notes[0] if notes else data.get("description")),
                notes_json=notes,
                is_required=bool(data.get("required", data.get("is_required", True))),
                category=data.get("category") or "general",
                obtain_algorithm=notes[1] if len(notes) > 1 else data.get("obtain_algorithm"),
                source_id=data.get("sourceId") or data.get("source_id") or "on_hand",
                algorithm_id=data.get("algorithmId") or data.get("algorithm_id"),
                article_id=data.get("articleId") or data.get("article_id"),
                conditions_json=conditions,
                sort_order=int(data.get("order") or count + 1),
            )
        )
        count += 1
    db.session.commit()
    return count

def seed_survey_from_files() -> int:
    QUESTIONNAIRE_DIR.mkdir(parents=True, exist_ok=True)
    path = QUESTIONNAIRE_DIR / "survey.json"
    if not path.exists():
        return 0
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data.get("steps") if isinstance(data, dict) else data
    if not isinstance(steps, list):
        return 0
    existing = db.session.scalar(
        db.select(SurveySchema).where(SurveySchema.code == "default")
    )
    if existing is None:
        db.session.add(SurveySchema(code="default", steps_json=steps))
    else:
        existing.steps_json = steps
    db.session.commit()
    return len(steps)

def seed_algorithms_from_files() -> int:
    ALGORITHMS_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(ALGORITHMS_DIR.glob("*.json"))
    if not files:
        return 0
    reset_algorithm_tables()
    count = 0
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        code = data["id"]
        algo = Algorithm(
            code=code,
            title=data.get("displayTitle") or data.get("title") or code,
            description=data.get("subtitle") or "",
            category=data.get("groupId") or "general",
            group_code=data.get("groupId") or "general",
            group_title=data.get("groupTitle") or data.get("displayTitle") or code,
            group_order=int(data.get("groupOrder") or 1),
            sort_order=int(data.get("order") or 1),
            toggle_json=data.get("toggle"),
        )
        db.session.add(algo)
        db.session.flush()
        for pos, step in enumerate(data.get("steps") or [], start=1):
            db.session.add(
                AlgorithmStep(
                    algorithm_id=algo.id,
                    code=step["id"],
                    position=pos,
                    title=step.get("text") or step.get("title") or step["id"],
                    description=step.get("description"),
                    is_sub_step=bool(step.get("isSubStep")),
                    link_json=step.get("link"),
                )
            )
        count += 1
    db.session.commit()
    return count

def _extract_docx_text(path: Path) -> str:
    try:
        import mammoth
        result = mammoth.extract_raw_text(str(path))
        return (result.value or "").strip()
    except Exception:
        return ""

def _read_article_meta(docx_path: Path) -> dict:
    meta_path = docx_path.with_suffix(".meta.json")
    if not meta_path.exists():
        return {}
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return {}

def seed_articles_from_docx() -> int:
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(ARTICLES_DIR.glob("*.docx"))
    if not files:
        return 0
    reset_material_tables()
    count = 0
    for path in files:
        stem = path.stem
        slug = re.sub(r"\s+", "_", stem).strip() or f"article-{count + 1}"
        meta = _read_article_meta(path)
        text = _extract_docx_text(path)
        material = Material(
            slug=slug,
            title=meta.get("title") or humanize_id(stem),
            summary=meta.get("description") or meta.get("summary") or "",
            content=text or meta.get("title") or stem,
            category=meta.get("category") or "general",
            keywords=meta.get("keywords") or "",
            source_note=meta.get("source_note") or "Документ загружен из public/articles",
            file_name=path.name,
            key_points_json=meta.get("keyPoints") or meta.get("key_points") or [],
        )
        db.session.add(material)
        count += 1
    db.session.commit()
    return count

def seed_content() -> dict:
    return {
        "algorithms": seed_algorithms_from_files(),
        "articles": seed_articles_from_docx(),
        "document_sources": seed_document_sources_from_files(),
        "documents": seed_documents_from_files(),
        "survey_steps": seed_survey_from_files(),
    }
