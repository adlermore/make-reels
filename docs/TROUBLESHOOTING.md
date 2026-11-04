# Устранение проблем

| Симптом | Причина | Решение |
|---|---|---|
| `Agent type 'trend-researcher' not found`, или `/create-reel` не виден | Агенты и скиллы загружаются при старте сессии | Перезапусти Claude Code в папке проекта и проверь `/agents` |
| `Cannot run voice: approval-a is not approved` | Гейт A не записан | Покажи материалы, получи «да», затем `npm run reel -- approve <id> a --note "…"` |
| `Piper unavailable … Falling back to Windows SAPI` | Нет `.venv` или голоса | `npm run setup:voice`, затем `npm run reel -- doctor` |
| `narration too long / too short` | Число слов не соответствует длительности | Сократи или дополни сценарий (≈ 2,3 слова в секунду) |
| `script length is off … speed limited` | Голос не помещается в допустимый темп (ускорение до ~14%, замедление не дальше естественного) | Отредактируй сценарий |
| Неверное ударение | Особенность TTS | Поле `pronunciation` в сцене: знак U+0301 после ударной гласной (`за́мок`) или `[[фонемы]]`, затем `voice --force`. Не используй `+`: он читается как «плюс» |
| `Missing assets: s03: assets/illustrations/x.svg` | Иллюстрацию запросили, но не нарисовали | Поручи asset-producer или убери `illustration` из сцены |
| `Schema validation failed for …shot-list.json` | Опечатка в поле или значении | Сверь с `templates/shot-list.example.json` и `src/types/schemas.ts` |
| Рендер падает на шрифтах | Нет интернета (шрифты Google загружаются при рендере) | Подключись к сети. Для работы офлайн можно перейти на локальные woff2-файлы |
| `EBUSY` / `EPERM` при рендере, медленная работа | Синхронизация OneDrive | Перенеси проект из OneDrive (например, в `C:\dev\make-reels`) и запусти `npm install` |
| QC `A1 Integrated loudness` не прошёл | Изменили файлы микса вручную | `npm run reel -- mix <id> --force`, затем перерендер |
| QC `PENDING_REVIEW` | Агент-рецензент не оценил этот рендер | Запусти скилл `/quality-check` |
| Текст вылезает за край или наезжает на субтитры | Слишком длинный заголовок | Заголовок ≤ 60 символов или `maxLines`. Проверь `frames` |
| `No offline Armenian voice available` | Не скачан голос hy_AM | `npm run setup:voice -- hy_AM-gor-medium` или `voice.engine: "recorded"` |
| `«եւ» → «և»`, `Latin «?»`, `mixed alphabets` | Ошибки армянской орфографии в тексте | Исправьте по `.claude/skills/armenian-language-expert/reference/reels-style-guide.md` и перезапустите `validate` |
| Армянские буквы отображаются квадратами | Нет интернета при рендере (шрифты Google) | Подключитесь к сети |
| Studio не видит файлы проекта | Studio запущен без public-dir | `npm run reel -- studio <id>` вместо `npm run studio` |

## Диагностика
```bash
npm run reel -- doctor           # окружение
npm run reel -- status <id>      # где остановилось производство и почему
npm run typecheck && npm test    # целостность кода
```
История задач хранится в `data/studio.db`, таблица `jobs`. Последние 50 записей есть в `projects/<id>/production-state.json`.
