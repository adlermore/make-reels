# make-reels — AI Reels Production Studio

Бесплатная локальная студия для производства Instagram Reels. Её запускают из Claude Code. По умолчанию ролики делаются на профессиональном **восточноармянском** языке, также поддерживаются русский и английский.

- **Агенты Claude Code** исследуют тему и пишут концепцию, сценарий, раскадровку, иллюстрации и QC-рецензию.
- **Remotion** делает моушн-дизайн, кинетическую типографику, инфографику, переходы и субтитры с подсветкой слов.
- **Piper** даёт нейросетевую озвучку офлайн, по-армянски (hy_AM) и по-русски, с точными таймингами слов.
- **Собственный синтезатор** создаёт музыку и звуковые эффекты: оригинальные и без лицензионных рисков.
- **FFmpeg** сводит звук (дакинг, −14 LUFS) и выполняет автоматические проверки качества.
- **SQLite** (`node:sqlite`) хранит состояние производства, ассеты, историю и расходы.

API-ключи и платные сервисы не нужны.

## Быстрый старт
```bash
npm install
npm run setup:voice
npm run reel -- doctor
```
Затем в Claude Code набери `/create-reel`.

## Документация
- [docs/SETUP.md](docs/SETUP.md): установка, бренд, голос, лицензии
- [docs/WORKFLOW.md](docs/WORKFLOW.md): этапы и команды
- [docs/AGENTS.md](docs/AGENTS.md): команда агентов
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): устройство системы
- [docs/API-INTEGRATIONS.md](docs/API-INTEGRATIONS.md): платные API (не подключены) и проверенные факты
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): решение проблем
- [docs/PROJECT-AUDIT.md](docs/PROJECT-AUDIT.md), [docs/SPEC.md](docs/SPEC.md), [PROGRESS.md](PROGRESS.md)
