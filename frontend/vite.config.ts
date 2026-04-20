/// <reference types="vitest/config" />
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// SPDX-License-Identifier: AGPL-3.0-only

const OG = {
  title: "YieldOmega",
  description:
    "Onchain gamefi on MegaETH — TimeCurve, Rabbit Treasury, and leprechaun collectibles in a bright arcade-fantasy world.",
  siteName: "YieldOmega",
  locale: "en_US",
  imagePath: "/art/opengraph.jpg",
  imageAlt:
    "YieldOmega artwork: bunny leprechaun mascots, glossy hat-coins, rainbow, and voxel hills in arcade cartoon style",
  imageType: "image/jpeg",
} as const;

function escAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function jpegDimensions(filePath: string): { width: number; height: number } | null {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 10 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc2) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        return { width, height };
      }
      i += 2 + len;
    }
  } catch {
    /* missing or unreadable art at dev time */
  }
  return null;
}

function siteOriginFromEnv(mode: string): string {
  const raw = loadEnv(mode, process.cwd(), "VITE").VITE_SITE_URL?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

function injectSocialMeta(mode: string) {
  const origin = siteOriginFromEnv(mode);
  const publicDir = fileURLToPath(new URL("./public", import.meta.url));
  const imageAbsPath = path.join(publicDir, "art", "opengraph.jpg");
  const dims = jpegDimensions(imageAbsPath);
  const imageUrl = origin ? `${origin}${OG.imagePath}` : OG.imagePath;
  const pageUrl = origin ? `${origin}/` : "/";
  const t = escAttr(OG.title);
  const d = escAttr(OG.description);
  const sn = escAttr(OG.siteName);
  const alt = escAttr(OG.imageAlt);
  const img = escAttr(imageUrl);
  const url = escAttr(pageUrl);
  const secureImageTag =
    origin.startsWith("https://") ?
      `\n    <meta property="og:image:secure_url" content="${img}" />`
    : "";

  const wh =
    dims ?
      `\n    <meta property="og:image:width" content="${String(dims.width)}" />\n    <meta property="og:image:height" content="${String(dims.height)}" />`
    : "";

  return {
    name: "yieldomega-social-meta",
    transformIndexHtml(html: string) {
      const block = `    <meta name="description" content="${d}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="${sn}" />
    <meta property="og:locale" content="${OG.locale}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:url" content="${img}" />${secureImageTag}
    <meta property="og:image:type" content="${OG.imageType}" />${wh}
    <meta property="og:image:alt" content="${alt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <meta name="twitter:image:alt" content="${alt}" />`;

      return html.replace("<!-- %SOCIAL_META% -->", block);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), injectSocialMeta(mode)],
  build: {
    // Rainbow/wagmi/WalletConnect pull large minified chunks; splitting further is a separate optimization.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // Upstream `ox` (via Coinbase, Reown, etc.) places `/*#__PURE__*/` where Rollup ignores it; behavior is safe.
        if (
          warning.code === "INVALID_ANNOTATION" &&
          typeof warning.id === "string" &&
          warning.id.includes("node_modules")
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
