import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    "intro",
    {
      type: "category",
      label: "Foundations",
      items: [
        "chapter-1/01-intro-robotics",
        "chapter-1/02-ros2-basics",
        "chapter-1/03-gazebo-sim",
      ],
    },
    {
      type: "category",
      label: "Perception",
      items: [
        "chapter-2/01-computer-vision",
        "chapter-2/02-lidar-sensors",
        "chapter-2/03-sensor-fusion",
      ],
    },
    {
      type: "category",
      label: "Motion",
      items: [
        "chapter-3/01-path-planning",
        "chapter-3/02-inverse-kinematics",
        "chapter-3/03-gait-control",
      ],
    },
    {
      type: "category",
      label: "NVIDIA Isaac",
      items: [
        "chapter-4/01-isaac-platform",
        "chapter-4/02-digital-twins",
        "chapter-4/03-sim-to-real",
      ],
    },
    {
      type: "category",
      label: "AI Integration",
      items: [
        "chapter-5/01-llm-robotics",
        "chapter-5/02-multimodal-agents",
        "chapter-5/03-future-ftes",
      ],
    },
  ],
};

export default sidebars;
