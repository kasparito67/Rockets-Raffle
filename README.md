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
