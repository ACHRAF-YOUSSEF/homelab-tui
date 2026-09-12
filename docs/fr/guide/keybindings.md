# Raccourcis clavier

## Sélecteur de machines

| Touche | Action |
|---|---|
| `↑` / `↓` | Sélectionner une machine. |
| `Entrée` | Se connecter à la machine sélectionnée. |
| `m` | Passer à la sélection multiple. |
| `g` | Parcourir les groupes configurés. |
| `a` | Ajouter une machine. |
| `e` | Modifier la machine sélectionnée. |
| `d` | Supprimer la machine sélectionnée. |
| `Échap` | Revenir à l'écran précédent. |

En sélection multiple, utilisez `Espace` pour cocher les machines, `Entrée` pour vous connecter et `Échap` pour annuler.

## Surveillance

| Touche | Action |
|---|---|
| `↑` / `↓` | Sélectionner un service. |
| `r` | Redémarrer le service sélectionné. |
| `s` | Arrêter un conteneur ou terminer un processus natif. |
| `t` | Démarrer un conteneur Docker. |
| `l` | Afficher ou masquer les journaux. |
| `v` | Ouvrir un terminal interactif pour la machine active. |
| `/` | Rechercher par nom ou image. |
| `f` | Parcourir les filtres de type et d'état. |
| `o` | Trier par nom, état ou image. |
| `a` | Ajouter un onglet. |
| `x` | Fermer l'onglet actif. |
| `Tab` / `Maj+Tab` | Ouvrir l'onglet suivant ou précédent. |
| `1`–`9` | Ouvrir directement un onglet de machine. |
| `h` | Revenir au sélecteur de machines. |
| `q` | Quitter. |

Le pied de page et les gestionnaires utilisent les mêmes définitions centrales. Les petits terminaux n'affichent que les raccourcis principaux.

Lorsque la machine active n'est pas connectée, le pied de page affiche les actions de récupération :

| Touche | Action |
|---|---|
| `r` | Reconnecter immédiatement pendant une reconnexion, après une coupure ou hors ligne. |
| `x` | Déconnecter et fermer l'onglet d'une machine coupée. |
| `c` | Rouvrir l'invite de mot de passe ou de phrase secrète. |
| `h` | Revenir au sélecteur pour modifier la configuration. |
| `Échap` | Fermer l'invite sans masquer l'erreur de la machine. |

## Terminaux

Les commandes utilisent un préfixe de type tmux, `Ctrl+B`, afin que les touches ordinaires atteignent le shell distant.

| Touche | Action |
|---|---|
| `Ctrl+B`, puis `d` | Revenir aux détails sans fermer les shells. |
| `Ctrl+B`, puis `c` | Ouvrir un autre shell pour la machine active. |
| `Ctrl+B`, puis `x` | Fermer le shell actif après confirmation. |
| `Ctrl+B`, puis `n` / `p` | Ouvrir le shell suivant ou précédent. |
| `Ctrl+B`, puis `<` / `>` | Déplacer le shell actif vers la gauche ou la droite. |
| `Ctrl+B`, puis `1`–`9` | Ouvrir directement un shell. |
| `Ctrl+B`, puis `Tab` / `Maj+Tab` | Ouvrir l'onglet de machine suivant ou précédent. |
| `Ctrl+B`, puis `Ctrl+B` | Envoyer un `Ctrl+B` littéral au shell distant. |

Chaque onglet conserve ses shells et le shell actif tant que la surveillance reste ouverte. Fermer l'onglet ou quitter la surveillance ferme ses shells.

## Journaux

| Touche | Action |
|---|---|
| `↑` / `↓` | Défiler d'une ligne. |
| `PgUp` / `PgDn` | Défiler d'une page. |
| `l` | Fermer le panneau des journaux. |
