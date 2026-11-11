// Envoi uniquement côté serveur via Gmail API (OAuth 2.0).
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanHeader = value => String(value).replace(/[\r\n]/g, ' ').trim();
const encodeHeader = value => '=?UTF-8?B?' + Buffer.from(cleanHeader(value), 'utf8').toString('base64') + '?=';
const mailbox = value => cleanHeader(value).replace(/[<>]/g, '');
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function gmailAccessToken() {
  const {GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN} = process.env;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID, client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token'
    })
  });
  if (!response.ok) throw new Error('Gmail OAuth HTTP ' + response.status);
  const data = await response.json();
  if (!data.access_token) throw new Error('Gmail OAuth access_token missing');
  return data.access_token;
}

async function sendGmail({token, to, from, subject, html}) {
  const mime = [
    'From: ' + encodeHeader('Rockets du Nord') + ' <' + mailbox(from) + '>',
    'To: <' + mailbox(to) + '>',
    'Subject: ' + encodeHeader(subject),
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64')
  ].join('\r\n');
  const raw = Buffer.from(mime, 'utf8').toString('base64url');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:'POST',
    headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json'},
    body:JSON.stringify({raw})
  });
  if (!response.ok) throw new Error('Gmail send HTTP ' + response.status);
  return response.json();
}

export async function sendReservationEmail({email, name, player, numbers}) {
  const {GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL, RAFFLE_ADMIN_EMAIL, INTERAC_EMAIL, INTERAC_QUESTION, INTERAC_ANSWER} = process.env;
  if (![GMAIL_CLIENT_ID,GMAIL_CLIENT_SECRET,GMAIL_REFRESH_TOKEN,GMAIL_SENDER_EMAIL].every(Boolean)) {
    console.error('Gmail non configuré : variables requises absentes');
    return {sent:false,adminSent:false,reason:'not_configured'};
  }
  if (!validEmail(email) || !validEmail(GMAIL_SENDER_EMAIL)) return {sent:false,adminSent:false,reason:'invalid_email'};
  const total = numbers.length * 20;
  const lines = numbers.join(', ');
  const transfer = validEmail(INTERAC_EMAIL || '') ? INTERAC_EMAIL : null;
  const paymentDetails = transfer
    ? '<p>Veuillez envoyer votre virement Interac à <strong>' + escapeHtml(transfer) + '</strong>.</p>'
      + (INTERAC_QUESTION && INTERAC_ANSWER ? '<p>Question de sécurité : <strong>' + escapeHtml(INTERAC_QUESTION) + '</strong><br>Réponse : <strong>' + escapeHtml(INTERAC_ANSWER) + '</strong></p>' : '')
    : '<p>Les instructions de paiement vous seront communiquées par l’équipe.</p>';
  const html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717">'
    + '<div style="background:#111;color:#ffd21a;padding:22px"><h1 style="margin:0">ROCKETS DU NORD</h1><p style="color:white">Confirmation de réservation</p></div>'
    + '<div style="padding:22px"><p>Bonjour ' + escapeHtml(name) + ',</p>'
    + '<p>Nous avons bien reçu votre réservation pour soutenir <strong>' + escapeHtml(player) + '</strong>.</p>'
    + '<p>Numéros : <strong>' + escapeHtml(lines) + '</strong><br>Quantité : <strong>' + numbers.length + '</strong><br>Montant à payer : <strong>' + total + ' $</strong></p>'
    + paymentDetails + '<p>Votre réservation est en attente de confirmation du paiement. Ceci n’est pas un reçu.</p>'
    + '<p>Merci de soutenir les Rockets du Nord !</p></div></div>';
  let token;
  try { token = await gmailAccessToken(); }
  catch(e) { console.error('Gmail auth:',e.message); return {sent:false,adminSent:false,reason:'auth_error'}; }
  let sent = false, adminSent = false;
  try {
    await sendGmail({token,to:email,from:GMAIL_SENDER_EMAIL,subject:'Rockets du Nord — Confirmation de réservation (' + total + ' $)',html});
    sent = true;
  } catch(e) { console.error('Gmail acheteur:',e.message); }
  if (RAFFLE_ADMIN_EMAIL && validEmail(RAFFLE_ADMIN_EMAIL)) {
    try {
      const adminHtml = '<h2>Nouvelle réservation — Rockets du Nord</h2><p>Nom : ' + escapeHtml(name) + '<br>Courriel : ' + escapeHtml(email) + '<br>Joueur : ' + escapeHtml(player) + '<br>Numéros : ' + escapeHtml(lines) + '<br>Montant attendu : ' + total + ' $</p><p>Paiement en attente de vérification.</p>';
      await sendGmail({token,to:RAFFLE_ADMIN_EMAIL,from:GMAIL_SENDER_EMAIL,subject:'Nouvelle réservation Rockets (' + total + ' $)',html:adminHtml});
      adminSent = true;
    } catch(e) { console.error('Gmail organisateur:',e.message); }
  }
  return {sent,adminSent,reason:sent?undefined:'send_error'};
}
