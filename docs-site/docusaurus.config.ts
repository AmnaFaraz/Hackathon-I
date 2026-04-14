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
      title: "Panaversity AI",
      logo: {
        alt: "Panaversity AI",
        src: "img/logo.svg",
      },
      items: [
        {
          to: "/#curriculum",
          label: "Curriculum",
          position: "left",
        },
        {
          type: "dropdown",
          label: "Chapters",
          position: "left",
          items: [
            { label: "1. Intro to LLMs", to: "/chapter-1/intro" },
            { label: "2. Prompt Engineering", to: "/chapter-2/intro" },
            { label: "3. RAG Systems", to: "/chapter-3/intro" },
            { label: "4. Fine-Tuning", to: "/chapter-4/intro" },
            { label: "5. AI Agents", to: "/chapter-5/intro" },
            { label: "6. Evaluation", to: "/chapter-6/intro" },
          ],
        },
        {
          label: "AI Tutor",
          to: "/intro", // Link to introduction which has the chat trigger info
          position: "left",
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
          title: "Learn",
          items: [
            { label: "Curriculum", to: "/#curriculum" },
            { label: "Chapters", to: "/intro" },
            { label: "AI Tutor", to: "/intro" },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "GitHub", href: "https://github.com/AmnaFaraz" },
            { label: "Vercel", href: "https://panaversity-hackathon-1.vercel.app" },
          ],
        },
      ],
      copyright: `Built with Docusaurus, FastAPI, and Groq. © ${new Date().getFullYear()} Panaversity AI.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "python", "yaml", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
