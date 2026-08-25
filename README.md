# HyperCut

**Agent 原生的视频编辑系统** —— 用自然语言描述需求，π Agent 生成可执行的 HyperFrames 代码，渲染成 MP4，并支持按帧增量修改。

用户输入一句话，系统生成代码、渲染成片；不满意可以围绕任意帧继续修改，像改代码一样改视频。

```
自然语言需求 → π Agent 生成代码 → HyperFrames 渲染 → MP4 / 实时预览
```

## 核心功能

| 功能 | 说明 |
| --- | --- |
| 🎬 一句话生成视频 | 自然语言 → HyperFrames HTML → MP4，2–60 秒可变时长 |
| 🎨 风格模板系统 | 8 套视觉风格（科技/简洁/数学学术/温暖/自然/商务/赛博朋克/复古），支持关键词意图自动识别 |
| ✂️ 分段生成长视频 | 长视频按 30 秒切段逐段生成，首段完成即预览，FFmpeg 无损拼接 |
| 🔗 前后段连贯 | 后段以前段生成的真实 HTML 为上下文，保证叙事与视觉连续 |
| 🎞️ 按帧增量修改 | 指定目标帧 + 文字要求，只改局部，保留无关内容，版本可追溯 |
| 🎵 音频轨 | 导入 MP3/WAV/M4A/OGG，音量/淡入淡出/循环/偏移，合成到视频 |

## 系统架构

```
┌──────────────┐   REST API   ┌───────────────────┐   生成 HTML   ┌────────────────┐
│  React 前端   │ ───────────► │  Node.js + π Agent │ ────────────► │ HyperFrames     │
│  预览 / 设置   │ ◄─────────── │  任务管理 / 生成    │ ◄──────────── │ lint / render   │
└──────────────┘   轮询状态    └───────────────────┘   渲染结果    └────────┬───────┘
                                                                            │
                                                                    FFmpeg 拼接 / 编码
                                                                            ▼
                                                                       MP4 成片
```

- **表现层**：React 19 + Vite + TypeScript
- **编排层**：Node.js 原生 http 服务 + π Agent（`pi-agent-core` + `pi-ai`）
- **智能层**：π Agent + LLM（OpenAI 兼容接口）
- **执行层**：HyperFrames（确定性逐帧渲染）+ FFmpeg

## 技术栈

- 前端：React 19、Vite 8、TypeScript、lucide-react
- 后端：Node.js、π Agent（`@earendil-works/pi-agent-core` / `pi-ai`）
- 渲染：HyperFrames 0.8.x、FFmpeg / FFprobe
- 模型：OpenAI 兼容 Chat Completions 接口（可配置）

## 环境要求

- Node.js 22 或更高版本
- npm 或 pnpm

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（在项目根目录创建 .env）
cp .env.example .env
```

编辑 `.env`（**注意：API Key 仅在后端使用，切勿提交到公开仓库**）：

```env
MODEL_API_KEY=sk-你的密钥
MODEL_BASE_URL=https://你的端点/v1
PI_MODEL=gpt-5.6-sol
AGENT_PORT=8787

# 可选：长视频分段时长（秒），默认 30
SEGMENT_SECONDS=30
```

```bash
# 3. 启动（同时拉起前端 + 后端）
npm run dev:all
```

浏览器打开 `http://localhost:5173`（前端）和 `http://localhost:8787`（后端）。

## 基本流程

1. 在「生成设置」输入描述，选择风格（自动识别或手动）和时长
2. 点击「生成视频」，π Agent 生成代码 → HyperFrames 渲染 → 前端播放
3. 长视频会先出首段预览，再续生成并拼接
4. 切换到「实时修改」模式，拖动到目标帧，输入修改要求，增量出新版本
5. 在「音频」标签导入背景音乐并合成

模型调用最长等待 5 分钟。生成完成后可在「代码」面板查看/复制模型生成的 HTML。

## 常用命令

```bash
npm run dev:all     # 同时启动前端和后端
npm run build       # 构建前端
npm run hf:lint     # 检查 HyperFrames 代码
npm run hf:preview  # 打开 HyperFrames 预览
npm run hf:render   # 手动渲染视频
npm run check:flow  # 测试完整流程
```

## 主要 API

| 接口 | 方法 | 作用 |
| --- | --- | --- |
| `/api/agent/generate` | POST | 创建生成任务（提示词、时长、风格） |
| `/api/agent/modify` | POST | 基于当前代码和目标帧增量修改 |
| `/api/jobs/:id` | GET | 查询任务状态 |
| `/api/jobs/:id/code` | GET | 获取模型生成的代码 |
| `/api/styles` | GET | 返回可选视觉风格 |
| `/api/audio-track` | GET/PUT/DELETE | 读取/更新/清除音轨 |
| `/api/assets` | POST | 上传音频素材 |

## 目录结构

```text
app/                 前端界面（React）
server/              π Agent 和后端服务
  index.mjs          HTTP 服务 + 任务管理
  pi-agent.mjs       π Agent 封装 + 提示词
  styles.mjs         风格模板 + 意图识别
  audio-store.mjs    音频素材与音轨
hyperframes/         当前生成的 HyperFrames 代码
output/              渲染后的 MP4 文件
docs/                技术报告与演示幻灯片
```

## 团队成员分工

| 成员 | 方向 | 主要工作 |
| --- | --- | --- |
| 刘家豪 | 风格模板与分段生成 | 8 套风格模板与意图自动识别、分段长视频生成与前后段连贯、前端风格选择器与部分预览、技术报告与 PPT |
| 谢昌恒 | 框架与核心链路 | 搭建前后端项目框架、接入 π Agent 与 HyperFrames 打通生成链路、可变时长控制、按帧增量修改、异步任务管理与渲染 |
| 刘维轩 | 音频与前端重构 | 音频功能、长视频教学架构、前端页面重构、跨平台兼容 |

## 常见问题

**页面连不上 Agent？** 确认终端同时出现 `http://localhost:5173` 和 `http://localhost:8787`。

**渲染失败？** 确认 `node_modules` 已安装，FFmpeg / FFprobe（`ffmpeg-static` / `ffprobe-static`）就位，HyperFrames 能正常 `lint`。
