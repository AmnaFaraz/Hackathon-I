import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    "intro",
    {
      type: "category",
      label: "Foundations",
      items: [
        "chapter-1/intro-robotics",
        "chapter-1/ros2-basics",
        "chapter-1/gazebo-sim",
      ],
    },
    {
      type: "category",
      label: "Perception",
      items: [
        "chapter-2/computer-vision",
        "chapter-2/lidar-sensors",
        "chapter-2/sensor-fusion",
      ],
    },
    {
      type: "category",
      label: "Motion",
      items: [
        "chapter-3/path-planning",
        "chapter-3/inverse-kinematics",
        "chapter-3/gait-control",
      ],
    },
    {
      type: "category",
      label: "NVIDIA Isaac",
      items: [
        "chapter-4/isaac-platform",
        "chapter-4/digital-twins",
        "chapter-4/sim-to-real",
      ],
    },
    {
      type: "category",
      label: "AI Integration",
      items: [
        "chapter-5/llm-robotics",
        "chapter-5/multimodal-agents",
        "chapter-5/future-ftes",
      ],
    },
  ],
};

export default sidebars;
