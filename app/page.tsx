"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  FileVideo,
  History,
  Maximize2,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Trash2,
  Upload,
  Video,
  Volume2,
  Wand2,
  X,
} from "lucide-react";

type Operation = { id: number; label: string; detail: string; time: string; status?: "success" | "failed" };
type AudioAsset = { id: string; name: string; durationSec: number; codec: string; sizeBytes: number };
type AudioTrack = { assetId: string; startFrame: number; endFrame: number; trimStartFrame: number; volume: number; muted: boolean; loop: boolean; fadeInFrames: number; fadeOutFrames: number };
type Tab = "settings" | "audio" | "code" | "activity";
const API = "http://localhost:8787";
const ideas = [
  "生成一个科技感宣传片，标题是“智创未来”",
  "制作一个温暖治愈的视频，标题是“向光而行”",
  "生成绿色环保主题视频，文案为“共生未来”",
];
type Style = { id: string; name: string; icon: string; description: string; palette: string[] };
const FALLBACK_STYLES: Style[] = [
  { id: "tech", name: "科技", icon: "⚡", description: "霓虹辉光 · 未来网格", palette: ["#c8f25c", "#7667ff", "#0a0d1b"] },
  { id: "minimal", name: "简洁", icon: "◻", description: "极简留白 · 克制排版", palette: ["#f4f4f5", "#8b93a7", "#0b0c10"] },
  { id: "math", name: "数学学术", icon: "∑", description: "黑板推导 · 公式书写", palette: ["#ffd97a", "#9cc7ff", "#0d1b16"] },
  { id: "warm", name: "温暖", icon: "☀", description: "治愈暖调 · 柔和光影", palette: ["#ff7849", "#ffcf6d", "#321b35"] },
  { id: "nature", name: "自然", icon: "🌿", description: "绿色环保 · 清新", palette: ["#c8f25c", "#47d7a1", "#071d24"] },
  { id: "business", name: "商务", icon: "💼", description: "专业稳重 · 深蓝", palette: ["#4f7cff", "#7dd3fc", "#0b1220"] },
  { id: "cyberpunk", name: "赛博朋克", icon: "🌆", description: "霓虹粉青 · 故障感", palette: ["#ff2fb3", "#00e5ff", "#0a0118"] },
  { id: "retro", name: "复古", icon: "📼", description: "胶片颗粒 · 怀旧", palette: ["#ffb45c", "#e07a5f", "#1a1520"] },
];

const phaseLabels: Record<string, string> = {
  ready: "准备就绪",
  reasoning: "正在理解需求",
  coding: "正在准备画面",
  rendering: "正在渲染视频",
  complete: "视频已生成",
  failed: "渲染失败",
};

export default function Home() {
  const [prompt, setPrompt] = useState(ideas[0]);
  const [title, setTitle] = useState("智创未来");
  const [operations, setOperations] = useState<Operation[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("准备生成视频");
  const [videoUrl, setVideoUrl] = useState("");
  const [phase, setPhase] = useState("ready");
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState<Tab>("settings");
  const [code, setCode] = useState("");
  const [model, setModel] = useState("gpt-5.6-sol");
  const [editMode, setEditMode] = useState(false);
  const [targetFrame, setTargetFrame] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [version, setVersion] = useState(0);
  const [duration, setDuration] = useState(6);
  const [styles, setStyles] = useState<Style[]>(FALLBACK_STYLES);
  const [styleId, setStyleId] = useState("auto");
  const [toast, setToast] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastVideoRef = useRef("");
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
      setCurrentFrame(Math.round(video.currentTime * 24));
    };
    video.addEventListener("timeupdate", update);
    video.addEventListener("loadedmetadata", update);
    video.addEventListener("play", () => setIsPlaying(true));
    video.addEventListener("pause", () => setIsPlaying(false));
    return () => {
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("loadedmetadata", update);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => { loadAudio(); }, []);
  useEffect(() => { fetch(`${API}/api/styles`).then((r) => r.json()).then((d) => { if (Array.isArray(d.styles) && d.styles.length) setStyles(d.styles); }).catch(() => {}); }, []);

  async function loadAudio() {
    try { const data = await fetch(`${API}/api/audio`).then((response) => response.json()); setAudioAssets(data.assets || []); setAudioTrack(data.track || null); } catch { /* Service status is shown when an action fails. */ }
  }

  async function poll(jobId: string, seekFrame?: number) {
    for (let i = 0; i < 1800; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      const job = await fetch(`${API}/api/jobs/${jobId}`).then((response) => response.json());
      setNotice(job.message || "正在处理…");
      setPhase(job.status);
      if (job.videoUrl) { const base = `${API}${job.videoUrl}`; if (lastVideoRef.current !== base) { lastVideoRef.current = base; setVideoUrl(`${base}?t=${Date.now()}`); } }
      if (job.totalDuration) setDuration(job.totalDuration);
      if (job.status === "complete") {
        const source = await fetch(`${API}/api/jobs/${jobId}/code`).then((response) => response.json());
        setCode(source.code || "");
        setModel(source.model || model);
        setVersion(source.version || job.version || version);
        setVideoUrl(`${API}${job.videoUrl}?t=${Date.now()}`);
        setRunning(false);
        setTab("activity");
        const audioJob = String(job.kind || "").startsWith("audio");
        setOperations((items) => [
          { id: Date.now(), label: audioJob ? "音轨更新完成" : job.kind === "edit" ? "版本修改完成" : "视频生成完成", detail: audioJob ? `音频已写入版本 v${job.version}` : job.kind === "edit" ? `第 ${job.targetFrame} 帧 · 版本 v${job.version}` : "MP4 已渲染，可以播放", time: "刚刚" },
          ...items,
        ]);
        if (seekFrame != null) window.setTimeout(() => { if (videoRef.current) videoRef.current.currentTime = seekFrame / 24; }, 150);
        return;
      }
      if (job.status === "failed") throw new Error(job.error || "渲染失败");
    }
    throw new Error("渲染超时，请稍后重试");
  }

  async function saveAudioTrack(next: AudioTrack) {
    if (running) return;
    setAudioBusy(true); setRunning(true); setPhase("rendering"); setNotice("正在合成音频并重新渲染…"); setTab("activity");
    try {
      const response = await fetch(`${API}/api/audio-track`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "音轨保存失败");
      setAudioTrack(data.track); await poll(data.jobId); await loadAudio();
    } catch (error) { setRunning(false); setPhase("failed"); setNotice(error instanceof Error ? error.message : "音轨保存失败"); }
    finally { setAudioBusy(false); }
  }

  async function uploadAudio(file?: File) {
    if (!file || audioBusy || running) return;
    setAudioBusy(true); setNotice("正在导入并分析音频…");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch(`${API}/api/assets`, { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "音频导入失败");
      const next = { assetId: data.asset.id, startFrame: 0, endFrame: Math.ceil(duration*24), trimStartFrame: 0, volume: 0.5, muted: false, loop: data.asset.durationSec < duration, fadeInFrames: 8, fadeOutFrames: 12 };
      setAudioAssets((items) => [...items, data.asset]); setAudioTrack(next); setAudioBusy(false); await saveAudioTrack(next);
    } catch (error) { setAudioBusy(false); setNotice(error instanceof Error ? error.message : "音频导入失败"); setToast(error instanceof Error ? error.message : "音频导入失败"); }
    finally { if (audioInputRef.current) audioInputRef.current.value = ""; }
  }

  async function removeAudioTrack() {
    if (!audioTrack || audioBusy || running) return;
    setAudioBusy(true); setRunning(true); setPhase("rendering"); setNotice("正在移除音轨并重新渲染…"); setTab("activity");
    try { const response = await fetch(`${API}/api/audio-track`, { method: "DELETE" }), data = await response.json(); if (!response.ok) throw new Error(data.error || "移除失败"); setAudioTrack(null); await poll(data.jobId); }
    catch (error) { setRunning(false); setPhase("failed"); setNotice(error instanceof Error ? error.message : "移除失败"); }
    finally { setAudioBusy(false); }
  }

  async function runGeneration() {
    const value = prompt.trim();
    if (!value || running) return;
    const modifying = editMode && Boolean(videoUrl);
    setRunning(true);
    lastVideoRef.current = "";
    setPhase("reasoning");
    setNotice(modifying ? `正在分析第 ${targetFrame} 帧…` : "正在理解需求并准备画面…");
    setTab("activity");
    try {
      const endpoint = modifying ? "modify" : "generate";
      const body = modifying ? { prompt: value, targetFrame } : { prompt: value, duration, style: styleId };
      const response = await fetch(`${API}/api/agent/${endpoint}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "视频服务未启动");
      if (data.spec) { setTitle(data.spec.title); setDuration(data.spec.duration || duration); }
      setModel(data.model || model);
      setVersion(data.version || version);
      setOperations((items) => [{ id: Date.now(), label: modifying ? "提交版本修改" : "创建视频任务", detail: modifying ? `从第 ${data.targetFrame} 帧开始修改` : value, time: "刚刚" }, ...items]);
      await poll(data.jobId, modifying ? data.targetFrame : undefined);
    } catch (error) {
      setRunning(false);
      setPhase("failed");
      setNotice(error instanceof Error ? error.message : "生成失败，请检查服务");
      setOperations((items) => [{ id: Date.now(), label: "任务失败", detail: error instanceof Error ? error.message : "请检查 Agent 服务", time: "刚刚", status: "failed" }, ...items]);
    }
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setToast("代码已复制");
  }

  const statusPercent = useMemo(() => ({ ready: 0, reasoning: 18, coding: 45, rendering: 76, complete: 100, failed: 100 }[phase] ?? 0), [phase]);
  const canEdit = Boolean(videoUrl);
  const selectedAudio = audioAssets.find((asset) => asset.id === audioTrack?.assetId) || null;
  const patchAudio = <K extends keyof AudioTrack>(key: K, value: AudioTrack[K]) => setAudioTrack((track) => track ? { ...track, [key]: value } : track);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">H</span><span>HyperCut</span></div>
        <div className="project-select"><FileVideo size={15} /><span>未命名项目</span><ChevronDown size={14} /></div>
        <div className="top-actions"><span className="save-status"><Check size={14} />已保存</span><button className="icon-button" title="设置"><Settings2 size={17} /></button><button className="render-button" onClick={runGeneration} disabled={running}><Play size={15} fill="currentColor" />{running ? "处理中…" : editMode && canEdit ? "应用修改" : "生成视频"}</button><div className="avatar">H</div></div>
      </header>

      <section className="workspace">
        <aside className="project-panel">
          <div className="panel-heading"><div><span className="eyebrow-label">PROJECT</span><h1>视频制作</h1></div><button className="icon-button light" title="新建项目"><Plus size={16} /></button></div>
          <div className="project-card"><div className="project-thumb"><Video size={20} /></div><div><b>{title || "未命名视频"}</b><small>960 × 540 · {duration} 秒 · 24 fps</small></div><span className="dot online-dot" /></div>
          <div className="panel-section"><div className="section-label">当前任务</div><button className={`side-item ${tab !== "audio" ? "active" : ""}`} onClick={() => setTab("settings")}><Wand2 size={16} />视频生成</button><button className={`side-item ${tab === "audio" ? "active" : ""}`} onClick={() => setTab("audio")}><Music2 size={16} />音频{audioTrack ? <span className="count">1</span> : null}</button></div>
          <div className="panel-section versions"><div className="section-label">版本记录 <span>{version || 0}</span></div>{version ? <div className="version-row current"><span className="version-mark"><Check size={12} /></span><div><b>版本 v{version}</b><small>{editMode ? "增量修改" : "初次生成"} · 刚刚</small></div></div> : <div className="empty-side"><History size={17} /><span>生成视频后，版本会显示在这里</span></div>}</div>
          <div className="panel-spacer" /><div className="panel-footer"><button className="side-item"><Settings2 size={16} />项目设置</button><span className="service-state"><i />渲染服务已连接</span></div>
        </aside>

        <section className="editor">
          <div className="stage-toolbar"><div className="crumbs"><span>项目</span><b>/</b><strong>{title || "未命名视频"}</strong></div><div className={`preview-state ${phase === "failed" ? "failed" : ""}`}><i />{videoUrl ? "MP4 预览" : "预览窗口"}<span>{videoUrl ? "READY" : phaseLabels[phase]}</span></div></div>
          <div className="canvas-wrap"><div className={`canvas video-canvas ${videoUrl ? "has-video" : ""}`}>{videoUrl ? <video ref={videoRef} src={videoUrl} controls autoPlay loop playsInline /> : <div className="empty-preview"><div className="empty-icon"><Video size={24} /></div><h2>{running ? phaseLabels[phase] : "还没有视频"}</h2><p>{running ? notice : "输入描述，创建你的第一个视频"}</p>{running && <div className="progress-track"><i style={{ width: `${statusPercent}%` }} /></div>}</div>}</div><div className="playback"><button className="play-control" onClick={() => { if (!videoRef.current) return; videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause(); }} title="播放/暂停">{isPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</button><span>{videoUrl ? `${(currentFrame / 24).toFixed(2)} 秒` : "等待视频"}</span><div className="playbar"><i style={{ width: `${progress}%` }} /></div><span>{videoUrl  ? `${duration.toFixed(2)} 秒` : "--"}</span><button className="quiet" onClick={() => videoRef.current?.requestFullscreen?.()} title="全屏"><Maximize2 size={16} /></button></div></div>
          <div className="timeline"><div className="timeline-head"><div><b>生成时间线</b><span className="timeline-sub">{phaseLabels[phase]}</span></div><div className="timeline-meta"><span>当前帧 {currentFrame}</span><span>版本 v{version || 1}</span></div></div><div className="timeline-ruler">{Array.from({ length: 7 }, (_, index) => <span key={index}>{Math.round(duration * index / 6)}s</span>)}</div><div className="timeline-track"><span className="track-label"><Video size={14} />视频</span><div className="clip video-clip" style={{ width: videoUrl ? "100%" : "32%" }}>{videoUrl ? `${title} · MP4` : "等待生成"}</div><div className="playhead" style={{ left: `${Math.max(5, progress)}%` }}><i /></div></div>{audioTrack && selectedAudio ? <div className="timeline-track"><span className="track-label"><Music2 size={14} />音频</span><div className="clip audio-clip" style={{ marginLeft: `${audioTrack.startFrame / (duration * 24) * 100}%`, width: `${(audioTrack.endFrame - audioTrack.startFrame) / (duration * 24) * 100}%` }}>{selectedAudio.name}</div></div> : null}</div>
        </section>

        <aside className="inspector">
          <div className="inspector-tabs">{([["settings", "生成设置", Settings2], ["audio", "音频", Music2], ["code", "代码", Code2], ["activity", "活动记录", Activity]] as const).map(([key, label, Icon]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><Icon size={15} />{label}{key === "activity" && operations.length > 0 ? <em>{operations.length}</em> : null}</button>)}</div>
          {tab === "settings" && <div className="inspector-content"><div className="inspector-title"><span>生成视频</span><small>描述你的画面和风格</small></div><div className="mode-toggle"><button className={!editMode ? "active" : ""} onClick={() => setEditMode(false)}><Plus size={14} />新建视频</button><button className={editMode ? "active" : ""} disabled={!canEdit} onClick={() => setEditMode(true)}><RotateCcw size={14} />修改当前版本</button></div>{!editMode && <div className="duration-control"><div><b>视频时长</b><span>{Math.round(duration * 24)} 帧 · 24 fps</span></div><div className="duration-presets">{[6, 10, 20, 30].map((seconds) => <button key={seconds} className={duration === seconds ? "active" : ""} onClick={() => setDuration(seconds)}>{seconds}s</button>)}</div><input type="range" min="2" max="60" step="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /><strong>{duration} 秒</strong></div>}{!editMode && <div className="style-control"><div className="style-label">风格模板</div><div className="style-grid"><button className={`style-chip ${styleId === "auto" ? "active" : ""}`} onClick={() => setStyleId("auto")}><span className="style-swatch" style={{ background: "linear-gradient(135deg,#a3e635,#22d3ee)" }} /><span>✨ 自动</span></button>{styles.map((s) => <button key={s.id} className={`style-chip ${styleId === s.id ? "active" : ""}`} onClick={() => setStyleId(s.id)}><span className="style-swatch" style={{ background: `linear-gradient(135deg,${s.palette[0]},${s.palette[1]})` }} /><span>{s.icon} {s.name}</span></button>)}</div></div>}{editMode && <div className="frame-target"><label>修改起始帧<input type="number" min="0" max={Math.max(0,Math.ceil(duration*24)-1)} value={targetFrame} onChange={(e) => setTargetFrame(Math.max(0, Math.min(Math.max(0,Math.ceil(duration*24)-1), Number(e.target.value) || 0)))} /></label><span>{(targetFrame / 24).toFixed(2)} 秒 · 24 fps</span><button onClick={() => setTargetFrame(currentFrame)}>使用当前帧 {currentFrame}</button></div>}<label className="field-label">视频描述<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runGeneration(); } }} placeholder="例如：制作一个简洁的产品介绍视频…" /></label><div className="suggestions"><span>快速开始</span>{ideas.map((idea) => <button key={idea} onClick={() => setPrompt(idea)}>{idea}</button>)}</div><button className="primary-action" onClick={runGeneration} disabled={!prompt.trim() || running}><Send size={15} />{running ? "正在处理" : editMode && canEdit ? "应用修改" : "生成视频"}</button></div>}
          {tab === "audio" && <div className="inspector-content audio-editor"><div className="inspector-title"><span>音频</span><small>导入背景音乐或旁白并合成到视频</small></div><input ref={audioInputRef} type="file" accept=".mp3,.wav,.m4a,.ogg,audio/*" hidden onChange={(event) => uploadAudio(event.target.files?.[0])} /><button className="upload-audio" onClick={() => audioInputRef.current?.click()} disabled={audioBusy || running}><Upload size={16} />{audioBusy ? "正在处理…" : "导入音频"}</button>{audioTrack && selectedAudio ? <><div className="audio-asset"><Music2 size={18} /><div><b>{selectedAudio.name}</b><small>{selectedAudio.codec.toUpperCase()} · {selectedAudio.durationSec.toFixed(1)} 秒 · {(selectedAudio.sizeBytes / 1024 / 1024).toFixed(1)} MB</small></div></div><audio className="audio-preview" controls src={`${API}/api/assets/${selectedAudio.id}/file`} /><div className="audio-fields"><label>音量 <span>{Math.round(audioTrack.volume * 100)}%</span><input type="range" min="0" max="1" step="0.01" value={audioTrack.volume} onChange={(event) => patchAudio("volume", Number(event.target.value))} /></label><div className="fields"><label>起始帧<input type="number" min="0" max={Math.max(0,Math.ceil(duration*24)-1)} value={audioTrack.startFrame} onChange={(event) => patchAudio("startFrame", Number(event.target.value))} /></label><label>结束帧<input type="number" min="1" max={Math.ceil(duration*24)} value={audioTrack.endFrame} onChange={(event) => patchAudio("endFrame", Number(event.target.value))} /></label><label>素材偏移<input type="number" min="0" value={audioTrack.trimStartFrame} onChange={(event) => patchAudio("trimStartFrame", Number(event.target.value))} /></label><label>淡入帧数<input type="number" min="0" value={audioTrack.fadeInFrames} onChange={(event) => patchAudio("fadeInFrames", Number(event.target.value))} /></label><label>淡出帧数<input type="number" min="0" value={audioTrack.fadeOutFrames} onChange={(event) => patchAudio("fadeOutFrames", Number(event.target.value))} /></label></div><label className="check-field"><input type="checkbox" checked={audioTrack.loop} onChange={(event) => patchAudio("loop", event.target.checked)} />循环播放</label><label className="check-field"><input type="checkbox" checked={audioTrack.muted} onChange={(event) => patchAudio("muted", event.target.checked)} />静音</label></div><div className="audio-actions"><button className="primary-action" onClick={() => saveAudioTrack(audioTrack)} disabled={audioBusy || running}><Volume2 size={15} />应用音轨设置</button><button className="remove-audio" onClick={removeAudioTrack} disabled={audioBusy || running}><Trash2 size={14} />移除音轨</button></div></> : <div className="empty-audio"><Music2 size={27} /><b>尚未添加音频</b><p>支持 MP3、WAV、M4A 和 OGG，最大 50 MB。</p></div>}</div>}
          {tab === "code" && <div className="code-panel"><div className="code-toolbar"><div><b>HyperFrames HTML</b><span>{code ? `${code.split("\n").length} 行 · 只读` : "尚无代码"}</span></div><button disabled={!code} onClick={copyCode} title="复制代码"><Copy size={14} /></button></div>{code ? <pre><code>{code}</code></pre> : <div className="empty-code"><Code2 size={28} /><b>尚无生成代码</b><p>生成视频后，完整 HTML 会显示在这里。</p></div>}</div>}
          {tab === "activity" && <div className="activity-panel"><div className="inspector-title"><span>活动记录</span><small>本项目的生成与修改历史</small></div><div className={`current-status ${phase === "failed" ? "is-error" : ""}`}><span className={running ? "status-spinner" : phase === "failed" ? "status-error" : "status-check"}>{running ? "" : phase === "failed" ? "!" : "✓"}</span><div><b>{phaseLabels[phase]}</b><p>{notice}</p></div></div>{operations.length ? operations.map((operation) => <div className="activity-row" key={operation.id}><span className={operation.status === "failed" ? "activity-dot error" : "activity-dot"}>{operation.status === "failed" ? <X size={11} /> : <CheckCircle2 size={13} />}</span><div><b>{operation.label}</b><p>{operation.detail}</p></div><time>{operation.time}</time></div>) : <div className="empty-activity"><History size={20} /><span>完成一次生成后，操作记录会显示在这里。</span></div>}</div>}
        </aside>
      </section>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
