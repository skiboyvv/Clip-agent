import { spawn } from "node:child_process";
const child=spawn(process.execPath,["server/index.mjs"],{stdio:["ignore","pipe","pipe"],env:{...process.env,HYPERCUT_AGENT_MODE:"local"}});
await new Promise((resolve,reject)=>{const started=Date.now();const poll=async()=>{if(Date.now()-started>15000)return reject(new Error("server did not start within 15 seconds"));try{await fetch("http://127.0.0.1:8787/api/health");return resolve()}catch{setTimeout(poll,250)}};child.once("error",reject);child.once("exit",code=>code&&reject(new Error(`server exited ${code}`)));poll()});
try{
 const health=await fetch("http://127.0.0.1:8787/api/health").then(r=>r.json());
 const created=await fetch("http://127.0.0.1:8787/api/agent/generate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:"生成科技感宣传片，标题是“端到端测试”"})}).then(r=>r.json());
 let job;for(let i=0;i<240;i++){await new Promise(r=>setTimeout(r,1000));job=await fetch(`http://127.0.0.1:8787/api/jobs/${created.jobId}`).then(r=>r.json());if(job.status==="complete"||job.status==="failed")break}
 if(!health.ok||!health.audio||job?.status!=="complete")throw new Error(job?.error||"render did not complete");
 const video=await fetch(`http://127.0.0.1:8787${job.videoUrl}`,{headers:{range:"bytes=0-1023"}});
 if(video.status!==206||!video.headers.get("content-type")?.includes("video/mp4"))throw new Error("video range playback endpoint failed");
 const source=await fetch(`http://127.0.0.1:8787/api/jobs/${created.jobId}/code`).then(r=>r.json());
 if(!source.code?.includes("data-composition-id=\"hypercut-main\"")||source.code.includes("MODEL_API_KEY"))throw new Error("generated-code endpoint failed");
 console.log(`OK: prompt → Agent code → HyperFrames render → playable MP4 (${video.headers.get("content-range")})`);
}finally{child.kill()}
