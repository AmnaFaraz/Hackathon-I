---
title: Digital Twin Architecture
description: Building real-time digital twins of robots and environments using NVIDIA Omniverse and Isaac Sim.
sidebar_position: 2
---

# Digital Twin Architecture

A **Digital Twin** is a real-time virtual replica of a physical system — synchronized with its real counterpart via sensor data. For robots, digital twins enable monitoring, predictive maintenance, remote operation, and policy validation before deploying changes to hardware.

## What Makes a Good Digital Twin?

A robot digital twin must be:
1. **Geometrically accurate**: URDF/USD model matches physical dimensions
2. **Physically accurate**: mass, inertia, friction coefficients match reality
3. **Sensor-synchronized**: real sensor data drives the virtual model
4. **Low-latency**: state update < 50ms for real-time monitoring
5. **Bidirectional**: can send commands back to the real robot

## Architecture Overview

```
Physical Robot
   │  (joint encoders, IMU, cameras)
   ▼
ROS 2 Topics
   │  /joint_states, /imu/data, /camera/image_raw
   ▼
Digital Twin Bridge
   │  (Isaac Sim ROS 2 bridge)
   ▼
Isaac Sim / Omniverse
   │  (virtual robot mirrors physical state)
   ▼
Visualization + Analytics + Policy Testing
```

## Building the Digital Twin in Isaac Sim

```python
"""
Digital Twin: sync real robot joint states to Isaac Sim.
"""
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import JointState

from isaacsim import SimulationApp
sim = SimulationApp({"headless": True})

from omni.isaac.core import World
from omni.isaac.core.robots import Robot
import numpy as np

class DigitalTwinBridge(Node):
    def __init__(self, robot: Robot):
        super().__init__('digital_twin_bridge')
        self.robot = robot
        self.joint_names = robot.dof_names

        self.sub = self.create_subscription(
            JointState,
            '/joint_states',
            self.joint_state_callback,
            10
        )
        self.get_logger().info('Digital Twin Bridge active')

    def joint_state_callback(self, msg: JointState):
        """Mirror real robot joints to simulation."""
        if len(msg.position) == 0:
            return

        # Map ROS joint names to simulation DOF indices
        positions = np.zeros(len(self.joint_names))
        for i, name in enumerate(msg.name):
            if name in self.joint_names:
                idx = self.joint_names.index(name)
                positions[idx] = msg.position[i]

        # Apply to virtual robot
        self.robot.set_joint_positions(positions)
```

## USD (Universal Scene Description) for Robots

NVIDIA's digital twins use **OpenUSD** — Pixar's Universal Scene Description:

```python
from pxr import Usd, UsdGeom, UsdPhysics, Gf

def create_robot_digital_twin(usd_path: str) -> Usd.Stage:
    """Create a USD stage representing a robot digital twin."""
    stage = Usd.Stage.CreateNew(usd_path)
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z)
    UsdGeom.SetStageMetersPerUnit(stage, 1.0)

    # Root xform
    root = UsdGeom.Xform.Define(stage, "/World")

    # Physics scene
    physics_scene = UsdPhysics.Scene.Define(stage, "/World/PhysicsScene")
    physics_scene.CreateGravityDirectionAttr(Gf.Vec3f(0, 0, -1))
    physics_scene.CreateGravityMagnitudeAttr(9.81)

    # Ground plane
    ground = UsdGeom.Mesh.Define(stage, "/World/Ground")
    # (geometry definition omitted for brevity)

    stage.Save()
    return stage
```

## Real-Time Sensor Data Streaming

For live digital twin synchronization, use **DDS** (same as ROS 2 under the hood):

```python
import asyncio
import websockets
import json

class DigitalTwinServer:
    """WebSocket server that streams robot state to web dashboard."""

    def __init__(self, port: int = 8765):
        self.port = port
        self.clients: set = set()
        self.state = {}

    async def broadcast(self, data: dict):
        """Send state update to all connected clients."""
        if self.clients:
            message = json.dumps(data)
            await asyncio.gather(
                *[client.send(message) for client in self.clients],
                return_exceptions=True
            )

    async def handler(self, websocket):
        self.clients.add(websocket)
        try:
            async for message in websocket:
                cmd = json.loads(message)
                if cmd.get("type") == "get_state":
                    await websocket.send(json.dumps(self.state))
        finally:
            self.clients.discard(websocket)

    def update_state(self, joint_positions: list, base_pose: dict):
        """Update internal state (called from ROS 2 callback)."""
        self.state = {
            "timestamp": asyncio.get_event_loop().time(),
            "joints": joint_positions,
            "base": base_pose
        }

    async def run(self):
        async with websockets.serve(self.handler, "0.0.0.0", self.port):
            await asyncio.Future()  # run forever
```

## Predictive Maintenance via Digital Twin

Digital twins enable predictive maintenance by comparing simulated vs real behavior:

```python
class MaintenanceMonitor:
    def __init__(self, baseline_friction: list[float]):
        """
        baseline_friction: joint friction coefficients from factory calibration
        """
        self.baseline = np.array(baseline_friction)
        self.anomaly_threshold = 0.15  # 15% deviation

    def check_joint_health(
        self,
        commanded_torques: np.ndarray,
        actual_velocities: np.ndarray,
        estimated_friction: np.ndarray
    ) -> dict:
        """Compare estimated friction to baseline."""
        deviation = np.abs(estimated_friction - self.baseline) / self.baseline
        anomalies = np.where(deviation > self.anomaly_threshold)[0]

        return {
            "healthy": len(anomalies) == 0,
            "flagged_joints": anomalies.tolist(),
            "max_deviation": float(deviation.max()),
            "recommendation": "Inspect joints: " + str(anomalies.tolist())
                              if len(anomalies) > 0 else "All nominal"
        }
```

:::info
Siemens, BMW, and NVIDIA jointly demonstrated factory-scale digital twins using Omniverse in 2023 — simulating entire assembly lines with thousands of robots in real time.
:::

## Digital Twin for Policy Validation

Before pushing a new policy to hardware:

```python
def validate_policy_in_twin(
    policy,
    digital_twin_env,
    n_episodes: int = 100
) -> dict:
    """
    Run policy in digital twin and compute safety metrics.
    Only deploy if all metrics pass.
    """
    metrics = {
        "fall_rate": 0.0,
        "goal_success": 0.0,
        "max_joint_torque": 0.0,
        "min_foot_clearance": float('inf')
    }

    for ep in range(n_episodes):
        obs = digital_twin_env.reset()
        for step in range(1000):
            action = policy.get_action(obs)
            obs, reward, done, info = digital_twin_env.step(action)

            metrics["max_joint_torque"] = max(
                metrics["max_joint_torque"],
                info.get("max_torque", 0)
            )
            if info.get("fell", False):
                metrics["fall_rate"] += 1 / n_episodes
                break
            if done:
                metrics["goal_success"] += 1 / n_episodes
                break

    safe_to_deploy = (
        metrics["fall_rate"] < 0.02 and
        metrics["goal_success"] > 0.85 and
        metrics["max_joint_torque"] < 150.0  # Nm
    )
    return {**metrics, "safe_to_deploy": safe_to_deploy}
```

## Summary

Digital twins are essential infrastructure for physical AI:
- **USD** provides the 3D representation
- **ROS 2 bridge** keeps virtual and real in sync
- **WebSocket streaming** enables web dashboard monitoring
- **Policy validation** in twin before real deployment prevents costly failures
