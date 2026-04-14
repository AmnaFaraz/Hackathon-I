---
title: NVIDIA Isaac Platform Overview
description: Introduction to the NVIDIA Isaac robotics platform — Isaac Sim, Isaac Lab, Isaac ROS, and Isaac Perceptor.
sidebar_position: 1
slug: intro
---

import AskButton from '@site/src/components/AskButton';

<div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--ifm-border-color)' }}>
  <small style={{ color: 'var(--ifm-color-content)', opacity: 0.6 }}>
    Home &gt; Chapters &gt; NVIDIA Isaac Platform
  </small>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
     <small style={{ color: 'var(--ifm-color-content)', opacity: 0.6 }}>⏱️ 12 min read</small>
     <AskButton title="NVIDIA Isaac" />
  </div>
</div>

# NVIDIA Isaac Platform Overview

**NVIDIA Isaac** is the end-to-end AI robotics platform that powers modern Physical AI development. It spans simulation, training, perception, and deployment — all optimized for NVIDIA GPUs and the Jetson edge AI hardware.

## Isaac Platform Components

| Component | Purpose |
|---|---|
| **Isaac Sim** | Photorealistic, physics-accurate robot simulator |
| **Isaac Lab** | RL training framework built on Isaac Sim |
| **Isaac ROS** | GPU-accelerated ROS 2 hardware-agnostic packages |
| **Isaac Perceptor** | Multi-camera 3D perception stack |
| **Isaac Manipulator** | Foundation model for robot arm manipulation |
| **Isaac AMR** | Autonomous Mobile Robot reference architecture |

## Why Isaac Sim?

Traditional simulators (Gazebo, PyBullet) cannot generate photorealistic images needed to train vision models. Isaac Sim uses **RTX ray tracing** to produce:
- Physically accurate lighting and shadows
- Realistic material properties
- Domain-randomized synthetic data at scale

This enables **sim-to-real transfer** — training in simulation and deploying on real hardware with minimal reality gap.

## Getting Started with Isaac Sim

```bash
# Requirements: Ubuntu 22.04, NVIDIA GPU (RTX 3060+), CUDA 11.8+

# Install via pip (Isaac Sim 4.x)
pip install isaacsim==4.2.0.2 --extra-index-url \
  https://pypi.nvidia.com

# Or via Omniverse Launcher (recommended for full GUI)
# Download from: https://developer.nvidia.com/isaac/sim
```

## Your First Isaac Sim Script

```python
"""
Minimal Isaac Sim standalone script.
Spawns a Franka arm and runs physics for 100 steps.
"""
from isaacsim import SimulationApp

# Launch Isaac Sim (headless for CI, GUI for dev)
simulation_app = SimulationApp({"headless": False})

import numpy as np
from omni.isaac.core import World
from omni.isaac.core.robots import Robot
from omni.isaac.core.utils.stage import add_reference_to_stage
from omni.isaac.core.utils.nucleus import get_assets_root_path

# Initialize world
world = World(stage_units_in_meters=1.0)
world.scene.add_default_ground_plane()

# Add Franka robot from NVIDIA Asset Library
assets_root = get_assets_root_path()
franka_usd = assets_root + "/Isaac/Robots/Franka/franka_alt_fingers.usd"
add_reference_to_stage(usd_path=franka_usd, prim_path="/World/Franka")

robot = world.scene.add(Robot(
    prim_path="/World/Franka",
    name="franka",
    position=np.array([0.0, 0.0, 0.0])
))

world.reset()

# Run simulation
for step in range(100):
    world.step(render=True)
    joint_positions = robot.get_joint_positions()
    if step % 10 == 0:
        print(f"Step {step}: joints = {joint_positions[:3]}")

simulation_app.close()
```

## Isaac ROS Packages

**Isaac ROS** provides GPU-accelerated nodes for common perception tasks:

```bash
# Install Isaac ROS (requires ROS 2 Humble)
sudo apt-get install -y ros-humble-isaac-ros-visual-slam
sudo apt-get install -y ros-humble-isaac-ros-object-detection
sudo apt-get install -y ros-humble-isaac-ros-depth-segmentation
```

### GPU-Accelerated Visual SLAM

```bash
# Launch Isaac ROS Visual SLAM on RealSense
ros2 launch isaac_ros_visual_slam isaac_ros_visual_slam_realsense.launch.py
```

This runs at **30+ fps** on Jetson Orin, vs 5 fps with CPU-based ORB-SLAM.

## Isaac Lab for RL Training

**Isaac Lab** is built on top of Isaac Sim and provides:
- Vectorized environments (4096+ parallel robots on one GPU)
- Pre-built task environments (locomotion, manipulation, navigation)
- Integration with RSL-RL, RL Games, and Stable Baselines 3

```python
"""
Isaac Lab training entry point (simplified).
"""
import argparse
from omni.isaac.lab.app import AppLauncher

parser = argparse.ArgumentParser()
AppLauncher.add_app_launcher_args(parser)
args_cli = parser.parse_args()
app_launcher = AppLauncher(args_cli)
simulation_app = app_launcher.app

from omni.isaac.lab.envs import ManagerBasedRLEnv
from omni.isaac.lab_tasks.locomotion.velocity.config.h1 import (
    H1VelocityEnvCfg
)

env_cfg = H1VelocityEnvCfg()
env_cfg.scene.num_envs = 4096  # Train 4096 robots in parallel!
env = ManagerBasedRLEnv(cfg=env_cfg)

obs, _ = env.reset()
print(f"Observation shape: {obs['policy'].shape}")  # [4096, 48]
print(f"Action space: {env.action_space.shape}")    # [4096, 12]
```

## Supported Robot Models

NVIDIA provides ready-to-use USD robot models:

```
/Isaac/Robots/
  Franka/                    # 7-DoF manipulator
  UniversalRobots/UR10/      # Industrial arm
  Unitree/H1/                # Humanoid
  Boston_Dynamics/Spot/      # Quadruped
  iRobot/Create3/            # Mobile base
  ANYbotics/ANYmal_C/        # Research quadruped
```

## Jetson Orin: Edge Deployment

Trained policies deploy on **NVIDIA Jetson Orin**:

| Module | GPU | CPU | RAM | Power |
|---|---|---|---|---|
| Orin NX 8GB | 1024 CUDA cores | 6-core Cortex-A78 | 8GB | 10-25W |
| Orin AGX 64GB | 2048 CUDA cores | 12-core Cortex-A78 | 64GB | 15-60W |

```python
# Deploy TensorRT-optimized policy on Jetson
import tensorrt as trt
import numpy as np

class TRTLocomotionPolicy:
    def __init__(self, engine_path: str):
        logger = trt.Logger(trt.Logger.WARNING)
        with open(engine_path, 'rb') as f:
            engine = trt.Runtime(logger).deserialize_cuda_engine(f.read())
        self.context = engine.create_execution_context()

    def infer(self, obs: np.ndarray) -> np.ndarray:
        # Input/output buffers setup omitted for brevity
        # TensorRT runs policy at <1ms latency on Jetson Orin
        pass
```

:::info
NVIDIA Isaac robotics stack is free for development and research. Commercial deployment requires an Isaac license for some components. See developer.nvidia.com/isaac for details.
:::

## Summary

The Isaac platform is the most complete robotics development environment available:
- **Isaac Sim**: photorealistic simulation with RTX
- **Isaac Lab**: GPU-parallel RL training
- **Isaac ROS**: drop-in GPU-accelerated ROS 2 nodes
- **Jetson Orin**: edge AI deployment target
