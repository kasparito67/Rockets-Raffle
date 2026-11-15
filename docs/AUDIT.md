# Audit de passation — Rockets du Nord

## État vérifié

- Dépôt inspecté sur `main`, commit `efe1810df99334a76e66ede2f4cd17edf0ac5746` : intégration Gmail présente.
- Site HTML/JavaScript et fonctions Vercel, sans Next.js. Base Supabase appelée côté serveur avec clé service role.
- Contrainte SQL unique sur le numéro et transaction de réservation : protection existante contre les doubles attributions. Lecture publique limitée au numéro et joueur.
- Site public accessible en HTTP 200 lors de l’audit; aucun POST réel ni envoi réel exécuté.
- Le statut GitHub du commit principal indique un déploiement Vercel réussi et un lien vers `kasper6/rockets-raffle`.
- L’outil Vercel connecté voit l’équipe KASPER (`kasper6`) mais retourne une liste de projets vide et des réponses 404 pour le projet et le déploiement. Cela ne prouve pas que le projet a disparu : l’accès effectif au projet reste à autoriser ou à corriger. Aucune variable ni valeur secrète inspectée.

## Corrections préparées dans cette branche

- Formulaire intégré mobile noir et jaune, validation du courriel, fin des prompt et instructions fictives.
- Nouvelle migration additive : groupement, identifiant de demande, transaction commune réservations/journal et prise exclusive des tâches courriel.
- Échec d’envoi indépendant de la réservation; résultats Gmail incertains bloqués; reprises depuis l’administration sans recréer les numéros.
- Identité officielle, résumé complet, prix unitaire, question/réponse seulement si configurées, destinataire organisateur configurable.
- Paramètres d’ouverture explicites : aucune ouverture publique implicite après déploiement.
- Tests sur base locale isolée et navigateur mobile; Gmail simulé. Les rôles et politiques Supabase réels, la concurrence entre connexions distinctes et la délivrabilité exigent encore une validation de préproduction.

## Blocages de mise en service

1. Autoriser ou rétablir l’accès Vercel au projet existant; vérifier ensuite les variables par environnement et les journaux de déploiement.
2. Vérifier le consentement Google du compte officiel. Révoquer les anciens jetons potentiellement exposés et renouveler l’autorisation minimale `gmail.send`. Aucun ancien jeton ne doit être réutilisé. Secrets à saisir dans une interface sécurisée uniquement.
3. Confirmer le destinataire Interac et celui de l’organisateur. L’adresse historique `dunstonca@yahoo.fr` n’est pas confirmée par l’audit.
4. Vérifier le statut Testing/Production de l’application Google et traiter la durée de vie de 7 jours en Testing. Documenté dans le README.
5. Appliquer la migration sur une base isolée puis en production avant le code, après revue; préserver les données existantes. Aucun accès Supabase direct disponible dans cette session.
6. Valider conditions du tirage, protections contre les abus et ouverture; obtenir la permission explicite avant tout test réel.

Aucune fusion sur main, migration distante ou mise en production effectuée pendant la préparation de cette branche. Une préversion automatique peut être déclenchée par GitHub/Vercel; son statut doit être vérifié séparément.
