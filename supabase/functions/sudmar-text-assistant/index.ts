import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = new Set([
  "https://javi-jim2026.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
]);
const MODES = new Set(["orthography", "clarity", "technical", "title"]);
const buckets = new Map<string,{start:number,count:number}>();

function cors(origin:string){
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-sudmar-client",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(origin:string,status:number,body:unknown){
  return new Response(JSON.stringify(body),{status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8"}});
}
function rateLimited(ip:string){
  const now=Date.now(),windowMs=5*60*1000,limit=30;
  const current=buckets.get(ip);
  if(!current||now-current.start>windowMs){buckets.set(ip,{start:now,count:1});return false;}
  current.count+=1;return current.count>limit;
}
function extractOutput(data:any){
  if(typeof data?.output_text==="string")return data.output_text.trim();
  const parts:Array<string>=[];
  for(const item of data?.output||[])for(const content of item?.content||[])if(content?.type==="output_text"&&typeof content?.text==="string")parts.push(content.text);
  return parts.join("\n").trim();
}
function modeInstruction(mode:string){
  if(mode==="orthography")return "Corrige únicamente ortografía, acentos, puntuación, concordancia y errores de escritura. Conserva el vocabulario, orden y sentido original tanto como sea posible.";
  if(mode==="clarity")return "Mejora claridad, coherencia y fluidez. Puedes reorganizar frases, pero no agregues hechos, diagnósticos, causas ni conclusiones que no estén en el texto.";
  if(mode==="technical")return "Convierte el texto a una redacción técnica, profesional, precisa y clara para una bitácora de servicio. No agregues hechos ni inferencias; conserva exactamente el significado operativo.";
  return "Genera un título breve, profesional y fácil de identificar para un ticket. Máximo 80 caracteres. Evita frases como 'El cliente reporta que'. Devuelve solo el título.";
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS"){
    if(origin&&ALLOWED_ORIGINS.has(origin))return new Response(null,{status:204,headers:cors(origin)});
    return new Response(null,{status:403});
  }
  if(req.method!=="POST")return json(origin||"null",405,{error:"Método no permitido."});
  if(!origin||!ALLOWED_ORIGINS.has(origin))return json(origin||"null",403,{error:"Origen no autorizado."});
  if(req.headers.get("x-sudmar-client")!=="service-platform")return json(origin,403,{error:"Cliente no autorizado."});
  const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||req.headers.get("cf-connecting-ip")||"unknown";
  if(rateLimited(ip))return json(origin,429,{error:"Demasiadas solicitudes. Intenta nuevamente en unos minutos."});

  let payload:any;try{payload=await req.json();}catch{return json(origin,400,{error:"Solicitud inválida."});}
  const mode=String(payload?.mode||"");
  const text=String(payload?.text||"").trim();
  const protectedTerms=Array.isArray(payload?.protectedTerms)?payload.protectedTerms.map((x:any)=>String(x).trim()).filter(Boolean).slice(0,80):[];
  if(!MODES.has(mode))return json(origin,400,{error:"Modo de redacción no válido."});
  if(text.length<2||text.length>20000)return json(origin,400,{error:"El texto debe tener entre 2 y 20,000 caracteres."});

  const apiKey=Deno.env.get("OPENAI_API_KEY");
  if(!apiKey)return json(origin,503,{error:"El asistente de IA requiere configurar OPENAI_API_KEY en Supabase."});
  const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
  const protectedNote=protectedTerms.length?`\nTérminos y valores protegidos: ${protectedTerms.map(t=>`«${t}»`).join(", ")}. No los cambies, corrijas, traduzcas ni alteres.`:"";
  const instructions=`Eres el asistente de redacción técnica de SUDMAR ENERGY. ${modeInstruction(mode)}\nReglas obligatorias: no inventes información; no cambies modelos, números de serie, voltajes, corrientes, frecuencias, potencias, cantidades, unidades, nombres de componentes ni datos técnicos. Devuelve únicamente el texto propuesto, sin explicación, sin comillas y sin encabezados.${protectedNote}`;
  try{
    const ai=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model,instructions,input:text,store:false,max_output_tokens:mode==="title"?120:1800,reasoning:{effort:"none"}})
    });
    const data=await ai.json();
    if(!ai.ok)return json(origin,502,{error:data?.error?.message||"No se pudo procesar la redacción con IA."});
    let output=extractOutput(data).replace(/^['\"“”]+|['\"“”]+$/g,"").trim();
    if(!output)return json(origin,502,{error:"La IA no devolvió texto."});
    if(mode==="title"&&output.length>80){const cut=output.slice(0,81);const space=cut.lastIndexOf(" ");output=(space>52?cut.slice(0,space):output.slice(0,80)).replace(/[\s.,;:]+$/g,"");}
    if(mode!=="title"){
      const missing=protectedTerms.filter(term=>!output.includes(term));
      if(missing.length)return json(origin,422,{error:"La propuesta intentó modificar datos técnicos protegidos. No se aplicó ningún cambio."});
    }
    return json(origin,200,{text:output,model});
  }catch(error){
    return json(origin,502,{error:error instanceof Error?error.message:"No se pudo conectar con el asistente de IA."});
  }
});
