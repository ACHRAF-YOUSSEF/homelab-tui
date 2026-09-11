import { defineConfig } from "vitepress";
import packageJson from "../../package.json" with { type: "json" };

const repository = "https://github.com/ACHRAF-YOUSSEF/homelab-tui";
const versionMenu = (currentLabel: string, allLabel: string) => ({
  text: `v${packageJson.version}`,
  items: [
    { text: `v${packageJson.version} (${currentLabel})`, link: `${repository}/releases/tag/v${packageJson.version}` },
    { text: "v1.2.0", link: `${repository}/releases/tag/v1.2.0` },
    { text: "v1.1.14", link: `${repository}/releases/tag/v1.1.14` },
    { text: allLabel, link: `${repository}/releases` },
  ],
});

const englishNav = [
  { text: "Guide", link: "/guide/install", activeMatch: "/guide/" },
  {
    text: "Reference",
    items: [
      { text: "Configuration", link: "/guide/configuration" },
      { text: "Keybindings", link: "/guide/keybindings" },
      { text: "Command line", link: "/guide/cli" },
    ],
  },
  versionMenu("current", "All releases"),
];

const frenchNav = [
  { text: "Guide", link: "/fr/guide/install", activeMatch: "/fr/guide/" },
  {
    text: "Référence",
    items: [
      { text: "Configuration", link: "/fr/guide/configuration" },
      { text: "Raccourcis clavier", link: "/fr/guide/keybindings" },
      { text: "Ligne de commande", link: "/fr/guide/cli" },
    ],
  },
  versionMenu("actuelle", "Toutes les versions"),
];

export default defineConfig({
  title: "homelab-tui",
  description: "Monitor and control multiple homelab hosts over SSH from a fast terminal UI.",
  base: "/homelab-tui/",
  cleanUrls: true,
  lastUpdated: true,

  locales: {
    root: { label: "English", lang: "en-US" },
    fr: {
      label: "Français",
      lang: "fr-FR",
      link: "/fr/",
      description: "Surveillez et contrôlez plusieurs machines via SSH depuis un terminal rapide.",
      themeConfig: {
        nav: frenchNav,
        sidebar: {
          "/fr/guide/": [
            {
              text: "Bien démarrer",
              items: [
                { text: "Installation", link: "/fr/guide/install" },
                { text: "Configuration", link: "/fr/guide/configuration" },
                { text: "Surveillance", link: "/fr/guide/monitoring" },
                { text: "Raccourcis clavier", link: "/fr/guide/keybindings" },
                { text: "Ligne de commande", link: "/fr/guide/cli" },
                { text: "Dépannage", link: "/fr/guide/troubleshooting" },
              ],
            },
          ],
        },
        langMenuLabel: "Changer de langue",
        editLink: {
          pattern: `${repository}/edit/main/docs/:path`,
          text: "Modifier cette page sur GitHub",
        },
        footer: {
          message: "Publié sous licence MIT.",
          copyright: "Copyright © ACHRAF-YOUSSEF",
        },
      },
    },
  },

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/homelab-tui/logo.svg" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "homelab-tui — multi-host monitoring from your terminal" }],
    ["meta", { property: "og:description", content: "Monitor services, metrics, and logs across Linux, macOS, and Windows hosts over SSH." }],
    ["meta", { property: "og:image", content: `${repository}/raw/main/assets/terminal-200x50.png` }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],

  themeConfig: {
    logo: { src: "/logo.svg", alt: "homelab-tui" },
    nav: englishNav,

    sidebar: {
      "/guide/": [
        {
          text: "Getting started",
          items: [
            { text: "Install", link: "/guide/install" },
            { text: "Configuration", link: "/guide/configuration" },
            { text: "Monitoring", link: "/guide/monitoring" },
            { text: "Keybindings", link: "/guide/keybindings" },
            { text: "Command line", link: "/guide/cli" },
            { text: "Troubleshooting", link: "/guide/troubleshooting" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: repository }],
    search: { provider: "local" },
    langMenuLabel: "Change language",
    editLink: {
      pattern: `${repository}/edit/main/docs/:path`,
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © ACHRAF-YOUSSEF",
    },
  },
});
