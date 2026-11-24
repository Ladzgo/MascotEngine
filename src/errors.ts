/** Raw tool/network errors in plain words, with the fix. Unknown errors pass through unchanged. */
export function friendlyError(msg: string): string {
  const rules: [RegExp, string][] = [
    [/ENOENT.*(ffmpeg|ffprobe)|spawn(Sync)? (ffmpeg|ffprobe)|(ffmpeg|ffprobe): command not found/i, 'ffmpeg is not installed or not on PATH. Install it (macOS: brew install ffmpeg, Linux: apt install ffmpeg) and run again.'],
    [/ffmpeg.*(Invalid data|moov atom|No such file)|Error opening input/i, 'ffmpeg could not read an audio or video file. Regenerate the voice for this episode, or check the recording is a valid wav, mp3 or m4a.'],
    [/ECONNREFUSED|fetch failed|Ollama.*(not (running|reachable)|unreachable)|connect.*11434/i, 'The local AI (Ollama) is not running. Open Settings and press "Start local AI", or run `ollama serve` in a terminal.'],
    [/model ['"]?[\w.:-]+['"]? not found|try pulling it first/i, 'The Ollama model is not downloaded. Run `ollama pull qwen2.5:7b` (needs internet once), or choose an installed model.'],
    [/whisper.*(not found|ENOENT|No such file)|ggml-.*\.bin/i, 'whisper.cpp or its model is missing, so captions use estimated timing. Put whisper-cli on PATH and ggml-base.en.bin in data/models/ (see Settings).'],
    [/ENOSPC/i, 'The disk is full. Free some space (old renders live in episodes/<id>/build) and run again.'],
    [/EACCES|EPERM/i, 'The Studio is not allowed to write to the project folder. Check the folder permissions.'],
  ];
  for (const [re, text] of rules) if (re.test(msg)) return text;
  return msg;
}
