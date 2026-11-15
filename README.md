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
- Si les API ou les validations nécessaires manquent, le site bloque les nouvelles réservations.

## Avant diffusion publique
Prévoir protection anti-spam / CAPTCHA et limites de débit côté serveur; vérifier la conformité du tirage au Québec et les règles d'hébergement Vercel Hobby. Les données personnelles ne sont pas publiques, mais l'accès à Supabase doit être limité aux organisateurs.


## Administration privée
1. Exécuter `supabase/admin.sql` dans SQL Editor.
2. Dans Supabase > Authentication > Users, créer votre compte utilisateur avec votre courriel et un mot de passe fort.
3. Dans SQL Editor, exécuter l'instruction `insert into public.raffle_admins ...` indiquée en commentaire dans `supabase/admin.sql` en remplaçant l'adresse.
4. Dans Vercel, ajouter `SUPABASE_ANON_KEY` (clé publique anon / legacy anon de Supabase, utilisée uniquement côté serveur pour authentifier).
5. Redéployer. Se connecter à `/admin` (Vercel cleanUrls) ou `/admin.html`.
6. Pour transférer l'accès à la gérante : créer son utilisateur Supabase Auth, l'ajouter à `raffle_admins`, puis supprimer l'ancien accès.

## Courriels Gmail et ouverture des réservations

L’envoi est exclusivement côté serveur dans `lib/email.js` (aucune route d’envoi publique).
La réservation et ses deux tâches courriel sont créées dans une même transaction SQL.
Le formulaire conserve temporairement la demande en session pour reprendre une réponse réseau perdue avec le même UUID. Un rafraîchissement n’envoie aucun courriel.

### Mise en service par le responsable technique

1. Exécuter `supabase/email-migration.sql` après `schema.sql`. Migration additive, sans suppression des réservations existantes. Elle ne reconstitue pas les transactions historiques et n’envoie aucun courriel historique.
2. Configurer dans Vercel, dans l’environnement explicitement ciblé :
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` : secrets serveur uniquement.
   - `GMAIL_SENDER_EMAIL=rocketsdunord.m11bb.tirage@gmail.com`.
   - `RAFFLE_ADMIN_EMAIL` : destinataire confirmé par l’organisateur, pas déduit de l’expéditeur.
   - `INTERAC_EMAIL` : destinataire des virements, à confirmer. L’ancienne adresse n’est pas une preuve de validité.
   - `INTERAC_QUESTION` et `INTERAC_ANSWER` : facultatifs, affichés seulement si les deux valeurs officielles existent.
3. Renouveler l’autorisation Google avec le compte officiel et la seule portée `https://www.googleapis.com/auth/gmail.send`. Révoquer les anciens jetons exposés via les connexions tierces du compte Google, puis obtenir un nouveau refresh token et l’enregistrer directement dans Vercel, jamais dans le chat, GitHub ou les logs. Si le secret client lui-même a été exposé, le remplacer également. L’API cible explicitement l’adresse officielle comme `userId`; un jeton d’un autre compte doit échouer au lieu d’expédier avec ce compte.
4. Vérifier l’écran de consentement Google : en mode **External / Testing**, les refresh tokens associés à `gmail.send` expirent normalement après **7 jours**. Passer à un statut de production approprié; Google peut demander la vérification de l’application selon son audience et ses portées. Le statut Production ne rend pas un jeton immortel : révocation, inactivité, changement de mot de passe ou politiques du compte peuvent l’invalider. Prévoir le suivi du journal admin et la réautorisation en cas de `auth_error`; aucun renouvellement ne contourne une révocation Google.
5. Positionner `GMAIL_ACCOUNT_CONFIRMED=true` seulement après vérification du compte et du consentement. `PAYMENT_DETAILS_CONFIRMED=true` seulement après validation de l’adresse Interac et de ses éventuelles instructions de sécurité. `RAFFLE_LIVE_ENABLED=true` seulement après validation des conditions, de la conformité et des protections contre les abus. Par défaut, les nouvelles réservations sont fermées; la grille reste consultable. Ces drapeaux attestent une validation humaine, ils ne la réalisent pas.
6. Redéployer d’abord une préversion avec une base de test isolée. Ne pas activer la préversion contre la base de production. Ne supprimer aucune ancienne variable Resend avant validation complète de Gmail.
7. Un essai avec envoi réel et réservation réelle exige la permission explicite de l’utilisateur. Aucun essai réel n’est effectué par les tests automatisés.

### Journal et reprise

Dans `/admin`, le journal distingue acheteur et organisateur, avec états `pending`, `sending`, `accepted`, `failed`, `unknown`. **Accepted signifie accepté par Gmail, pas livré.** Le bouton Réessayer réclame atomiquement les tâches en attente ou échouées du groupe; les tâches déjà acceptées ne sont pas renvoyées. Le journal expose seulement des codes d’erreur, jamais les jetons ou le corps des courriels dans les logs.

Un timeout réseau, un HTTP 408/5xx, une interruption après l’appel Gmail ou une erreur de persistance peuvent laisser un résultat `unknown` ou `sending`. Ces tâches ne sont jamais reprises automatiquement : un responsable vérifie les éléments envoyés du compte officiel avant de réinitialiser uniquement la tâche dont l’absence d’envoi est confirmée. La portée `gmail.send` ne permet pas au site de consulter les messages envoyés. Aucun système ne garantit une seule livraison entre deux services sans mécanisme d’idempotence du fournisseur; le choix ici est de bloquer les cas ambigus.

La reprise ne recrée jamais les numéros. Une réservation dont une partie des numéros a été libérée ne peut plus faire l’objet d’un renvoi automatique des anciennes instructions. Les anciennes réservations n’ont pas de groupe et conservent leurs contrôles de paiement habituels.

Il n’y a pas de relance planifiée : les échecs restent visibles jusqu’à reprise par un administrateur. Pour un suivi sans surveillance manuelle, ajouter ultérieurement une alerte ou une file de traitement, avec la même règle de blocage des résultats ambigus.

### Vérification locale

`npm ci`, puis `npx playwright install --with-deps chromium` si aucun Chromium système n’est disponible, puis `npm test`.
Les tests utilisent PostgreSQL embarqué (PGlite) pour les transactions et un navigateur Chromium à 390 px. Gmail est simulé; aucune base distante n’est utilisée. Ils vérifient notamment les conflits de numéro, l’atomicité, la reprise du même UUID, les erreurs Gmail, les notifications séparées et l’affichage mobile. Une vraie concurrence entre connexions PostgreSQL distinctes et les permissions du projet Supabase doivent aussi être validées sur une base de préproduction avant mise en service.
