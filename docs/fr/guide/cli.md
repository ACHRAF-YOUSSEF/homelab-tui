# Ligne de commande

```text
homelab-tui [options]
```

| Option | Description |
|---|---|
| `--config <path>`, `-c <path>` | Utiliser un fichier de configuration pour cette exécution. |
| `--set-config <path>` | Enregistrer le chemin de configuration par défaut. |
| `--update` | Télécharger et installer la dernière version GitHub. |
| `--check-update` | Afficher les versions disponible et installée. |
| `--version`, `-v` | Afficher la version installée. |
| `--help`, `-h` | Afficher l'aide. |

## Exemples

```sh
homelab-tui
homelab-tui -c ./configs/lab.json
homelab-tui --set-config ./configs/lab.json
homelab-tui --check-update
homelab-tui --update
```

La configuration est résolue dans cet ordre :

1. `--config` ou `-c` pour l'exécution actuelle.
2. Le chemin enregistré par `--set-config`.
3. `homelab.config.json` dans le dossier courant.
