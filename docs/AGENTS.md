# Команда агентов

Все агенты лежат в `.claude/agents/`. Claude Code подгружает их **при старте сессии**: после правки файлов агентов перезапусти Claude Code и проверь их командой `/agents`.

| # | Агент | Роль | Инструменты | Вход → Выход | Проверка |
|---|---|---|---|---|---|
| 01 | `trend-researcher` | Исследование рынка, аудитории, хуков | Read, Write, Glob, Grep, WebSearch, WebFetch | brief, references → `research/research-report.md` | `validate research` (секции, источники) |
| 02 | `creative-director` | Визуальный язык, палитра, движение, звук | Read, Write, Glob, Grep | brief, research, brand → `creative/creative-direction.md` | `validate creative` |
| 03 | `scriptwriter` | Сценарий с таймингом, хук, CTA | Read, Write, Edit, Glob, Bash | → `script/script.md`, `script.json` | `validate script` (длина речи ↔ длительность) |
| 04 | `storyboard-director` | Раскадровка и shot list для движка | Read, Write, Edit, Glob, Bash | → `storyboard/storyboard.md`, `shot-list.json` | `validate storyboard` |
| 05 | `asset-producer` | SVG-иллюстрации, свои материалы, каталог | Read, Write, Edit, Glob, Bash | запросы раскадровки → `assets/illustrations/*.svg` | линтер SVG и наличие файлов |
| 06 | `motion-designer` | Remotion-компоненты, таймлайн, кадры | Read, Write, Edit, Glob, Grep, Bash | → `timeline.json`, кадры, превью | typecheck и осмотр кадров |
| 07 | `sound-designer` | Голос, музыка, SFX, сведение | Read, Write, Edit, Glob, Bash | → `audio/**`, `sound-design-plan.md` | `mix-report.json` (LUFS/TP) |
| 08 | `quality-controller` | Независимый QC | Read, Write, Glob, Grep, Bash | рендер, кадры → `reports/qc-review.json` | рубрика на 100 баллов |

## Как разделены обязанности
- Слова пишет только scriptwriter. Вид и движение определяют creative-director (правила) и motion-designer (реализация).
- Что показать в каждой сцене решает storyboard-director. Как это нарисовать решает asset-producer.
- QC ничего не исправляет: он находит проблемы и отправляет их ответственному агенту.

## Язык
Все агенты пишут рабочие документы и тексты ролика на языке брифа. По умолчанию это профессиональный восточноармянский (`.claude/skills/armenian-language-expert/reference/reels-style-guide.md`, плюс скилл `armenian-language`, если он установлен). Итоговое сообщение оркестратору может быть на русском или английском.

## Армянские скиллы (проектные, `.claude/skills/`)
| Скилл | Для чего | Где подключён |
|---|---|---|
| `armenian-language-expert` | Армянский для роликов: стайлгайд, глоссарий, правила озвучки | Предзагружен во всех 8 агентах (`skills:` во frontmatter) |
| `armenian-grammar-expert` | Грамматика и редактура: падежи, артикли, согласование, пунктуация, кальки | scriptwriter, quality-controller |
| `armenian-translation-expert` | Перевод и транскреация с русского, английского и других языков | Вызывается по запросу |
| `armenian-ui-localization` | Локализация сайтов и приложений: ключи, плейсхолдеры, ICU-плюралы, UI-терминология | Вызывается по запросу; проверка `npm run lint:hy-strings -- src.json hy.json` |

Готовых публичных скиллов с такими названиями нет (поиск 2026-11-04), поэтому они созданы в проекте на общих правилах (`armenian-language-expert/reference/`).

## Формат ответа каждого агента
```
STATUS: done | blocked | needs-user-input
FILES: …
VALIDATION: строки ✔/⚠/✖ из CLI
SUMMARY: 3–6 пунктов
OPEN QUESTIONS / RISKS: …
```

## Модель
У всех агентов стоит `model: inherit`, то есть та же модель, что в главной сессии. Сменить её можно в frontmatter конкретного агента (`sonnet`, `opus`, `haiku`). Например, исследователю можно поставить `sonnet`, чтобы тратить меньше лимита подписки.

## Настройка агента
Правь markdown-файл агента: роль, правила и формат выхода. Если меняешь формат выходного файла, обнови схему (`src/types/schemas.ts`) и валидатор (`pipeline/commands/validate.ts`).
