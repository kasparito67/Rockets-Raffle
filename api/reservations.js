const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const roster=['Paul Bédard','Lorenzo Cannistraro','Noah Caspar','Hector Cusson','Alexis Gaudreau','Nathan Greffard','Keyshawn Henry','Félix Huard-Roy','Olivier Jolicoeur','Henri Moncion Gaudet','Nathan Robert','Équipe entière'];
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!url||!key)return res.status(503).json({error:'Base de données non configurée'});
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Méthode non autorisée'});
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  try{
    if(req.method==='GET'){
      const r=await fetch(url+'/rest/v1/reservations?select=number,player&order=number.asc',{headers,cache:'no-store'});
      if(!r.ok)throw Error('Supabase GET '+r.status);
      return res.status(200).json(await r.json());
    }
    const b=req.body||{},numbers=b.numbers,player=b.player,name=b.name,email=b.email;
    if(!Array.isArray(numbers)||numbers.length<1||numbers.length>20||new Set(numbers).size!==numbers.length||numbers.some(n=>!Number.isInteger(n)||n<1||n>200)||!roster.includes(player)||typeof name!=='string'||name.trim().length<2||name.length>120||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Informations invalides'});
    const r=await fetch(url+'/rest/v1/rpc/reserve_numbers',{method:'POST',headers,body:JSON.stringify({p_numbers:numbers,p_player:player,p_buyer_name:name.trim(),p_buyer_email:email.trim()})});
    if(!r.ok){const details=await r.text();if(r.status===409||details.includes('23505'))return res.status(409).json({error:'Un numéro vient d’être réservé. Actualisez la grille.'});throw Error('Supabase POST '+r.status)}
    return res.status(201).json({ok:true});
  }catch(e){console.error(e);return res.status(500).json({error:'Erreur du serveur'})}
}