"""
Piper TTS bridge (offline neural TTS, free). Called by pipeline/providers/voice/piper.ts.

Input  (argv[1]): JSON file {model, lengthScale, noiseScale, noiseW, scenes: [{sceneId, text, out}]}
Output (stdout) : JSON {sampleRate, scenes: [{sceneId, out, durationSec, segments: [{start, end}], alignments: bool}]}

Word segments come from Piper phoneme alignments (model patched in memory, needs `onnx`).
A segment is a run of non-space/non-punctuation phonemes = one spoken word.
"""
import json
import sys
import wave

import numpy as np
from piper import PiperVoice, SynthesisConfig

NON_WORD = set(" ^$_.,!?;:—–-…\"'«»()[]")


def segments_from_alignments(alignments, offset_samples, sr):
    segs = []
    pos = offset_samples
    cur_start = None
    cur_end = None
    for al in alignments:
        ph = al.phoneme
        n = int(al.num_samples)
        is_word = not all(ch in NON_WORD for ch in ph)
        if is_word:
            if cur_start is None:
                cur_start = pos
            cur_end = pos + n
        else:
            if ph.strip() == "" or any(ch in ".,!?;:" for ch in ph):
                if cur_start is not None:
                    segs.append({"start": cur_start / sr, "end": cur_end / sr})
                    cur_start = None
        pos += n
    if cur_start is not None:
        segs.append({"start": cur_start / sr, "end": cur_end / sr})
    return segs


def main():
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        job = json.load(f)
    try:
        voice = PiperVoice.load(job["model"], include_alignments=True)
    except Exception:  # older piper or onnx missing -> no alignments, proportional fallback
        voice = PiperVoice.load(job["model"])
    cfg = SynthesisConfig(
        length_scale=job.get("lengthScale", 1.0),
        noise_scale=job.get("noiseScale", 0.667),
        noise_w_scale=job.get("noiseW", 0.8),
    )
    sr = voice.config.sample_rate
    results = []
    for scene in job["scenes"]:
        audio_parts = []
        segments = []
        offset = 0
        has_al = True
        for chunk in voice.synthesize(scene["text"], syn_config=cfg, include_alignments=True):
            arr = chunk.audio_float_array
            al = chunk.phoneme_alignments
            if al:
                segments.extend(segments_from_alignments(al, offset, sr))
            else:
                has_al = False
                segments.append({"start": offset / sr, "end": (offset + len(arr)) / sr})
            audio_parts.append(arr)
            offset += len(arr)
        audio = np.concatenate(audio_parts) if audio_parts else np.zeros(1, dtype=np.float32)
        pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        with wave.open(scene["out"], "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(pcm.tobytes())
        results.append({
            "sceneId": scene["sceneId"],
            "out": scene["out"],
            "durationSec": len(audio) / sr,
            "segments": segments,
            "alignments": has_al,
        })
    sys.stdout.write(json.dumps({"sampleRate": sr, "scenes": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
