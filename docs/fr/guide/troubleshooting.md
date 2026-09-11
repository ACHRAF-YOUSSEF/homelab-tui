# Dépannage

## La configuration est refusée

homelab-tui affiche le chemin du champ invalide. Vérifiez que le JSON est valide, que les chaînes requises ne sont pas vides, que le port SSH est compris entre `1` et `65535` et que `privateKeyPath` est présent pour l'authentification par clé.

```sh
homelab-tui --config /chemin/absolu/homelab.config.json
```

## L'authentification SSH échoue

- Testez d'abord la machine, le port, l'utilisateur et la méthode avec `ssh`.
- Vérifiez le chemin et les permissions de la clé privée.
- Ajoutez la clé à votre agent SSH si nécessaire.
- Les clés chiffrées et les machines utilisant un mot de passe déclenchent une invite au lancement.

## Une machine reste en reconnexion

Les erreurs de connexion déclenchent des tentatives espacées jusqu'à 30 secondes. Vérifiez le réseau, le service SSH distant et les règles de pare-feu. Les autres panneaux continuent de fonctionner pendant une panne partielle.

## Les services Docker sont absents

Exécutez `docker ps` avec l'utilisateur distant configuré. Docker doit être installé, le démon démarré et l'utilisateur autorisé. Vérifiez aussi que `discovery.docker` vaut `true`.

## Les processus ou journaux natifs sont absents

Activez `discovery.nativeServices`. La détection liste les programmes à l'écoute sur des ports TCP, pas tous les processus.

- Linux : `journalctl` pour le PID sélectionné.
- macOS : `log stream` pour le PID sélectionné.
- Windows : le suivi des journaux natifs n'est pas disponible.

## La disposition est trop dense

Utilisez au moins un terminal `80×24`. Le mode compact s'active sous 30 lignes; un terminal plus large affiche davantage de colonnes et facilite la lecture de plusieurs panneaux.
