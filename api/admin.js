const base=process.env.SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY,anon=process.env.SUPABASE_ANON_KEY;
const headers=k=>({apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'});
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!base||!service||!anon)return res.status(503).json({error:'Administration non configurée'});
 if(req.method==='POST'&&req.query.action==='login'){
  const {email,password}=req.body||{};
  if(typeof email!=='string'||typeof password!=='string')return res.status(400).json({error:'Identifiants requis'});
  const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:headers(anon),body:JSON.stringify({email,password})});
  if(!r.ok)return res.status(401).json({error:'Connexion refusée'});
  const data=await r.json();
  const check=await fetch(base+'/rest/v1/raffle_admins?select=user_id&user_id=eq.'+encodeURIComponent(data.user.id),{headers:headers(service)});
  if(!check.ok||!(await check.json()).length)return res.status(403).json({error:'Accès administrateur non autorisé'});
  return res.status(200).json({access_token:data.access_token,expires_in:data.expires_in});
 }
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(!token)return res.status(401).json({error:'Connexion requise'});
 const userR=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}});
 if(!userR.ok)return res.status(401).json({error:'Session expirée'});
 const user=await userR.json();
 const adminR=await fetch(base+'/rest/v1/raffle_admins?select=user_id&user_id=eq.'+encodeURIComponent(user.id),{headers:headers(service)});
 if(!adminR.ok||!(await adminR.json()).length)return res.status(403).json({error:'Accès refusé'});
 if(req.method==='GET'){
  const r=await fetch(base+'/rest/v1/reservations?select=id,number,player,buyer_name,buyer_email,status,created_at&order=number.asc',{headers:headers(service)});
  if(!r.ok)return res.status(500).json({error:'Lecture impossible'});
  return res.status(200).json(await r.json());
 }
 if(req.method==='POST'){
  const {id,action}=req.body||{};
  if(!Number.isSafeInteger(id)||id<1||!['paid','pending','release'].includes(action))return res.status(400).json({error:'Action invalide'});
  const endpoint=base+'/rest/v1/reservations?id=eq.'+id;
  const r=await fetch(endpoint,{method:action==='release'?'DELETE':'PATCH',headers:{...headers(service),Prefer:'return=minimal'},...(action==='release'?{}:{body:JSON.stringify({status:action})})});
  if(!r.ok)return res.status(500).json({error:'Modification impossible'});
  return res.status(200).json({ok:true});
 }
 return res.status(405).json({error:'Méthode non autorisée'});
}
