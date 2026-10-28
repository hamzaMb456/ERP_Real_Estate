# Passation — Vitrine publique, tranche 1 (location et vente en ligne)

Date : 2026-10-22 · Branche `vitrine` (rien n'est poussé, rien n'est appliqué sur le backend de l'époque)
Plan : `docs/superpowers/plans/2026-10-22-front-office-slice-1.md` · Spec : `docs/superpowers/specs/2026-10-22-front-office-design.md`

## Ce qui a changé

- L'ERP vit maintenant sous `/erp` (`/erp/biens`, `/erp/baux`, `/erp/connexion`…). Les anciens liens (`/biens`, `/baux/123?onglet=loyers`, `/connexion`, liens des e-mails) redirigent vers `/erp/...` en gardant chemin et paramètres.
- Le site public est à la racine : `/` (accueil), `/louer`, `/acheter`, `/logement/<id>`. Il lit uniquement deux vues (`public_listings`, `public_listing_photos`) avec le rôle `public` de la couche de données, sans connexion.
- Nouvelle carte « Publication » sur la fiche d'une unité (ERP) : créer, publier, mettre en pause, clôturer une annonce.

## À faire, dans cet ordre

1. **Base de données.** Dans l'éditeur SQL de la console du backend de l'époque (« Track this » désactivé), copiez `db/migrations/0005_listings.sql` (`Get-Content -Raw -Encoding UTF8 … | Set-Clipboard`), exécutez, puis `db/seeds/0005_listings.sql` (deux annonces en brouillon, sans photo).
   *Vérifier :* `select count(*) from public.listings;` renvoie 2 ; `select * from public.public_listings;` renvoie 0 ligne (rien n'est publié).
2. **Rôle public.** Rien à faire : le backend refuse les variables d'environnement dont le nom commence par `HASURA_` et utilise déjà `public` comme rôle des requêtes sans connexion. Les permissions de l'étape 3 s'y rattachent.
   *Vérifier :* à l'étape 5 (test GraphQL sans connexion). Si l'accès échoue alors que l'étape 3 est faite, le rôle non authentifié de votre projet n'est pas `public` : dites-le-moi.
3. **Permissions de la couche de données.** Depuis la racine du dépôt, `$env:HASURA_ADMIN_SECRET` renseigné (jamais écrit dans un fichier) : d'abord `node scripts/apply-hasura-permissions.mjs --dry-run`, qui doit finir par `Dry run: 23 tracked tables/views, 54 relationships, 175 permissions, 6 functions. Nothing sent.`, puis sans `--dry-run`. Le script ajoute aussi `allow_aggregations` pour le rôle `public` sur `public_listings` (compteurs de l'accueil). On peut le relancer sans risque.
   *Vérifier :* `node scripts/check-hasura.mjs` affiche `tracked` pour `public.listings`, `public.public_listings` et `public.public_listing_photos` (ces trois noms figurent dans sa liste `EXPECTED`) et ne signale aucune métadonnée incohérente. L'accès sans connexion se vérifie à l'étape 5 (test GraphQL).
4. **Variables du site.** Dans `web/.env.local` : `NEXT_PUBLIC_AGENCY_ORG_ID` (résultat de `select id from organizations;`), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AGENCY_PHONE`, `NEXT_PUBLIC_AGENCY_EMAIL`, `NEXT_PUBLIC_AGENCY_ADDRESS` (modèle : `web/.env.example`). Puis `docker compose up -d --force-recreate web` (un simple `restart` ne relit pas `.env.local`).
   **Important :** les adresses canoniques et les aperçus de partage (Open Graph) utilisent `NEXT_PUBLIC_SITE_URL` et retombent sur `http://localhost:3000` si elle est vide. Mettez l'URL publique réelle avant toute mise en ligne.
   *Vérifier :* `http://localhost:3000/` s'affiche (menu, pied de page avec vos coordonnées), `/louer` affiche « aucun logement » sans erreur.
5. **Publier une première unité.** Dans l'ERP, ouvrez une unité **libre** (ou en vente pour une annonce de vente) qui a **au moins une photo** (onglet Photos), carte « Publication » → « Créer une annonce » → titre, prix → « Publier ». Règles : l'unité et son bien ne sont pas archivés ; location = unité libre, ou louée avec un bail qui finit dans les 90 jours et une date de disponibilité postérieure ; vente = unité « à vendre » ou louée ; un prix ; une photo. Une seule annonce ouverte par unité et par type. Messages possibles :
   - « Indiquez un prix avant de publier. »
   - « Ajoutez au moins une photo du logement avant de publier. »
   - « Ce logement est archivé : il ne peut pas être publié. »
   - « Ce logement ne peut pas être mis en location maintenant (il doit être libre, ou loué avec un bail qui se termine dans les 90 jours). »
   - « Ce logement ne peut pas être mis en vente (il doit être « à vendre » ou loué). »

   *Vérifier :* déconnecté (fenêtre privée), `/louer` montre la carte avec sa photo, un clic ouvre la fiche. Les pages publiques sont mises en cache quelques minutes : un changement peut mettre 1 à 5 minutes à apparaître.
   **Test des photos anonymes :** dans la fenêtre privée, faites un clic droit sur la photo de la carte → « Ouvrir l'image dans un nouvel onglet ». Si elle s'affiche, c'est bon. Sinon (403/404), prévenez-moi : il faudra élargir dans le script les colonnes publiques de `storage.files` (`bucket_id`, `name`, `etag`, `is_uploaded`, `created_at`) et ajouter un `select` sur `storage.buckets` (modification du script, à faire par moi).
   **Test GraphQL sans connexion** (aucun en-tête d'autorisation ; remplacez `<SOUS-DOMAINE>` et `<REGION>` par `NEXT_PUBLIC_NHOST_SUBDOMAIN` / `NEXT_PUBLIC_NHOST_REGION`). PowerShell :
   `Invoke-RestMethod -Method Post -Uri "https://<SOUS-DOMAINE>.graphql.<REGION>.nhost.run/v1" -ContentType "application/json" -Body '{"query":"{ public_listings(limit: 1) { id title } }"}' | ConvertTo-Json -Depth 6`
   Bash : `curl -s "https://<SOUS-DOMAINE>.graphql.<REGION>.nhost.run/v1" -H "Content-Type: application/json" -d '{"query":"{ public_listings(limit: 1) { id title } }"}'`.
   Attendu : des données (liste vide si rien n'est publié), pas d'erreur `field not found` ni `access-denied`.
6. **Test de bout en bout.** Avec vos identifiants de test (`web/.env.test.local` : `E2E_EMAIL`, `E2E_PASSWORD`) : `cd web; $env:E2E_BASE_URL = 'http://localhost:3000'; npx playwright test e2e/front-office.spec.ts` (le `$env:E2E_BASE_URL` fait viser le serveur Docker déjà lancé au lieu d'en démarrer un autre ; en Bash : `E2E_BASE_URL=http://localhost:3000 npx playwright test …`). Le test crée son propre bien, une unité, une photo, publie « Appartement test E2E » à 1 234 TND, le voit sur `/louer` en visiteur, le clôture, puis archive le bien (durée : plusieurs minutes, à cause du cache). Supprimez ensuite `web/test-results`.

## Limites connues / reporté

- **Page introuvable = statut HTTP 200** (avec `noindex`), pas 404 : le rendu en flux de Next ne permet pas autrement. Suite possible : un contrôle d'existence dans `proxy.ts`.
- Le rôle `public` de la couche de données n'a pas de filtre par organisation : n'importe qui peut interroger les annonces publiées de toutes les organisations ; le site filtre sur `NEXT_PUBLIC_AGENCY_ORG_ID` et le modèle est une agence par déploiement (spec F5/R7).
- Le bandeau de l'accueil est une illustration SVG : remplacez-la par une vraie photo dans `web/public/site/hero.svg` (même chemin).
- Les pages « Mentions légales » et « Confidentialité » ne sont pas rédigées (liens inertes).
- Favoris, alertes et dépôt de dossier en ligne affichent « Bientôt » jusqu'aux tranches 2 à 4.
- Points mineurs : une annonce de vente d'une unité ensuite vendue reste visible côté base (le site la masque) ; renouveler un bail ne revérifie pas l'annonce de location ; remise en ligne d'une annonce clôturée non bloquée en base ; pause/clôture abandonnent les modifications non enregistrées du formulaire ; pas de plafond sur le prix ; compteurs de l'accueil à « 0 » si le serveur est injoignable ; « Similaires » ne regarde que les 12 annonces les plus récentes de la ville.

## À tester avec le vrai serveur (non vérifié ici)

1. **Clôturer / rouvrir une annonce** : les rédacteurs (org_admin, manager) peuvent modifier le statut, `closed_reason` et les champs de contenu d'une annonce, mais **pas** `unit_id`, `kind`, `published_at` ni `organization_id`. Une annonce clôturée peut encore repasser à `published` par une mise à jour du statut : l'interface ne le fait jamais (il faut créer une nouvelle annonce). À vérifier : clôturer une annonce, la voir disparaître du site, puis créer une nouvelle annonce sur la même unité.
2. **Équipements** (`amenities`, tableau texte) : l'écriture depuis le formulaire passe par la couche de données ; cochez quelques équipements, enregistrez, rechargez, vérifiez qu'ils sont conservés et affichés sur la fiche publique.
3. **Filtre de la couche de données sur le stockage** : la lecture publique des photos passe par un filtre de relation sur `storage.files` ; c'est ce que contrôle le « test des photos anonymes » (étape 5). Vérifiez aussi qu'une photo d'une unité **non publiée** reste inaccessible sans connexion.

## Vérifié ici

`tsc`, `eslint`, 535 tests vitest, `npm run build` ; tests SQL 0002 à 0005 sur Postgres local (`OK: all`) ; `apply-hasura-permissions.mjs --dry-run`. **Non vérifié :** tout ce qui touche le vrai backend de l'époque, le test Playwright, un navigateur connecté.
