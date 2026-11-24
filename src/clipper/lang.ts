import path from 'node:path';

/** True for English-only ggml models (ggml-base.en.bin, ggml-small.en.bin...). */
export const isEnglishOnly = (model: string) => /\.en\.bin$/i.test(path.basename(model));

/**
 * Language argument for whisper-cli: --lang wins (`auto` = detect), else English for `.en` models and `auto` for multilingual
 * ones (whisper.cpp itself defaults to `en`, which garbles Hungarian). An English-only model with a non-English --lang is an error.
 */
export function whisperLang(model: string, flag?: string): string {
  const l = (flag ?? '').trim().toLowerCase();
  if (l && !/^(auto|[a-z]{2,3})$/.test(l)) throw new Error(`--lang must be auto or a language code like en, hu, de (got "${flag}")`);
  if (isEnglishOnly(model)) {
    if (l && l !== 'en') throw new Error(`${path.basename(model)} is English-only; for --lang ${l} use a multilingual model (ggml-base.bin, ggml-small.bin) and set WHISPER_MODEL`);
    return 'en';
  }
  return l || 'auto';
}
