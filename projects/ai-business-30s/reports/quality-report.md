# Quality Report

- **Файл:** `renders/final.mp4`
- **SHA-256:** `21eb53dbc3046babb8b79b17fdf8916e7794f5b537c287ed7ce190db550b93e1`
- **Дата:** 2026-11-04T15:13:05.889Z
- **Вердикт:** **PASS**
- **Баллы:** автоматические 85/85 · итог **99/100** (проходной балл 90, критические ошибки блокируют независимо от баллов)

## Технические проверки (FFprobe/FFmpeg)

| | ID | Проверка | Баллы | Результат | Ответственный |
|---|---|---|---|---|---|
| ✅ | T1 | File exists and is readable | 3/3 | 33.0 MB | orchestrator (render) |
| ✅ | T2 | Container MP4 | 2/2 | mov,mp4,m4a,3gp,3g2,mj2 | orchestrator (render) |
| ✅ | T3 | Video codec H.264 | 3/3 | h264 High | orchestrator (render) |
| ✅ | T4 | Pixel format yuv420p | 3/3 | yuv420p | orchestrator (render) |
| ✅ | T5 | Resolution 1080×1920 (9:16) | 5/5 | 1080×1920 | motion-designer |
| ✅ | T6 | 30 fps constant frame rate | 4/4 | r=30/1 avg=30/1 | orchestrator (render) |
| ✅ | T7 | Duration matches timeline (±0.15 s) | 4/4 | 28.437s vs 28.433s | orchestrator (render) |
| ✅ | T8 | Audio AAC 48 kHz stereo | 4/4 | aac 48000 Hz 2ch | sound-designer |
| ✅ | T9 | Fast start (moov before mdat) | 3/3 | moov first | orchestrator (render) |
| ✅ | T10 | Full decode without errors | 4/4 | clean | orchestrator (render) |

## Аудио (измерения)

| | ID | Проверка | Баллы | Результат | Ответственный |
|---|---|---|---|---|---|
| ✅ | A1 | Integrated loudness -14 ±1 LUFS | 6/6 | -14.1 LUFS (LRA 3.6) | sound-designer |
| ✅ | A2 | True peak ≤ -1 dBTP | 5/5 | -1.5 dBTP | sound-designer |
| ✅ | A3 | No digital clipping (sample peak < −0.3 dBFS) | 3/3 | sample peak -1.48 dBFS | sound-designer |
| ✅ | A4 | No unintended silence > 1.2 s | 4/4 | none | sound-designer |
| ✅ | A5 | Audio/video stream lengths match (≤ 0.1 s) | 3/3 | audio 28.437s, video 28.433s | orchestrator (render) |
| ✅ | A6 | Voiceover present | 2/2 | voice track mean -17.4 dB | sound-designer |
| ✅ | A7 | No abrupt cut at the end (last 150 ms < −24 dB) | 2/2 | tail max -46.1 dB | sound-designer |

## Визуальные (измерения)

| | ID | Проверка | Баллы | Результат | Ответственный |
|---|---|---|---|---|---|
| ✅ | V1 | No black frames/segments ≥ 0.25 s | 5/5 | none | motion-designer |
| ✅ | V2 | No frozen picture > 2.5 s | 4/4 | none | motion-designer |
| ✅ | V3 | First frame is not blank | 3/3 | luma range 32–242 | motion-designer |
| ✅ | V4 | Hook on screen from frame 0 with a headline | 3/3 | s01 layout=hook, headline="88% внедрили ИИ. Выигрывают не все." | storyboard-director |

## Контент и раскладка

| | ID | Проверка | Баллы | Результат | Ответственный |
|---|---|---|---|---|---|
| ✅ | C1 | Captions inside Instagram safe zone | 3/3 | band y=1170–1500, safe y=250–1500 | motion-designer |
| ✅ | C2 | Caption size ≥ 48px | 2/2 | 72px | motion-designer |
| ✅ | C3 | Every scene visible ≥ 1 s | 2/2 | ok | storyboard-director |
| ✅ | C4 | subtitles.srt matches narration word count | 3/3 | 61 srt words vs 61 narration words | orchestrator (render) |

## Экспертная оценка агента quality-controller (по кадрам)

| | ID | Проверка | Баллы | Результат | Ответственный |
|---|---|---|---|---|---|
| ✅ | R1 | Visual quality & composition (frames) | 4/5 | 4/5 | motion-designer |
| ✅ | R2 | Motion & typography quality | 4/4 | 4/4 | motion-designer |
| ✅ | R3 | Content correctness (text, spelling, script match) | 3/3 | 3/3 | scriptwriter |
| ✅ | R4 | Hook strength (first 2 s) & logical ending | 3/3 | 3/3 | storyboard-director |

## Экспертная оценка

Рецензент: quality-controller

Every issue from the previous review was checked on this render. Fixed: the s04 org-chart now starts at y≈295, below the 250 px unsafe zone. The hook is fully readable at 0.1 s, with only the last few px of the underline still drawing. At every cut (4.5/4.65, 8.5/8.7, 11.1, 17.5/17.7, 21.5/21.7 s) no caption page carries over. Footnotes are larger and legible. The s02 label now reads 'делают то, что раньше не могли'. On-screen text matches the script, there are no spelling errors, the numbers (88/58/26/71%) are correct, nothing overlaps on rest frames, and the CTA end frame is clean. What remains is polish only: cyan/gold accent consistency and captions duplicating headlines. Manual review needed: how natural the TTS voice sounds and how it pronounces 'ИИ', how well the music/SFX fit and the voice/music balance, and whether the placeholder brand 'Reels Studio / @reels.studio' is the intended account.

| Severity | Scene | Category | Issue | Owner |
|---|---|---|---|---|
| minor | s04 | visual | Caption keyword accents still mix cyan and gold in one page ('вдвое' cyan, 'сильнее' gold) while the headline uses gold for 'вдвое'. Same cyan accent in s05 ('лишь двадцать') and s07 ('перестроит' cyan in the caption, gold in the headline). The cyan clashes with the gold-only accent system. Not fixed since the previous review. | motion-designer |
| minor | s07 | visual | Captions repeat the words of the kinetic headline right below it ('Выиграет тот' / 'кто перестроит процессы' under 'Выиграет тот, кто перестроит'; s04 and s03 do the same). This stacks redundant text. Consider a smaller caption style or dropping the keyword highlight when a headline is on screen. | motion-designer |
| minor | s01 | visual | The hook shows the headline as plain centred text. The storyboard called for a gold ring closing around 88% and a slow punch-in, and neither appears in hook frames 0.1–3.0 s. The headline also differs from the onScreenText in script.json ('88% внедрили ИИ. Выигрывают не все.' vs '88% — выигрывают не все'). The wording is correct, but this departs from the plan. | motion-designer |
| minor | s02 | content | subtitles.srt (the sidecar file, not burned in) drops punctuation: 'то что раньше не могли' has no comma and 'Подпишись больше разборов' has no dash. On-screen text is correct. | scriptwriter |

## Что проверяется вручную человеком

- Естественность интонации и ударений диктора (прослушать).
- Общее впечатление и соответствие бренду.
- Права на любые пользовательские материалы в assets/local.
