# HyperCut

HyperCut 是一个以 π Agent 为核心、使用 HyperFrames 生成和渲染视频的 AI 视频编辑原型。

用户输入视频需求后，π Agent 会调用模型生成 HyperFrames HTML 代码，再将其渲染为 MP4。前端可以播放视频，也可以查看和复制模型生成的代码。

## 环境要求

- Node.js 22 或更高版本
- npm

## 安装

```bash
cd /Users/holmes/Agent/hypercut
npm install
```

在项目根目录创建 `.env`：

```env
MODEL_API_KEY=sk-wg68suBQyf8DMxPqcfm0g6yNFIDmkZb3LP4asContWRdEcRE
MODEL_BASE_URL=https://xcpcai.com/v1
PI_MODEL=gpt-5.6-sol
AGENT_PORT=8787
```

这是当前私密仓库使用的后端 API 配置。API Key 不会进入浏览器端代码。

## 启动

```bash
npm run dev:all
```

浏览器打开 `http://localhost:5173`。按 `Ctrl+C` 可以同时关闭前端和 Agent 服务。

## 基本流程

```text
输入提示词 → π Agent 生成代码 → HyperFrames 渲染 → 前端播放 MP4
```

模型调用最长等待 5 分钟。生成完成后，可在右侧“代码”面板查看对应的 HTML。

新建视频时可在输入框上方选择时长。支持 2–60 秒，可使用 6、10、20、30 秒快捷按钮或拖动滑杆；前端选择的时长优先于提示词中的时间描述。

## 指定帧实时修改

生成第一个视频后，切换到左侧的“实时修改”模式：

1. 播放或拖动视频到需要修改的位置。
2. 点击“使用当前帧”，也可以手动输入视频时长范围内的帧号。
3. 输入修改要求，例如“从这一帧开始增加绿色 LIVE 标签”。
4. 点击“应用修改”。π Agent 会读取原代码，只修改相关内容并渲染新版本。

修改期间原视频会继续保留在播放器中。新版完成后会自动切换，并跳转到目标帧附近。

## 常用命令

```bash
npm run dev:all     # 同时启动前端和后端
npm run build       # 构建前端
npm run hf:lint     # 检查 HyperFrames 代码
npm run hf:preview  # 打开 HyperFrames 预览
npm run hf:render   # 手动渲染视频
npm run check:flow  # 测试完整流程
```

## 主要目录

```text
app/                 前端界面
server/              π Agent 和后端服务
hyperframes/         当前生成的 HyperFrames 代码
output/              渲染后的 MP4 文件
```

如果页面无法连接 Agent，请确认终端中同时出现：

```text
http://localhost:5173
http://localhost:8787
```
