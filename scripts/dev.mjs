import net from "node:net";
import { spawn } from "node:child_process";

const webUrl="http://localhost:5173/",apiHealthUrl="http://localhost:8787/api/health";

async function responds(url,validate=()=>true){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1200);
  try{const response=await fetch(url,{signal:controller.signal});return response.ok&&validate(response);}catch{return false;}finally{clearTimeout(timer);}
}
function portAvailable(port){
  return new Promise(resolve=>{const server=net.createServer();server.unref();server.once("error",()=>resolve(false));server.listen(port,()=>server.close(()=>resolve(true)));});
}

async function main(){
  const [webRunning,apiRunning]=await Promise.all([
    responds(webUrl,response=>(response.headers.get("content-type")||"").includes("text/html")),
    responds(apiHealthUrl),
  ]);
  if(webRunning&&apiRunning){
    console.log("RuralCare Connect is already running.");
    console.log("Web: http://localhost:5173/");
    console.log("API: http://localhost:8787/api/health");
    return 0;
  }
  const [webPortFree,apiPortFree]=await Promise.all([portAvailable(5173),portAvailable(8787)]);
  if(!webPortFree||!apiPortFree){
    const blocked=[!webPortFree?"5173 (web)":null,!apiPortFree?"8787 (API)":null].filter(Boolean).join(", ");
    console.error(`Cannot start RuralCare because ${blocked} ${blocked.includes(",")?"are":"is"} already used by another process.`);
    console.error("Close the older terminal or application using that port, then run npm run dev again.");
    return 1;
  }
  return await new Promise(resolve=>{
    const child=process.platform==="win32"
      ?spawn(process.env.ComSpec||"cmd.exe",["/d","/s","/c","npm run dev:start"],{cwd:process.cwd(),stdio:"inherit",env:process.env})
      :spawn("npm",["run","dev:start"],{cwd:process.cwd(),stdio:"inherit",env:process.env});
    for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>{if(!child.killed)child.kill(signal);});
    child.on("error",error=>{console.error(`Could not start RuralCare: ${error.message}`);resolve(1);});
    child.on("exit",code=>resolve(code??0));
  });
}

process.exitCode=await main();
