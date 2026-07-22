# Budget — suivi des postes de dépenses

SPA (Vite + React + TS) pour suivre l'état de postes de dépenses mensuels
(courses, loisirs, essence…) avec **report du solde** (positif ou négatif) d'un
mois sur l'autre. Hébergée en statique sur **GitHub Pages**, données dans
**Firebase Firestore**, accès protégé par un **compte Firebase partagé**.

## Comment ça marche

- Chaque poste a un **montant initial mensuel** (versionné : le changer n'altère
  pas les mois passés).
- Chaque **dépense** (montant, poste, description, date, utilisateur) se déduit
  du poste.
- Le **solde restant** est reporté au mois suivant : `départ(mois) = initial +
  report(mois‑1)`. Le report négatif est conservé (symétrique).
- Le **1er du mois**, tout « repart » automatiquement : le mois courant est
  simplement `mois(aujourd'hui)` et le solde est **recalculé** depuis le journal
  de dépenses (source de vérité). Pas de tâche planifiée, pas de serveur.
- Les mois passés sont consultables en **Historique** (lecture seule).

Le calcul (fold cumulé) est dans [src/lib/budget.ts](src/lib/budget.ts) et
couvert par [tests/budget.test.ts](tests/budget.test.ts).

## Développement

```bash
cp .env.example .env.local   # renseigner la config Firebase
npm install
npm run dev                  # http://localhost:5173
npm test                     # tests unitaires (vitest)
npm run lint                 # oxlint
npm run format               # oxfmt
npm run build                # build statique dans dist/
```

## Setup Firebase (une fois)

1. **Créer un projet** sur <https://console.firebase.google.com> puis une
   **application Web** → copier la config dans `.env.local` (`VITE_FIREBASE_*`).
2. **Authentication → Sign-in method → activer Email/Password.**
3. **Authentication → Users → Add user** : créer **un seul** compte partagé
   (e-mail + mot de passe fort). Renseigner l'e-mail dans
   `VITE_FIREBASE_ACCOUNT_EMAIL`. **Noter son UID.**
   - Le mot de passe n'est jamais stocké dans le code : il est saisi à
     l'ouverture de l'app et vérifié par Firebase.
4. **Firestore Database → Create database** (mode production).
5. **Firestore → Rules** : coller [firestore.rules](firestore.rules) en
   remplaçant `SHARED_UID` par l'UID de l'étape 3, puis **Publish**.

## Déploiement GitHub Pages

1. Dans le repo : **Settings → Pages → Source = GitHub Actions**.
2. **Settings → Secrets and variables → Actions** : créer les secrets
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
   `VITE_FIREBASE_ACCOUNT_EMAIL`.
3. Pousser sur `main` → le workflow [deploy.yml](.github/workflows/deploy.yml)
   build + déploie. L'app est servie sous `https://<user>.github.io/<repo>/`.

> **Sécurité.** La config Firebase est **publique par design** (elle identifie
> le projet, ne donne aucun accès). La vraie protection des données vient des
> **règles Firestore** + de la **session authentifiée**. Ne jamais mettre de
> clé secrète (service account / Admin SDK) dans ce dépôt ou le bundle.

## Modèle de données (Firestore)

| Collection | Champs |
|---|---|
| `users` | `firstName`, `createdAt` |
| `categories` | `name`, `sortOrder`, `color?`, `createdAt`, `archivedAt` |
| `budgetVersions` | `categoryId`, `amountCents`, `effectiveFrom` (`YYYY-MM`) |
| `expenses` | `categoryId`, `userId`, `amountCents`, `description`, `date` (`YYYY-MM-DD`), `createdAt`, `deletedAt` |

Montants en **centimes entiers**. Mois d'une dépense = `mois(date)`.
