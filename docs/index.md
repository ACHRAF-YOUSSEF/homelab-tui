---
layout: home

hero:
  name: homelab-tui
  text: Your entire homelab. One terminal.
  tagline: Inspect services, metrics, and logs over SSH. Control Docker containers and native processes without leaving the keyboard.
  image:
    src: /terminal-200x50.png
    alt: homelab-tui monitoring three hosts in a terminal
  actions:
    - theme: brand
      text: Install
      link: /guide/install
    - theme: alt
      text: Configure hosts
      link: /guide/configuration
    - theme: alt
      text: View on GitHub
      link: https://github.com/ACHRAF-YOUSSEF/homelab-tui

features:
  - icon:
      src: /icons/hosts.svg
      alt: ""
      width: 24
      height: 24
    title: Multi-host by default
    details: Open several SSH hosts side by side, switch focus with Tab, and see partial failures without losing healthy panes.
    link: /guide/monitoring
    linkText: Learn more
  - icon:
      src: /icons/services.svg
      alt: ""
      width: 24
      height: 24
    title: Containers and processes
    details: Discover Docker, Compose, and programs listening on TCP ports across Linux, macOS, and Windows hosts.
    link: /guide/configuration
    linkText: Configure discovery
  - icon:
      src: /icons/keyboard.svg
      alt: ""
      width: 24
      height: 24
    title: Keyboard-first operations
    details: Search, filter, sort, stream logs, and run guarded service actions from a responsive terminal interface.
    link: /guide/keybindings
    linkText: View shortcuts
  - icon:
      src: /icons/platforms.svg
      alt: ""
      width: 24
      height: 24
    title: Cross-platform hosts
    details: Monitor Linux, macOS, and Windows machines from one consistent interface over standard SSH connections.
    link: /guide/install
    linkText: Get started
---
