import { defineConfig } from "vitepress";

const repository = "https://github.com/ACHRAF-YOUSSEF/homelab-tui";

export default defineConfig({
  title: "homelab-tui",
  description: "Monitor and control multiple homelab hosts over SSH from a fast terminal UI.",
  base: "/homelab-tui/",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "homelab-tui — multi-host monitoring from your terminal" }],
    ["meta", { property: "og:description", content: "Monitor services, metrics, and logs across Linux, macOS, and Windows hosts over SSH." }],
    ["meta", { property: "og:image", content: `${repository}/raw/main/assets/terminal-200x50.png` }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/install", activeMatch: "/guide/" },
      { text: "Configuration", link: "/guide/configuration" },
      { text: "Keybindings", link: "/guide/keybindings" },
      { text: "CLI", link: "/guide/cli" },
      { text: "Releases", link: `${repository}/releases` },
    ],

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
