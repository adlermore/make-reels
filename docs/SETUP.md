# Установка и первый запуск

Всё бесплатно, работает локально, API-ключи не нужны.

## 0. Другой компьютер: клонировать и продолжить
```bash
git clone https://github.com/adlermore/make-reels.git
cd make-reels
npm install
npm run bootstrap        # голоса Piper (.venv + tools/), проверка окружения, восстановление состояния
claude                   # затем в Claude Code: «Продолжи по PROGRESS.md»
```
Если репозиторий уже есть, достаточно `git pull`, затем `npm install`.

**Что лежит в git, а что пересоздаётся:**
- **В git** код, агенты, скиллы, бренды и все текстовые файлы проектов: бриф, исследование, концепция, сценарий, раскадровка, SVG, `timeline.json`, отчёты. Там же JSON-зеркала состояния (`production-state.json`, `asset-manifest.json`, `production-cost-report.json`).
- **Не в git:** `node_modules`, `.venv`, голосовые модели, `data/studio.db`, аудио и видео.
- **База `data/studio.db` восстанавливается автоматически** из JSON-зеркал при первом запуске CLI. Вручную: `npm run reel -- sync-state`.
- **Утверждения A–D сохраняются.** Аудио и видео пересоздаются командами `produce`: этап пропускается, только если его файлы реально существуют. Музыка и SFX детерминированы. Голос Piper может отличаться по длительности на доли секунды, после этого QC нужно перезапустить.
- Перед уходом с компьютера: `git add -A && git commit && git push`. Если два компьютера работают параллельно, синхронизируйтесь через `git pull` до начала работы.

## 1. Требования
- Windows 10/11 (на macOS/Linux тоже работает, но без SAPI-голоса)
- Node.js ≥ 22.13 (нужен встроенный `node:sqlite`; проверено на 22.23)
- FFmpeg + FFprobe в PATH. Установка: `winget install Gyan.FFmpeg`
- Python 3.10+ (только для голоса Piper; ставится в локальный `.venv`)

## 2. Установка
```bash
npm install
npm run setup:voice          # .venv + piper-tts + голоса hy_AM-gor-medium, ru_RU-dmitri-medium, ru_RU-irina-medium (~190 МБ)
npm run reel -- doctor       # всё должно быть ✔
npm test                     # 10 автотестов
```
Другие голоса: `npm run setup:voice -- ru_RU-denis-medium`.

## 3. Первый ролик
1. Перезапусти Claude Code в папке проекта: новые агенты и скиллы подгружаются при старте сессии. Проверь их командами `/agents` и `/create-reel`.
2. Набери `/create-reel` и ответь на вопросы брифа.
3. Утверждай этапы A, B, C и D в чате. После этапа D готовый `final.mp4` лежит в `projects/<id>/renders/`.

Без агентов, вручную:
```bash
npm run reel -- init my-reel --topic "Тема"
# заполни projects/my-reel/brief/brief.md, напиши script.json и shot-list.json (образец: templates/shot-list.example.json)
npm run reel -- brief my-reel
npm run reel -- validate my-reel
npm run reel -- approve my-reel a --note "ok"
npm run reel -- produce my-reel assets
npm run reel -- approve my-reel b --note "ok"
npm run reel -- produce my-reel preview
npm run reel -- approve my-reel c --note "ok"
npm run reel -- produce my-reel final
```

## 3a. Язык роликов
По умолчанию ролики делаются на **восточноармянском** языке в реформированной орфографии (`LANGUAGE: Armenian (Eastern)` в брифе). Также поддерживаются `Russian` и `English`.
- Агенты пишут рабочие документы (исследование, концепцию, сценарий, раскадровку, план звука, QC-рецензию, publish-kit) на языке брифа. Правила армянского текста: `.claude/skills/armenian-language-expert/reference/reels-style-guide.md`.
- `validate` проверяет армянский текст: «և» вместо «եւ», «։» вместо «.», «՞» вместо «?», смешение алфавитов, латиница в озвучке.
- Движок применяет языковую типографику, формат чисел `hy-AM` (1 234,5) и подписи интерфейса (Մինչև/Հետո, Հետևել, « »).
- Офлайн-голос для армянского только мужской (hy_AM-gor). Для женского голоса используйте `recorded`.

## 4. Настройка бренда
Скопируй `brands/default` в `brands/<my-brand>` и заполни `brand-config.json` по шаблону `brands/_template/brand-brief.md`:
- `colors`: primary, secondary, accent, background, text, textMuted
- `typography`: headingFont и bodyFont. Доступны Manrope, Unbounded, Inter, Montserrat, GolosText, Onest (латиница и кириллица), а также NotoSansArmenian и GoogleSans (армянский). К любому шрифту автоматически подключается Noto Sans Armenian для армянских букв
- `captions`: шрифт, размер (≥ 48), цвета, положение, слов на экране; `highlightStyle` (`pill` — произносимое слово на плашке, `color` — цветом); `hideWhenOnScreen` — скрывать субтитр, если он повторяет заголовок на экране
- `motion`: стиль (calm, dynamic, punchy), переход по умолчанию, зерно, виньетка
- `voice`, `music`, `visual`, `safeZone` (необязательно)

Каждый проект делает **снимок** бренда в `projects/<id>/brand/`, так что правки бренда не задевают старые проекты. Бренды и аккаунты Instagram не смешиваются: один бренд соответствует одной папке.

## 5. Настройка голоса
В `brand-config.json` → `voice`:
- `engine`: `piper` (основной), `windows-sapi` (резерв) или `recorded` (твой голос)
- `piperVoiceByLanguage`: голос для каждого языка, по умолчанию `hy` → `hy_AM-gor-medium` (мужской), `ru` → `ru_RU-dmitri-medium` (также есть женский `ru_RU-irina-medium`)
- `lengthScale`: темп речи, где 1.0 обычный, а 0.9 быстрее
- `scenePauseSec`: пауза между сценами

Если голос неправильно ставит ударение, добавь в `script.json` у нужной сцены поле `"pronunciation"`. Проверенные способы (2026-11-04):
- знак ударения U+0301 **после** ударной гласной: `за́мок` или `замо́к`;
- фонетическое написание: `ИИ` → `И-И`, англицизмы кириллицей;
- сырые фонемы espeak в двойных скобках: `[[ zˈamək ]]`.

Знак `+` **не работает**: Piper прочитает его как «плюс».

**Свой голос** (самый чистый вариант по правам): поставь `"engine": "recorded"` и положи запись каждой сцены в `projects/<id>/audio/voice/recorded/s01.wav`, `s02.wav` и так далее. Тишина по краям обрежется автоматически.

## Лицензии голосов
Проверено по model card 2026-11-04.

| Голос | Датасет | Базовая модель | Коммерческое использование |
|---|---|---|---|
| **hy_AM-gor-medium** (армянский) | GPL-2.0 (davit312/piper-TTS-Armenian) | дообучен с en_US-bryce (public domain) | ✅ исследовательских ограничений нет; датасет под GPL-2.0, при сомнениях проконсультируйтесь |
| ru_RU-dmitri-medium | CC0 | дообучен с en_US-lessac | ⚠ не подтверждено |
| ru_RU-denis-medium | CC0 | дообучен с en_US-lessac | ⚠ не подтверждено |
| ru_RU-irina-medium | «Unknown» (RHVoice) | дообучен с en_US-lessac | ⚠ не подтверждено |
| ru_RU-ruslan-medium | CC BY-NC-SA 4.0 | дообучен с en_US-lessac | ❌ только некоммерческое |
| Windows SAPI (Irina) | Microsoft | — | ⚠ проверь условия Microsoft |
| `recorded` (твой голос) | твои права | — | ✅ |

Почему не подтверждено: базовая модель lessac обучена на датасете Blizzard 2013 по исследовательской лицензии (Research Licence Agreement). Поэтому для коммерческой публикации надёжнее записать голос самому (`recorded`) или в будущем подключить платный TTS с коммерческой лицензией. Это не юридическая консультация.

## 6. Рекомендуемые разрешения Claude Code (необязательно)
Чтобы агенты не спрашивали разрешение на каждую команду студии, создай сам `.claude/settings.json` (агенту создавать его запрещено, и это правильно):
```json
{
  "permissions": {
    "allow": ["Bash(npm run reel:*)", "Bash(npm run typecheck)", "Bash(npm run test)", "Bash(ffprobe:*)"],
    "deny": ["Read(./.env)", "Read(./.env.*)"]
  }
}
```

## 7. Лицензия Remotion
Remotion бесплатен для частных лиц, некоммерческих организаций и компаний **до 3 сотрудников**. Компании с 4 и более сотрудниками нужна Company License (remotion.pro).
