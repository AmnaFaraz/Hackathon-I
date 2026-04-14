import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Physical AI & Humanoid Robotics",
  tagline: "AI-Native Textbook — Panaversity",
  favicon: "img/favicon.ico",

  url: "https://panaversity-hackathon-1.vercel.app",
  baseUrl: "/",

  organizationName: "AmnaFaraz",
  projectName: "physical-ai-textbook",

  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en", "ur"],
    localeConfigs: {
      en: { label: "English", direction: "ltr" },
      ur: { label: "اردو", direction: "rtl" },
    },
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl:
            "https://github.com/AmnaFaraz/Hackathon-I/tree/main/docs-site/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Physical AI Textbook",
      logo: {
        alt: "Physical AI",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Chapters",
        },
        {
          type: "localeDropdown",
          position: "right",
        },
        {
          href: "https://github.com/AmnaFaraz/Hackathon-I",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Chapters",
          items: [
            { label: "Introduction", to: "/" },
            { label: "Foundations", to: "/category/foundations" },
            { label: "Perception", to: "/category/perception" },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "Panaversity", href: "https://panaversity.org" },
            {
              label: "GitHub",
              href: "https://github.com/AmnaFaraz/Hackathon-I",
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Amna Faraz — Panaversity. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "python", "yaml", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
