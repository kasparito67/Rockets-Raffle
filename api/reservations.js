import {db} from '../lib/db.js';
import {processEmails} from '../lib/outbox.js';
import {validEmail,validId,paymentsReady} from '../lib/validation.js';
const roster=['Paul Bédard','Lorenzo Cannistraro','Noah Caspar','Hector Cusson','Alexis Gaudreau','Nathan Greffard','Keyshawn Henry','Félix Huard-Roy','Olivier Jolicoeur','Henri Moncion Gaudet','Nathan Robert','Équipe entière'];
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Méthode non autorisée'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Base de données non configurée'});
  try{
    if(req.method==='GET')return res.status(200).json(await db('reservations?select=number,player&order=number.asc'));
    if(!paymentsReady())return res.status(503).json({error:'Les réservations ouvriront après validation des informations de paiement et des conditions du tirage.'});
    const {numbers,player,requestId}=req.body||{};
    const name=typeof req.body?.name==='string'?req.body.name.trim():'';
    const email=typeof req.body?.email==='string'?req.body.email.trim():'';
    if(!validId(requestId)||!Array.isArray(numbers)||numbers.length<1||numbers.length>20||new Set(numbers).size!==numbers.length||numbers.some(n=>!Number.isInteger(n)||n<1||n>200)||!roster.includes(player)||name.length<2||name.length>120||!validEmail(email))return res.status(400).json({error:'Informations invalides'});
    await db('rpc/reserve_with_emails',{method:'POST',body:{p_id:requestId,p_numbers:[...numbers].sort((a,b)=>a-b),p_player:player,p_name:name,p_email:email}});
    // Once committed, email failures must never turn this into a failed reservation.
    let emailStatus='pending';
    try { emailStatus=await processEmails(requestId); }
    catch { console.error('reservation_email_status_unavailable'); }
    return res.status(201).json({ok:true,reservationId:requestId,emailSent:emailStatus==='accepted',emailStatus});
  }catch(e){
    if(e.conflict)return res.status(409).json({error:'Un numéro est déjà réservé ou cette demande a changé. Actualisez la grille.'});
    console.error('reservation_database_error');
    return res.status(500).json({error:'Réponse de réservation indisponible. Réessayez la même demande pour vérifier son état.'});
  }
}
