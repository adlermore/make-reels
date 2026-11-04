# Brand Brief

> Заполни этот бриф, затем попроси Claude: «создай бренд <id> по brands/_template/brand-brief.md».
> Получится `brands/<id>/brand-config.json` (схема: BrandConfigSchema в src/types/schemas.ts) и логотип рядом.
> Одна папка — один бренд или Instagram-аккаунт. Настройки разных брендов не смешиваются.

BRAND ID (латиница, через дефис):
BRAND NAME:
INSTAGRAM HANDLE:
LOGO (SVG или PNG с прозрачностью; положить в brands/<id>/):

## Цвета
PRIMARY:
SECONDARY:
ACCENT (ключевые слова, CTA):
BACKGROUND:
TEXT:
TEXT MUTED:

## Типографика (шрифты с кириллицей: Manrope, Unbounded, Inter, Montserrat, GolosText, Onest)
HEADING FONT:
BODY FONT:
HEADING CASE (обычный или ВЕРХНИЙ):

## Анимация
MOTION STYLE (calm, dynamic или punchy):
DEFAULT TRANSITION (blur-slide, zoom, slide, wipe, fade или none):
FILM GRAIN (0–0.3):

## Субтитры
CAPTION FONT:
CAPTION SIZE (48–110):
CAPTION COLOURS (текст, текущее слово, ключевые слова, обводка):
WORDS PER SCREEN (1–8):
POSITION (lower-third, center или upper-third):

## Голос
ENGINE (piper, windows-sapi или recorded):
VOICE (ru_RU-dmitri-medium — мужской, ru_RU-irina-medium — женский):
SPEED (lengthScale, 0.85–1.15):

## Музыка
PRESET (cinematic-pulse, uplifting-corporate, lofi-chill или ambient-tech):
BPM:
OWN TRACK (необязательно: файл в public/music/ и запись в public/music/licenses.json):

## Визуальная атмосфера
MOOD (2–3 предложения):
BACKGROUND PRESET (aurora, particles, grid или solid):
