# Rockets du Nord — réservations partagées

## Installation Supabase
1. Créer un projet sur https://supabase.com/dashboard.
2. Ouvrir **SQL Editor** et exécuter le contenu de `supabase/schema.sql`.
3. Dans **Project Settings > API**, relever l'URL du projet et la clé **service_role** (secret).
4. Dans Vercel > Project > Settings > Environment Variables, ajouter :
   - `SUPABASE_URL` = URL du projet (https://....supabase.co)
   - `SUPABASE_SERVICE_ROLE_KEY` = clé secrète service_role.
5. Redéployer Vercel.

**Ne jamais mettre la clé service_role dans GitHub, le HTML ou les variables VITE_/NEXT_PUBLIC_.**

## Fonctionnement
- `GET /api/reservations` retourne uniquement numéro et joueur, jamais les coordonnées.
- `POST /api/reservations` réserve atomiquement 1 à 20 numéros avec le joueur et les coordonnées.
- La contrainte unique interdit les doublons même lors de réservations simultanées.
- Les réservations restent en attente de paiement jusqu'à confirmation manuelle dans Supabase.
- Le site conserve son mode démo local si les API ne sont pas configurées.

## Avant diffusion publique
Prévoir protection anti-spam / CAPTCHA et limites de débit côté serveur; vérifier la conformité du tirage au Québec et les règles d'hébergement Vercel Hobby. Les données personnelles ne sont pas publiques, mais l'accès à Supabase doit être limité aux organisateurs.


## Administration privée
1. Exécuter `supabase/admin.sql` dans SQL Editor.
2. Dans Supabase > Authentication > Users, créer votre compte utilisateur avec votre courriel et un mot de passe fort.
3. Dans SQL Editor, exécuter l'instruction `insert into public.raffle_admins ...` indiquée en commentaire dans `supabase/admin.sql` en remplaçant l'adresse.
4. Dans Vercel, ajouter `SUPABASE_ANON_KEY` (clé publique anon / legacy anon de Supabase, utilisée uniquement côté serveur pour authentifier).
5. Redéployer. Se connecter à `/admin` (Vercel cleanUrls) ou `/admin.html`.
6. Pour transférer l'accès à la gérante : créer son utilisateur Supabase Auth, l'ajouter à `raffle_admins`, puis supprimer l'ancien accès.

## Courriel automatique
1. Créer un compte chez Resend (https://resend.com), vérifier un domaine d'expédition autorisé.
2. Ajouter dans Vercel : `RESEND_API_KEY`, `EMAIL_FROM` (ex. Rockets du Nord <tirage@votredomaine.ca>), `INTERAC_EMAIL` (adresse de réception des paiements).
3. Redéployer et faire un essai avec une adresse courriel que vous contrôlez.
4. Si Resend n'est pas configuré, la réservation fonctionne sans courriel. La réponse API contient `emailSent:false`. Aucun faux courriel n'est envoyé.

**Avant ouverture publique :** configurer une protection contre le spam et les abus (limites de débit, CAPTCHA), ainsi qu'une politique de confidentialité et les conditions du tirage. Le système ne vérifie pas automatiquement les virements Interac. Une erreur d'envoi de courriel ne supprime pas la réservation.
