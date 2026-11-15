# En direct, sans redéploiement (`@go-/hot`)

Chaque modification poussée sur GitHub par Claude (ou par toi) est en ligne en quelques secondes,
**sans redéploiement Render** :

| Événement GitHub | Effet sur le serveur |
|---|---|
| PR ouverte ou nouveau commit sur la PR | Preview de la PR lancée à côté de la production : `https://<site>/pr/<numéro>` |
| PR fusionnée dans `main` (push) | La production passe à la nouvelle version, sans coupure |
| PR fermée | Sa preview est arrêtée |
| Version qui ne démarre pas | Mise à jour abandonnée, la version en ligne est conservée (erreur visible dans `/__go/hot`) |

Les pages ouvertes se rechargent seules à la nouvelle version (canal `/__go/live`, voir `watchDeployments`).

## Fonctionnement

```
Render (déployé une seule fois)
└─ go-hot (port public)
   ├─ POST /__go/hook   webhook GitHub signé (HMAC SHA-256)
   ├─ GET  /__go/hot    état : production, previews, mises à jour en cours, erreurs
   ├─ GET  /pr/<n>      active la preview de la PR n pour ce navigateur (cookie) ; /pr/off pour revenir
   └─ proxy ──► production   (instance de l'app sur un port interne)
             └► PR n         (si cookie go_preview=n ou en-tête X-Go-Preview: n)
```

Pour chaque mise à jour : clone superficiel du commit, réutilisation de `node_modules` si les dépendances
n'ont pas changé, `npm run build`, démarrage sur un port libre, vérification du chemin de santé,
bascule du trafic, arrêt propre de l'ancienne version. Les mises à jour sont traitées une par une ;
plusieurs commits rapprochés sur la même PR n'en déclenchent qu'une.

## Mise en place (une fois)

1. **Render** : créer le service depuis `render.yaml` (Blueprint). `autoDeployTrigger: off` : Render ne
   redéploie plus à chaque commit.
2. **Secret du webhook** : copier la valeur générée de `GO_HOT_WEBHOOK_SECRET` dans le tableau de bord Render.
3. **GitHub** → dépôt → *Settings → Webhooks → Add webhook* :
   - Payload URL : `https://<ton-service>.onrender.com/__go/hook`
   - Content type : `application/json`
   - Secret : la valeur de l'étape 2
   - Événements : *Pull requests* et *Pushes*
4. **Dépôt privé** : créer un jeton GitHub *fine-grained* en lecture seule (*Contents: read*) sur ce dépôt et le
   renseigner dans `GO_HOT_GIT_TOKEN`.
5. Optionnel : `GO_HOT_ALLOWED_AUTHORS=Alexiskd` pour limiter les previews à tes PR et à celles que Claude ouvre
   avec ton compte.

## Variables

| Variable | Défaut | Rôle |
|---|---|---|
| `GO_HOT_START` | — (obligatoire) | commande de l'app, ex. `node apps/api/dist/main.js` |
| `GO_HOT_REPO` | `https://github.com/$RENDER_GIT_REPO_SLUG.git` | dépôt à suivre |
| `GO_HOT_BRANCH` | branche Render ou `main` | branche de production |
| `GO_HOT_WEBHOOK_SECRET` | — | sans lui, le webhook est refusé |
| `GO_HOT_GIT_TOKEN` | — | dépôt privé |
| `GO_HOT_INSTALL` / `GO_HOT_BUILD` | `npm install --include=dev …` / `npm run build` | étapes de construction |
| `GO_HOT_PORT_ENV` / `GO_HOT_HOST_ENV` | `API_PORT` / `API_HOST` | variables qui donnent son port à l'app |
| `GO_HOT_HEALTH` | `/api/v1/health` | vérifié avant chaque bascule |
| `GO_HOT_MAX_PREVIEWS` | 2 | previews simultanées (la plus ancienne est arrêtée au-delà) |
| `GO_HOT_ALLOWED_AUTHORS` | tous (hors forks) | auteurs autorisés pour les previews |
| `GO_HOT_SYNC_ON_BOOT` | true | au démarrage, rattrape le dernier commit de `main` |

## Sécurité et limites

- **Webhook signé obligatoire** ; les PR provenant de **forks ne sont jamais exécutées**.
- Les previews partagent les variables d'environnement de la production (secrets, base de données) :
  une PR peut donc agir sur les vraies données. Limite les auteurs autorisés en conséquence.
- Mémoire : chaque preview est une instance de plus, et la compilation se fait sur le serveur.
  Plan **Starter** minimum, `GO_HOT_MAX_PREVIEWS` à ajuster.
- Le disque Render est éphémère : après un redémarrage, le service repart du dernier build Render puis
  rattrape `main` automatiquement (`GO_HOT_SYNC_ON_BOOT`). Les previews ouvertes sont relancées au prochain
  commit de leur PR.
- Un vrai redéploiement Render reste nécessaire pour changer la version de Node.js, les variables d'environnement
  ou `@go-/hot` lui-même.
