import {db} from './db.js';
import {sendReservationEmail} from './email.js';
export async function processEmails(id) {
  const group=await db('reservation_groups?id=eq.'+id+'&select=id,buyer_name,buyer_email,player,numbers');
  if(!group?.length)throw Error('Reservation not found');
  const g=group[0];
  // Atomic database claim prevents concurrent requests/admin retries sending twice.
  const jobs=await db('rpc/claim_reservation_emails',{method:'POST',body:{p_id:id}});
  for(const job of jobs||[]) {
    const result=await sendReservationEmail({name:g.buyer_name,email:g.buyer_email,player:g.player,numbers:g.numbers},job.audience);
    // If persistence fails after Gmail accepted, leave "sending" for manual review.
    await db('reservation_emails?group_id=eq.'+id+'&audience=eq.'+job.audience,{method:'PATCH',body:{status:result.status,last_error:result.reason,updated_at:new Date().toISOString()}});
    console.info('reservation_email_result',{audience:job.audience,status:result.status,reason:result.reason});
  }
  const statuses=await db('reservation_emails?group_id=eq.'+id+'&audience=eq.buyer&select=status');
  return statuses?.[0]?.status||'pending';
}
