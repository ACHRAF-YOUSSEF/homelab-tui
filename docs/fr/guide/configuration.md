# Configuration

homelab-tui lit un fichier JSON contenant une ou plusieurs machines SSH. Le chemin par défaut est `homelab.config.json` dans le dossier courant.

```json
{
  "hosts": [
    {
      "name": "server",
      "host": "192.168.1.10",
      "port": 22,
      "username": "admin",
      "authMethod": "key",
      "privateKeyPath": "~/.ssh/id_ed25519",
      "group": "home",
      "refreshInterval": 3000,
      "discovery": {
        "docker": true,
        "nativeServices": true,
        "includeStoppedContainers": true
      }
    }
  ]
}
```

## Champs d'une machine

| Champ | Requis | Défaut | Description |
|---|---:|---:|---|
| `name` | Oui | — | Libellé affiché dans le sélecteur et l'onglet de la machine. |
| `host` | Oui | — | Nom d'hôte ou adresse IP accepté par SSH. |
| `port` | Non | `22` | Port SSH entre `1` et `65535`. |
| `username` | Oui | — | Utilisateur SSH distant. |
| `authMethod` | Non | `"key"` | `"key"` ou `"password"`. |
| `privateKeyPath` | Pour une clé | — | Chemin de la clé privée. Les clés de l'agent SSH sont aussi prises en charge. |
| `group` | Non | — | Libellé utilisé par le filtre de groupes. |
| `refreshInterval` | Non | `3000` | Intervalle d'actualisation en millisecondes, de `1000` à `60000`. |
| `discovery.docker` | Non | `true` | Détecte les conteneurs Docker et Compose. |
| `discovery.nativeServices` | Non | `false` | Détecte les programmes à l'écoute sur des ports TCP. |
| `discovery.includeStoppedContainers` | Non | `true` | Inclut les conteneurs Docker arrêtés. |

::: warning Identifiants
Les mots de passe et phrases secrètes sont demandés au lancement et ne sont pas stockés dans la configuration JSON. N'ajoutez aucun secret à ce fichier.
:::

## Choisir un autre fichier

Pour une seule exécution :

```sh
homelab-tui --config /chemin/vers/homelab.config.json
```

Pour enregistrer ce chemin par défaut :

```sh
homelab-tui --set-config /chemin/vers/homelab.config.json
```

Le réglage est stocké dans `~/.config/homelab-tui/settings.json` sous Linux et macOS, ou `%APPDATA%\homelab-tui\settings.json` sous Windows. L'option `--config` reste prioritaire.
