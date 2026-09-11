import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Homelab TUI",
  description:
    "Discovers Docker containers and running programs (Jellyfin, Ollama, LM Studio, game servers…), streams live logs, and shows system metrics — all over SSH. Supports Linux, macOS, and Windows remote hosts.",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Examples", link: "/markdown-examples" },
    ],

    sidebar: [
      {
        text: "Examples",
        items: [
          { text: "Markdown Examples", link: "/markdown-examples" },
          { text: "Runtime API Examples", link: "/api-examples" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/vuejs/vitepress" },
    ],
  },
});
