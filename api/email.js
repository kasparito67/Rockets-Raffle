// Utilitaire serveur. Ne pas appeler directement depuis le navigateur.
export async function sendReservationEmail({email,name,player,numbers}){
 const key=process.env.RESEND_API_KEY,from=process.env.EMAIL_FROM,payment=process.env.INTERAC_EMAIL||'dunstonca@yahoo.fr';
 if(!key||!from||!payment)return {sent:false,reason:'not_configured'};
 const total=numbers.length*20;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;',"'":'&#39;'}[c]));
 const html='<h2>Rockets du Nord — Réservation reçue</h2><p>Bonjour '+escape(name)+',</p><p>Nous avons reçu votre réservation pour soutenir <strong>'+escape(player)+'</strong>.</p><p>Numéros : <strong>'+numbers.join(', ')+'</strong><br>Montant à payer : <strong>'+total+' $</strong></p><p>Veuillez envoyer votre virement Interac à : <strong>'+escape(payment)+'</strong>.</p><p>Votre réservation est en attente de confirmation du paiement. Ce message ne constitue pas un reçu de paiement.</p><p>Merci de soutenir les Rockets du Nord!</p>';
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:'Rockets du Nord — Réservation de '+numbers.length+' numéro(s) ('+total+' $)',html})});
 if(!r.ok){console.error('Resend email failed',r.status);return {sent:false,reason:'provider_error'}}
 return {sent:true};
}
