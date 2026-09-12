# Surveillance

## Ouvrir des machines

Sélectionnez une machine et appuyez sur `Entrée`, ou appuyez sur `m` pour en choisir plusieurs. Chaque machine dispose de son propre onglet et de sa propre connexion SSH.

La barre supérieure résume la session :

- Les machines disponibles restent utilisables lorsqu'une autre échoue.
- Les machines en connexion ou reconnexion affichent leur état actuel.
- Un onglet en échec affiche une erreur SSH précise et une action de récupération sans remplacer les machines disponibles.
- `Tab` et `Maj+Tab` parcourent les onglets; les touches `1` à `9` en ouvrent un directement.

## Lire un onglet

Chaque onglet contient l'état de la machine et une liste de services pleine largeur. Seul l'onglet actif reçoit les actions de sélection, recherche, filtre et tri; les autres machines restent connectées et continuent de s'actualiser.

Une machine disponible peut afficher l'utilisation CPU, mémoire et disque, les conteneurs Docker et Compose, les programmes écoutant sur des ports TCP et les changements d'état récents.

À `80×24`, les métriques et détails complets passent en mode compact. Les terminaux plus larges affichent davantage de colonnes. Les longues listes d'onglets restent centrées sur la machine active sans déborder.

## Journaux

Appuyez sur `l` pour ouvrir ou fermer les journaux du service sélectionné. Les journaux Docker sont suivis en direct. Sous Linux, les processus natifs utilisent `journalctl`; sous macOS, `log stream`. Cette fonction n'est pas disponible pour les processus natifs Windows.

## Actions sur les services

| Service | Redémarrer | Arrêter | Démarrer |
|---|---|---|---|
| Conteneur Docker | `r` | `s` | `t` |
| Conteneur Compose | `r` ouvre le choix de portée | `s` | `t` |
| Processus natif | `r` sous systemd/Linux | `s` termine le processus | Indisponible |

## Reconnexion

Les keepalives SSH détectent une coupure et relancent la connexion après `3`, `5`, `10`, `20`, puis `30` secondes. Le nombre de tentatives et le compte à rebours restent visibles; `r` relance immédiatement la tentative.

Seules les erreurs réseau temporaires déclenchent des tentatives automatiques. Les erreurs d'identifiants et de configuration suspendent la connexion avec les actions contextuelles `c credentials` ou `h hosts`. Un onglet déconnecté signale sa dernière mise à jour comme périmée et désactive les actions jusqu'au rétablissement.
