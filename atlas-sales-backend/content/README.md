Контент редактируется в `frontend/public/` и заливается в БД:

  flask seed-content
  flask seed-demo

| Что | Файлы |
|-----|-------|
| Алгоритмы | `frontend/public/algorithms/*.json` |
| Документы | `frontend/public/documents/*.json` |
| Источники документов | `frontend/public/documents/sources.json` |
| Анкета | `frontend/public/questionnaire/survey.json` |
| Материалы | `frontend/public/articles/*.docx` |
| Подсказки | `frontend/public/hints/hints.json` (без сида в БД, читает фронтенд; поля `link` ведут на статью `helpful` или алгоритм `algorithm`) |


Общая инструкция: `../../README.md`.
