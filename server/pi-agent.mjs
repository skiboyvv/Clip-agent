import { Agent } from "@earendil-works/pi-agent-core";
import { Type, createModels, createProvider, envApiKeyAuth } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

const SYSTEM_PROMPT=`You are HyperCut, a video-generation coding agent. You must create a complete, self-contained HyperFrames HTML composition based on the user's Chinese or English request, then call write_composition exactly once.

Hard requirements:
- Root composition: id="stage", data-composition-id="hypercut-main", data-no-timeline, data-start="0", data-duration matching the requested duration, data-width="960", data-height="540", data-fps="24".
- Output exactly one complete HTML document with inline CSS and JS. No network requests, external assets, markdown fences, explanations inside HTML, or user secrets.
- Every timed .clip element must have a stable id, data-start, data-duration, and data-track-index.
- Drive JavaScript animation with window.addEventListener("hf-seek", event => { const t = event.detail.time; ... }). If frame work is asynchronous, register its promise synchronously with event.detail.waitUntil(promise). All animation must be deterministic from t; do not use setInterval, requestAnimationFrame, Date, or randomness.
- Use @font-face with src:local("PingFang SC") if using PingFang SC.
- Make a polished animated video spanning the full requested duration, with legible typography, strong composition, meaningful scene progression, continuous motion, and a clean ending.
- Escape all user text before placing it in HTML.
- Call write_composition with the full HTML and a short Chinese summary. Do not merely describe code.`;

const EDIT_SYSTEM_PROMPT=`You are HyperCut's incremental video editing agent. Modify the supplied existing HyperFrames HTML according to the user's request, then call write_composition exactly once.

Hard requirements:
- Return the complete updated HTML document, not a patch and not markdown.
- Preserve everything that the request does not need to change.
- The requested target frame is contextual: make the visual change begin at that exact time unless the user explicitly asks for a global change.
- At 24 fps, targetTime = targetFrame / 24. Use stable .clip elements with data-start, data-duration and data-track-index for time-scoped additions.
- Keep data-composition-id="hypercut-main", 960x540, 24 fps and the existing duration.
- Drive deterministic JavaScript motion through the hf-seek event. Do not use timers, requestAnimationFrame, Date, randomness, network assets, or user secrets.
- Ensure important content is visibly rendered at the target frame; do not leave it permanently at opacity 0.
- Call write_composition with the complete updated HTML and a concise Chinese summary of what changed and from which frame.`;

function createGatewayModels(){
 const baseUrl=(process.env.MODEL_BASE_URL||"https://xcpcai.com/v1").replace(/\/$/,"");
 const modelId=process.env.PI_MODEL||"gpt-5.6-sol";
 if(!process.env.MODEL_API_KEY)throw new Error("MODEL_API_KEY 未配置");
 const model={id:modelId,name:modelId,api:"openai-completions",provider:"openai-compatible",baseUrl,reasoning:false,input:["text"],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:128000,maxTokens:16000,compat:{supportsDeveloperRole:false,supportsReasoningEffort:false,supportsStrictMode:false,maxTokensField:"max_tokens"}};
 const provider=createProvider({id:"openai-compatible",name:"OpenAI Compatible",baseUrl,auth:{apiKey:envApiKeyAuth("Model API key",["MODEL_API_KEY"])},models:[model],api:openAICompletionsApi()});
 const models=createModels();models.setProvider(provider);return{models,model};
}

async function runCompositionAgent({systemPrompt,userPrompt}){
 const {models,model}=createGatewayModels();let written=null;
 const writeTool={name:"write_composition",label:"Write HyperFrames Composition",description:"Save the complete self-contained HyperFrames HTML composition that will be linted and rendered to MP4.",parameters:Type.Object({html:Type.String({description:"Complete HTML document"}),summary:Type.String({description:"Short Chinese description of the generated visual"})}),executionMode:"sequential",execute:async(_id,params)=>{if(!params.html.includes("data-composition-id=\"hypercut-main\"")||!params.html.includes("hf-seek"))throw new Error("HTML 缺少 HyperFrames composition 或 hf-seek 协议");written={html:params.html,summary:params.summary};return{content:[{type:"text",text:"Composition accepted and ready for HyperFrames lint/render."}],details:{summary:params.summary,bytes:params.html.length},terminate:true}}};
 const agent=new Agent({initialState:{systemPrompt,model,thinkingLevel:"off",tools:[writeTool]},streamFn:models.streamSimple.bind(models)});
 let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;agent.abort()},300000);
 try{await agent.prompt(userPrompt)}finally{clearTimeout(timeout)}
 if(timedOut&&!written)throw new Error(`${model.id} 在 5 分钟内未响应，请稍后重试`);
 if(!written)throw new Error(agent.state.errorMessage||"模型没有调用 write_composition");
 return{...written,model:model.id};
}

export function generateCompositionWithPiAgent({prompt,seed,style,segment}){
 const seg=segment?`\n\n【分段信息 · 务必遵守】你在生成整体视频的第 ${segment.index+1}/${segment.count} 段（整体共 ${segment.total} 秒）。本段时长 ${segment.duration} 秒，根元素 data-duration="${segment.duration}"。本段时间轴从 0 秒开始（不要用 ${segment.start} 作为起始时间，也不要生成 ${segment.total} 秒的完整视频）。内容上承接整体叙事：本段讲述第 ${segment.start}–${segment.start+segment.duration} 秒的剧情。`:`\n\n目标时长：${seed.duration} 秒，data-duration="${seed.duration}"。`;
 const continuity=segment?.previousHtml?`\n\n【上一段画面 · 必须延续】以下是前一段（第 ${segment.index} 段）已经生成并渲染的完整 HyperFrames HTML。请仔细阅读它的配色、字体、构图、叙事主体与最后出现的画面，让本段自然承接上一段的结尾——延续上一段最后出现的场景、主体、文字或情绪，不要突然切换成无关主题或全新风格。生成的是"新的画面"而不是照抄上一段，但必须保证视觉与叙事连续。\n\n${segment.previousHtml}`:"";
 return runCompositionAgent({systemPrompt:SYSTEM_PROMPT,userPrompt:`用户需求：${prompt}\n\n${style?.template??"请自行设计合适的视觉风格。"}\n\n建议标题：${seed.title}\n建议配色：${seed.palette.join(", ")}${seg}${continuity}\n帧率：24 fps\n请直接设计并调用 write_composition。`});
}

export function modifyCompositionWithPiAgent({prompt,html,targetFrame,fps=24}){
 const targetTime=targetFrame/fps;
 return runCompositionAgent({systemPrompt:EDIT_SYSTEM_PROMPT,userPrompt:`修改需求：${prompt}\n目标帧：${targetFrame}\n目标时间：${targetTime.toFixed(3)} 秒\n帧率：${fps} fps\n\n下面是当前正在使用的完整 HyperFrames HTML。请基于它增量修改，保留无关内容：\n\n${html}`});
}
