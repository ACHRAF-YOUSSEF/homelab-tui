---
layout: home

hero:
  name: homelab-tui
  text: Tout votre homelab. Un seul terminal.
  tagline: Inspectez les services, les métriques et les journaux via SSH. Contrôlez les conteneurs Docker et les processus natifs sans quitter le clavier.
  image:
    src: /terminal-200x50.png
    alt: homelab-tui surveillant trois machines dans un terminal
  actions:
    - theme: brand
      text: Installer
      link: /fr/guide/install
    - theme: alt
      text: Configurer les machines
      link: /fr/guide/configuration
    - theme: alt
      text: Voir sur GitHub
      link: https://github.com/ACHRAF-YOUSSEF/homelab-tui

features:
  - icon:
      src: /icons/hosts.svg
      alt: ""
      width: 24
      height: 24
    title: Plusieurs machines par défaut
    details: Ouvrez plusieurs connexions SSH côte à côte, changez de focus avec Tab et conservez les machines disponibles en cas de panne partielle.
    link: /fr/guide/monitoring
    linkText: En savoir plus
  - icon:
      src: /icons/services.svg
      alt: ""
      width: 24
      height: 24
    title: Conteneurs et processus
    details: Détectez Docker, Compose et les programmes à l'écoute sur les ports TCP de machines Linux, macOS et Windows.
    link: /fr/guide/configuration
    linkText: Configurer la détection
  - icon:
      src: /icons/keyboard.svg
      alt: ""
      width: 24
      height: 24
    title: Pilotage au clavier
    details: Recherchez, filtrez, triez, suivez les journaux et lancez des actions protégées depuis une interface réactive.
    link: /fr/guide/keybindings
    linkText: Voir les raccourcis
  - icon:
      src: /icons/platforms.svg
      alt: ""
      width: 24
      height: 24
    title: Machines multiplateformes
    details: Surveillez Linux, macOS et Windows depuis une interface cohérente utilisant des connexions SSH standard.
    link: /fr/guide/install
    linkText: Bien démarrer
---
