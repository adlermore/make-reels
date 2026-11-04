# Производственный процесс

`One Topic → Research → Creative Concept → Script → Storyboard → Assets → Sound → Edit → Render → QC → Final Reels`

## Самый короткий путь
```
/create-reel ai-business-30s Почему ИИ меняет бизнес
```
Оркестратор заполнит бриф вместе с тобой, проведёт агентов по этапам и остановится на четырёх точках утверждения.

## Этапы и команды
| # | Этап | Кто | Команда проверки / исполнения |
|---|---|---|---|
| 0 | Бриф | ты + оркестратор | `npm run reel -- init <id>` → заполнить `brief/brief.md` → `npm run reel -- brief <id>` |
| 1 | Исследование | trend-researcher | `validate <id> research` |
| 2 | Концепция | creative-director | `validate <id> creative` |
| 3 | Сценарий | scriptwriter | `validate <id> script` |
| 4 | Раскадровка | storyboard-director | `validate <id> storyboard` |
| 5 | Иллюстрации | asset-producer | `validate <id> storyboard` |
| **A** | **Утверждение концепции** | **ты** | `approve <id> a --note "…"` |
| 6 | Звук | sound-designer | `voice`, `music`, `sfx`, `mix` (или `produce <id> assets`) |
| 7 | Монтаж, аниматик | motion-designer | `illustrations` (превью SVG), `timeline`, `frames` |
| **B** | **Утверждение ассетов и аниматика** | **ты** | `approve <id> b --note "…"` |
| 8 | Превью | оркестратор | `produce <id> preview` |
| **C** | **Утверждение превью** | **ты** | `approve <id> c --note "…"` |
| 9 | Финал и QC | оркестратор, quality-controller | `render <id> --final`, затем `qc <id>` |
| **D** | **Финальное утверждение** | **ты** | `approve <id> d --note "…"`, затем `deliver <id>` |

Stage B заменяет «утверждение платной генерации» из исходного ТЗ, потому что платной генерации в системе нет. Вместо неё ты утверждаешь голос, музыку и кадры аниматика.

## Внести изменения на любом этапе
- Поправь файл этапа сам или попроси оркестратора поручить это нужному агенту.
- Запусти `validate`: изменённый этап и всё после него станут `stale`.
- Перезапусти нужные команды. Неизменённые шаги пропустятся автоматически (`--force` перегенерирует принудительно).

## Восстановление после перезапуска
`npm run reel -- status <id>` показывает каждый этап (● done, ◌ stale, ✖ failed, ○ pending) и следующий шаг. Состояние хранится в `data/studio.db` и в `projects/<id>/production-state.json`.

## Итоговые материалы (в `projects/<id>/`)
research-report.md · creative-direction.md · script.md · storyboard.md · shot-list.json · asset-manifest.json ·
sound-design-plan.md · production-cost-report.json · quality-report.md · renders/final.mp4 · renders/preview.mp4 ·
renders/poster.png · renders/subtitles.srt · README.md, плюс renders/final-no-music.mp4 и publish-kit.md.

Исходники (голос по сценам, музыка, SFX, иллюстрации) лежат в `audio/` и `assets/` отдельно от рендеров в `renders/`.
