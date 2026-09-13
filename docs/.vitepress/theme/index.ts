import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./custom.css";

function mountLightbox(): void {
  if (typeof document === "undefined" || document.documentElement.dataset.homelabLightbox) return;
  document.documentElement.dataset.homelabLightbox = "true";
  const french = document.documentElement.lang.startsWith("fr");
  const openLabel = french ? "Ouvrir la capture en taille réelle" : "Open full-size screenshot";
  const closeLabel = french ? "Fermer la capture" : "Close screenshot";

  const isPreviewImage = (target: EventTarget | null): target is HTMLImageElement =>
    target instanceof HTMLImageElement && Boolean(target.closest(".VPHero .image, .vp-doc"));

  const prepareImages = (): void => {
    document.querySelector(".VPHome")?.setAttribute("role", "main");
    document.querySelectorAll<HTMLImageElement>(".VPHero .image-src, .vp-doc img").forEach((image) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-haspopup", "dialog");
      image.setAttribute("aria-label", `${image.alt}. ${openLabel}.`);
    });
  };

  const open = (trigger: HTMLImageElement): void => {
    if (document.querySelector(".homelab-lightbox")) return;

    const overlay = document.createElement("div");
    overlay.className = "homelab-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", trigger.alt || "Screenshot");

    const image = document.createElement("img");
    image.src = trigger.src;
    image.alt = trigger.alt;

    const closeButton = document.createElement("button");
    closeButton.className = "homelab-lightbox-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", closeLabel);
    closeButton.textContent = "×";

    const previousOverflow = document.body.style.overflow;
    const close = (): void => {
      document.removeEventListener("keydown", onDialogKeydown);
      document.body.style.overflow = previousOverflow;
      overlay.remove();
      trigger.focus();
    };
    const onDialogKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        event.preventDefault();
        closeButton.focus();
      }
    };

    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener("keydown", onDialogKeydown);
    overlay.append(image, closeButton);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    closeButton.focus();
  };

  document.addEventListener("click", (event) => {
    if (isPreviewImage(event.target)) open(event.target);
  });
  document.addEventListener("keydown", (event) => {
    if (!isPreviewImage(event.target) || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    open(event.target);
  });

  prepareImages();
  new MutationObserver(prepareImages).observe(document.documentElement, { childList: true, subtree: true });
}

export default {
  extends: DefaultTheme,
  enhanceApp() {
    mountLightbox();
  },
} satisfies Theme;
