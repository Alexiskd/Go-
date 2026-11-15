# Go- — Stacks JS/TS

Dépôts officiels et starters importés en submodules git (`stacks/`).

| Technologie | Rôle | Dépôt officiel | Starter |
|---|---|---|---|
| Node.js | Runtime serveur | `stacks/nodejs/node` | `stacks/nodejs/hackathon-starter` |
| NestJS | Framework backend | `stacks/nestjs/nest` | `stacks/nestjs/typescript-starter` |
| Angular | Framework frontend | `stacks/angular/angular` | `npx @angular/cli new mon-app` |
| React | Bibliothèque UI | `stacks/react/react` | `stacks/react/vite` (`npm create vite@latest`) |
| Next.js | Framework fullstack | `stacks/nextjs/next.js` | `stacks/nextjs/next.js/examples` |

## Récupérer le code

```bash
git clone --recurse-submodules --shallow-submodules https://github.com/Alexiskd/Go-
# ou, une seule stack :
git submodule update --init --depth 1 stacks/nestjs/typescript-starter
```

Mettre à jour vers les derniers commits : `git submodule update --remote --depth 1`
