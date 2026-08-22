import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";

const ALLOWED_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg"]);
const CONTENT_TYPES = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg" };
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const emptyState = { assets: [], track: null };

export function createAudioStore({ root, ffprobePath }) {
  const assetsDir = path.join(root, "hyperframes", "assets");
  const stateFile = path.join(root, "data", "audio-state.json");

  async function ensure() {
    await mkdir(assetsDir, { recursive: true });
    try { await stat(stateFile); } catch { await writeFile(stateFile, JSON.stringify(emptyState, null, 2) + "\n"); }
  }

  async function load() {
    await ensure();
    try { return JSON.parse(await readFile(stateFile, "utf8")); } catch { return structuredClone(emptyState); }
  }

  async function save(value) {
    await writeFile(stateFile, JSON.stringify(value, null, 2) + "\n");
    return value;
  }

  function probe(filePath) {
    return new Promise((resolve, reject) => {
      const child = spawn(ffprobePath, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", filePath], { windowsHide: true });
      let stdout = "", stderr = "", settled = false;
      const finish = (fn, value) => { if (!settled) { settled = true; clearTimeout(timer); fn(value); } };
      const timer = setTimeout(() => { child.kill(); finish(reject, new Error("音频分析超时")); }, 15000);
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", (error) => finish(reject, new Error(`无法启动 ffprobe：${error.message}`)));
      child.on("close", (code) => {
        if (code !== 0) return finish(reject, new Error(`无法读取音频：${stderr.slice(-300)}`));
        try {
          const data = JSON.parse(stdout), stream = data.streams?.find((item) => item.codec_type === "audio");
          if (!stream) return finish(reject, new Error("文件不包含音频流"));
          const durationSec = Number(data.format?.duration || stream.duration || 0);
          if (!Number.isFinite(durationSec) || durationSec <= 0) return finish(reject, new Error("无法确定音频时长"));
          finish(resolve, { durationSec, codec: stream.codec_name || "unknown", sampleRate: Number(stream.sample_rate) || null, channels: Number(stream.channels) || null });
        } catch { finish(reject, new Error("ffprobe 返回了无效数据")); }
      });
    });
  }

  async function importAsset(file) {
    if (!file || typeof file.arrayBuffer !== "function") throw new Error("请选择音频文件");
    const originalName = path.basename(file.name || "audio"), extension = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("仅支持 MP3、WAV、M4A 和 OGG");
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error("音频文件必须小于 50 MB");
    await ensure();
    const id = `audio_${crypto.randomUUID()}`, fileName = `${id}${extension}`, filePath = path.join(assetsDir, fileName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    try {
      const metadata = await probe(filePath), state = await load();
      const asset = { id, name: originalName, kind: "audio", fileName, sizeBytes: file.size, ...metadata, createdAt: Date.now() };
      state.assets.push(asset); await save(state); return asset;
    } catch (error) { await unlink(filePath).catch(() => {}); throw error; }
  }

  async function removeAsset(id) {
    const state = await load(), asset = state.assets.find((item) => item.id === id);
    if (!asset) throw new Error("音频素材不存在");
    await unlink(path.join(assetsDir, asset.fileName)).catch(() => {});
    state.assets = state.assets.filter((item) => item.id !== id);
    if (state.track?.assetId === id) state.track = null;
    await save(state); return state;
  }

  async function updateTrack(input) {
    const state = await load(), asset = state.assets.find((item) => item.id === input.assetId);
    if (!asset) throw new Error("请选择有效的音频素材");
    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
    const startFrame = Math.round(clamp(input.startFrame, 0, 143));
    const endFrame = Math.round(clamp(input.endFrame ?? 144, startFrame + 1, 144));
    const maxTrimFrames = Math.max(0, Math.floor(asset.durationSec * 24) - 1);
    state.track = {
      id: "audio_main", assetId: asset.id, startFrame, endFrame,
      trimStartFrame: Math.round(clamp(input.trimStartFrame, 0, maxTrimFrames)),
      volume: clamp(input.volume ?? 0.5, 0, 1), muted: Boolean(input.muted), loop: Boolean(input.loop),
      fadeInFrames: Math.round(clamp(input.fadeInFrames ?? 0, 0, endFrame - startFrame)),
      fadeOutFrames: Math.round(clamp(input.fadeOutFrames ?? 0, 0, endFrame - startFrame)),
    };
    await save(state); return { track: state.track, asset };
  }

  async function clearTrack() { const state = await load(); state.track = null; await save(state); return state; }
  async function resolveTrack() { const state = await load(); return { ...state, selectedAsset: state.assets.find((asset) => asset.id === state.track?.assetId) || null }; }
  function filePath(asset) { return path.join(assetsDir, asset.fileName); }
  function contentType(asset) { return CONTENT_TYPES[path.extname(asset.fileName).toLowerCase()] || "application/octet-stream"; }

  return { load, importAsset, removeAsset, updateTrack, clearTrack, resolveTrack, filePath, contentType, createReadStream };
}
