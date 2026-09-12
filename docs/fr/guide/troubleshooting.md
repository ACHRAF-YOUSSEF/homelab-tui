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
- Un mot de passe refusé suspend les nouvelles tentatives sans conserver la valeur. Avec un seul onglet, une nouvelle invite s'ouvre immédiatement; avec plusieurs machines, ouvrez l'onglet en échec puis appuyez sur `c` afin de laisser les autres utilisables. `Échap` ferme l'invite sans masquer l'erreur.
- Une clé refusée n'ouvre jamais d'invite de mot de passe. Vérifiez plutôt la clé publique dans le fichier `authorized_keys` du compte distant.

## Une machine reste en reconnexion

Les erreurs temporaires de la connexion initiale déclenchent des tentatives après `3`, `5`, `10`, `20`, puis `30` secondes. Après la coupure d'une machine connectée, appuyez sur `r` pour la reconnecter ou sur `x` pour la déconnecter et fermer son onglet. Les erreurs d'authentification, de clé privée, de DNS et de clé d'hôte suspendent les tentatives automatiques.

L'onglet explique l'erreur détectée sans bloquer les autres machines. Après une connexion réussie, l'heure et le nombre de services de la dernière mise à jour restent affichés comme données périmées; les actions sur les services sont désactivées jusqu'au rétablissement.

## La connexion SSH est refusée

« Connexion refusée » signifie que la cible a rejeté la connexion TCP. Le client ne peut pas déterminer si SSH est désactivé, si le service SSH est arrêté, si le port est incorrect ou si un pare-feu rejette la connexion. Vérifiez ces quatre possibilités, puis appuyez sur `r`.

Un délai dépassé ou une machine inaccessible indique généralement un problème de routage, VPN, pare-feu ou alimentation. « Machine introuvable » indique un problème de nom d'hôte ou de DNS.

Une erreur de clé d'hôte ne déclenche jamais de nouvelle tentative automatique. Vérifiez l'identité de la machine distante avant de modifier une clé approuvée.

## Les services Docker sont absents

Exécutez `docker ps` avec l'utilisateur distant configuré. Docker doit être installé, le démon démarré et l'utilisateur autorisé. Vérifiez aussi que `discovery.docker` vaut `true`.

## Les processus ou journaux natifs sont absents

Activez `discovery.nativeServices`. La détection liste les programmes à l'écoute sur des ports TCP, pas tous les processus.

- Linux : `journalctl` pour le PID sélectionné.
- macOS : `log stream` pour le PID sélectionné.
- Windows : le suivi des journaux natifs n'est pas disponible.

## La disposition est trop dense

Utilisez au moins un terminal `80×24`. Le mode compact s'active sous 30 lignes; un terminal plus large affiche davantage de colonnes, et chaque onglet conserve toute la largeur disponible.
