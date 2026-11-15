import {paymentsReady} from '../lib/validation.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'Méthode non autorisée'});
  return res.status(200).json({reservationsOpen:paymentsReady()});
}
