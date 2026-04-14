---
title: LLMs in Robotics (Groq examples)
description: Using large language models as robot brains — task planning, code generation, and natural language interfaces using Groq.
sidebar_position: 1
slug: intro
---

import AskButton from '@site/src/components/AskButton';

<div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--ifm-border-color)' }}>
  <small style={{ color: 'var(--ifm-color-content)', opacity: 0.6 }}>
    Home &gt; Chapters &gt; LLMs in Robotics
  </small>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
     <small style={{ color: 'var(--ifm-color-content)', opacity: 0.6 }}>⏱️ 15 min read</small>
     <AskButton title="LLMs in Robotics" />
  </div>
</div>

# LLMs in Robotics (Groq Examples)

Large Language Models (LLMs) are transforming robotics by serving as **high-level reasoning engines**. Instead of hand-coding every behavior, you can describe tasks in natural language and let the LLM generate executable plans. This chapter shows practical patterns using **Groq** (llama-3.3-70b-versatile).

## The LLM-as-Robot-Brain Pattern

```
Human: "Go to the kitchen table and pick up the red cup"
              ↓
          Groq LLM
              ↓
  [navigate_to("kitchen_table"),
   detect_object("red cup"),
   grasp("red cup")]
              ↓
       ROS 2 Executor
              ↓
         Real Robot
```

## Setting Up Groq for Robotics

```python
import os
from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])

ROBOT_SYSTEM_PROMPT = """You are the reasoning module of a humanoid robot.
You have access to these primitive actions:
- navigate_to(location: str)
- pick_up(object_name: str)
- place_at(location: str)
- open(container: str)
- say(text: str)
- look_for(object_name: str)
- wait(seconds: float)

When given a task, respond ONLY with a JSON array of action calls.
Example: [{"action": "navigate_to", "args": {"location": "kitchen"}},
          {"action": "pick_up", "args": {"object_name": "apple"}}]
Never include explanations — only valid JSON."""

def plan_task(task_description: str) -> list[dict]:
    """Convert natural language task to action sequence."""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": ROBOT_SYSTEM_PROMPT},
            {"role": "user", "content": task_description}
        ],
        temperature=0.1,  # Low temperature for deterministic planning
        max_tokens=512
    )

    import json
    plan_text = response.choices[0].message.content.strip()
    # Clean markdown code blocks if present
    if plan_text.startswith("```"):
        plan_text = plan_text.split("```")[1]
        if plan_text.startswith("json"):
            plan_text = plan_text[4:]
    return json.loads(plan_text)

# Usage
plan = plan_task("Bring me a glass of water from the kitchen")
# Returns: [{"action": "navigate_to", "args": {"location": "kitchen"}},
#           {"action": "look_for", "args": {"object_name": "glass"}}, ...]
```

## Tool-Calling for Robot Control

Groq's tool-calling API maps LLM reasoning directly to robot functions:

```python
import json

ROBOT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "navigate_to",
            "description": "Move robot to a named location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "Target location name"},
                    "speed": {"type": "number", "description": "Speed 0.0-1.0", "default": 0.5}
                },
                "required": ["location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "pick_up",
            "description": "Grasp an object using robot arm",
            "parameters": {
                "type": "object",
                "properties": {
                    "object_name": {"type": "string"},
                    "grasp_type": {"type": "string", "enum": ["pinch", "power", "lateral"]}
                },
                "required": ["object_name"]
            }
        }
    }
]

class LLMRobotController:
    def __init__(self, ros_executor):
        self.executor = ros_executor
        self.conversation = []

    def execute_command(self, user_command: str) -> str:
        """Process command and execute robot actions via tool-calling."""
        self.conversation.append({"role": "user", "content": user_command})

        # Round 1: Get tool calls from LLM
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a robot controller. Use tools to complete tasks."},
                *self.conversation
            ],
            tools=ROBOT_TOOLS,
            tool_choice="auto"
        )

        msg = response.choices[0].message
        self.conversation.append(msg)

        # Execute tool calls
        tool_results = []
        if msg.tool_calls:
            for tc in msg.tool_calls:
                args = json.loads(tc.function.arguments)
                result = self.executor.call(tc.function.name, args)
                tool_results.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result)
                })
            self.conversation.extend(tool_results)

            # Round 2: Get final response
            final = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a robot controller."},
                    *self.conversation
                ]
            )
            return final.choices[0].message.content

        return msg.content
```

## Code Generation for Robot Control

LLMs can generate ROS 2 Python code on-the-fly:

```python
def generate_ros2_node(task_description: str) -> str:
    """Generate a complete ROS 2 Python node for a given task."""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert ROS 2 Python developer. "
                    "Generate complete, working ROS 2 nodes. "
                    "Use rclpy, follow ROS 2 best practices. "
                    "Return only code, no explanations."
                )
            },
            {
                "role": "user",
                "content": f"Write a ROS 2 Python node that: {task_description}"
            }
        ],
        temperature=0.2
    )
    return response.choices[0].message.content

# Example usage:
code = generate_ros2_node(
    "subscribes to /joint_states and publishes the sum of all joint "
    "angles to /joint_sum as a Float64 message at 10 Hz"
)
print(code)
# Outputs a complete, runnable ROS 2 node!
```

## Failure Recovery with LLM

When a robot fails, the LLM can reason about what went wrong:

```python
def handle_failure(
    failed_action: str,
    error_message: str,
    current_state: dict
) -> list[dict]:
    """Use LLM to generate recovery plan after a failure."""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a robot failure recovery system. "
                    "Given a failed action and current state, "
                    "suggest a recovery plan as JSON action array."
                )
            },
            {
                "role": "user",
                "content": (
                    f"Failed action: {failed_action}\n"
                    f"Error: {error_message}\n"
                    f"Current state: {json.dumps(current_state)}\n"
                    "Generate recovery steps."
                )
            }
        ],
        temperature=0.3
    )
    import json
    return json.loads(response.choices[0].message.content)
```

:::tip
Use **low temperature (0.0–0.2)** for robot planning tasks — you want deterministic, reliable actions, not creative ones. Reserve higher temperatures for natural language generation (status updates to humans).
:::

## Performance with Groq

Groq's LPU (Language Processing Unit) provides exceptional inference speed:

| Scenario | Groq llama-3.3-70b | OpenAI GPT-4 |
|---|---|---|
| Task plan (50 tokens) | ~80ms | ~800ms |
| Tool call round-trip | ~150ms | ~1200ms |
| Code generation (300 tokens) | ~400ms | ~3000ms |

This matters for robotics: a robot cannot wait 3 seconds for a decision while carrying a cup of hot coffee.

## Summary

LLMs are becoming the **cognitive layer** of Physical AI:
- **Plan decomposition**: break high-level goals into primitives
- **Tool calling**: map LLM reasoning to robot actions
- **Code generation**: create ROS 2 nodes dynamically
- **Failure recovery**: reason about errors and generate alternatives
- **Groq**: ultra-low latency inference essential for real-time robot control
