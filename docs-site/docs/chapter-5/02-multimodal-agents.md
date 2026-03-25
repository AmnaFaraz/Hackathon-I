---
title: Multimodal Robotic Agents
description: Building robots that combine vision, language, and action using Vision-Language-Action models.
sidebar_position: 2
---

# Multimodal Robotic Agents

The next evolution beyond LLM-based planners is **multimodal robotic agents** — systems that process visual input, language instructions, and sensorimotor data in a unified model to generate robot actions end-to-end.

## Vision-Language-Action (VLA) Models

Traditional robotics separates perception (see), planning (think), and action (do) into isolated modules. VLA models unify all three:

```
Camera Input (image) ──┐
Language Goal (text)  ──┼──► VLA Model ──► Joint Actions
Proprioception (state)─┘
```

Notable VLA models:
- **RT-2** (Google DeepMind): PaLI-X backbone
- **OpenVLA**: open-source, 7B parameter
- **π0** (Physical Intelligence): leading manipulation performance
- **GROOT** (NVIDIA): for humanoid manipulation

## Building a Multimodal Perception Pipeline

Combining vision and language for robotic grounding:

```python
from groq import Groq
import base64
import cv2
import numpy as np
from pathlib import Path

class MultimodalRobotBrain:
    def __init__(self):
        self.client = Groq()
        # Note: For vision, use vision-capable models
        # Groq currently supports llava-v1.5-7b-4096-preview for vision
        self.vision_model = "llava-v1.5-7b-4096-preview"
        self.reasoning_model = "llama-3.3-70b-versatile"

    def analyze_scene(self, image: np.ndarray) -> str:
        """Describe the current scene from robot camera."""
        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        b64_image = base64.b64encode(buffer).decode('utf-8')

        response = self.client.chat.completions.create(
            model=self.vision_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}
                        },
                        {
                            "type": "text",
                            "text": (
                                "Describe this robot's-eye-view scene for task planning. "
                                "List: visible objects, their positions (left/center/right, "
                                "near/far), and any obstacles."
                            )
                        }
                    ]
                }
            ],
            max_tokens=256
        )
        return response.choices[0].message.content

    def ground_instruction(
        self,
        instruction: str,
        scene_description: str
    ) -> dict:
        """Map natural language instruction to grounded robot action."""
        response = self.client.chat.completions.create(
            model=self.reasoning_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You map instructions to grounded robot actions given "
                        "a scene description. Return JSON with keys: "
                        "target_object, target_location, action_type, "
                        "approach_direction."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Scene: {scene_description}\n"
                        f"Instruction: {instruction}"
                    )
                }
            ],
            temperature=0.1
        )
        import json
        return json.loads(response.choices[0].message.content)
```

## Semantic Memory for Robots

Robots need memory to operate over extended periods. Combine embeddings + LLM:

```python
from sentence_transformers import SentenceTransformer

class RobotSemanticMemory:
    """
    Stores robot observations and experiences as vector embeddings.
    Retrieves relevant memories for decision-making.
    """
    def __init__(self):
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
        self.memories: list[dict] = []

    def store(self, observation: str, action: str, outcome: str):
        embedding = self.encoder.encode(observation, normalize_embeddings=True)
        self.memories.append({
            "observation": observation,
            "action": action,
            "outcome": outcome,
            "embedding": embedding
        })

    def retrieve(self, current_observation: str, top_k: int = 3) -> list[dict]:
        """Find most relevant past experiences."""
        if not self.memories:
            return []
        query_emb = self.encoder.encode(
            current_observation, normalize_embeddings=True
        )
        scores = [
            float(np.dot(query_emb, m["embedding"]))
            for m in self.memories
        ]
        top_indices = np.argsort(scores)[-top_k:][::-1]
        return [self.memories[i] for i in top_indices]

    def get_context_for_decision(self, current_obs: str) -> str:
        relevant = self.retrieve(current_obs)
        if not relevant:
            return "No relevant past experience."
        lines = []
        for m in relevant:
            lines.append(
                f"- When: '{m['observation']}', "
                f"I did: '{m['action']}', "
                f"Result: '{m['outcome']}'"
            )
        return "Relevant past experiences:\n" + "\n".join(lines)
```

## ReAct (Reason + Act) Agent for Robots

The **ReAct** pattern interleaves thinking and acting:

```python
class ReActRobotAgent:
    """
    ReAct-style robot agent: Think → Act → Observe → Repeat
    """
    MAX_STEPS = 10

    def __init__(self, tools: dict, memory: RobotSemanticMemory):
        self.tools = tools  # {name: callable}
        self.memory = memory
        self.client = Groq()

    def run(self, goal: str, initial_observation: str) -> str:
        """Execute goal using ReAct loop."""
        context = self.memory.get_context_for_decision(initial_observation)

        system = """You are a robot agent using ReAct pattern.
Respond in this exact format for each step:
Thought: [your reasoning about what to do]
Action: [tool_name(arg1, arg2)]

Available tools: navigate_to, pick_up, place_at, look_for, say
When goal is complete, write: GOAL_COMPLETE: [summary]"""

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": (
                f"Goal: {goal}\n"
                f"Initial observation: {initial_observation}\n"
                f"{context}"
            )}
        ]

        for step in range(self.MAX_STEPS):
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.2,
                max_tokens=200
            )
            reply = response.choices[0].message.content
            messages.append({"role": "assistant", "content": reply})

            if "GOAL_COMPLETE" in reply:
                return reply

            # Parse and execute action
            if "Action:" in reply:
                action_line = [l for l in reply.split('\n') if l.startswith("Action:")][0]
                action_str = action_line.replace("Action:", "").strip()
                observation = self._execute_action(action_str)

                messages.append({
                    "role": "user",
                    "content": f"Observation: {observation}"
                })

        return "Max steps reached without completing goal."

    def _execute_action(self, action_str: str) -> str:
        """Parse and execute an action string."""
        import re
        match = re.match(r'(\w+)\(([^)]*)\)', action_str)
        if not match:
            return "Error: could not parse action"
        fn_name, args_str = match.groups()
        if fn_name not in self.tools:
            return f"Error: unknown tool '{fn_name}'"
        # Simple arg parsing
        args = [a.strip().strip('"\'') for a in args_str.split(',') if a.strip()]
        try:
            result = self.tools[fn_name](*args)
            return str(result)
        except Exception as e:
            return f"Error executing {fn_name}: {e}"
```

:::info
**Google DeepMind RT-2** demonstrated that a VLA model trained on internet data can generalize to novel objects and instructions never seen in robot training — a major breakthrough in 2023.
:::

## Integration with ROS 2

```python
class MultimodalROS2Node(Node):
    def __init__(self):
        super().__init__('multimodal_agent')
        self.brain = MultimodalRobotBrain()
        self.memory = RobotSemanticMemory()

        self.camera_sub = self.create_subscription(
            Image, '/camera/image_raw', self.camera_cb, 10
        )
        self.cmd_sub = self.create_subscription(
            String, '/voice_command', self.command_cb, 10
        )
        self.current_image = None

    def camera_cb(self, msg):
        from cv_bridge import CvBridge
        self.current_image = CvBridge().imgmsg_to_cv2(msg, 'bgr8')

    def command_cb(self, msg):
        if self.current_image is None:
            return
        scene = self.brain.analyze_scene(self.current_image)
        grounded = self.brain.ground_instruction(msg.data, scene)
        self.get_logger().info(f'Grounded action: {grounded}')
        # Execute grounded action...
```

## Summary

Multimodal robotic agents represent the frontier of Physical AI:
- **Scene understanding** via vision models
- **Instruction grounding** via LLM reasoning
- **Semantic memory** via vector embeddings
- **ReAct loops** for multi-step task completion
- **VLA models** (RT-2, OpenVLA) for end-to-end control
