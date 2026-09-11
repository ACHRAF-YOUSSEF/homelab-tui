# Installation

## npm

Le paquet npm installe le binaire adapté à votre système et à votre architecture :

```sh
npm install -g homelab-tui
homelab-tui
```

Bun n'est pas nécessaire après l'installation.

## Bun

Bun bloque les scripts de cycle de vie tant que le paquet n'est pas approuvé. Installez, approuvez puis réinstallez afin de sélectionner le bon binaire :

```sh
bun add -g homelab-tui
bun pm trust homelab-tui
bun add -g homelab-tui
```

## Télécharger un binaire

Téléchargez la dernière version depuis [GitHub Releases](https://github.com/ACHRAF-YOUSSEF/homelab-tui/releases).

| Plateforme | Fichier |
|---|---|
| Linux x64 | `homelab-tui-linux-x64` |
| Linux arm64 | `homelab-tui-linux-arm64` |
| macOS Intel | `homelab-tui-darwin-x64` |
| macOS Apple Silicon | `homelab-tui-darwin-arm64` |
| Windows x64 | `homelab-tui-windows-x64.exe` |

Sous Linux ou macOS, rendez le fichier exécutable puis placez-le dans votre `PATH` :

```sh
chmod +x homelab-tui-linux-x64
sudo mv homelab-tui-linux-x64 /usr/local/bin/homelab-tui
```

## Exécuter depuis les sources

[Bun](https://bun.sh/) est requis pour exécuter directement les sources TypeScript :

```sh
git clone https://github.com/ACHRAF-YOUSSEF/homelab-tui.git
cd homelab-tui
bun install
bun run dev
```

## Prérequis des machines distantes

- Un accès SSH par mot de passe, clé privée ou agent SSH.
- Docker sur la machine distante pour détecter et contrôler les conteneurs.
- Les outils système standards pour les métriques et la détection des processus.
- OpenSSH Server activé pour une machine Windows.

Au premier lancement, homelab-tui propose de créer `homelab.config.json` ou d'utiliser un fichier existant. Continuez avec la [configuration](./configuration).
