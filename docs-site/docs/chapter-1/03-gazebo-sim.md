---
title: Gazebo Simulation Setup
description: Setting up Gazebo Harmonic for robot simulation, physics, sensors, and ROS 2 integration.
sidebar_position: 3
---

# Gazebo Simulation Setup

**Gazebo** is the standard physics-based simulator for ROS 2. It provides realistic simulation of rigid body dynamics, sensors (cameras, LiDAR, IMU), and environments. Before touching real hardware, every robot system should be validated extensively in Gazebo.

## Why Simulate?

Real robots are expensive, slow to iterate on, and dangerous. Simulation enables:
- Rapid prototyping of control algorithms
- Generating synthetic training data for AI models
- Regression testing without physical damage risk
- Parallel simulation of hundreds of robots simultaneously

## Gazebo Harmonic (Modern Stack)

As of 2024, **Gazebo Harmonic** (formerly Ignition Gazebo) is the recommended simulator:

```bash
# Install Gazebo Harmonic
sudo apt-get install gz-harmonic

# Install ROS 2-Gazebo bridge
sudo apt-get install ros-humble-ros-gz-bridge ros-humble-ros-gz-sim
```

## World Definition (SDF)

Gazebo worlds are defined in **SDF (Simulation Description Format)**:

```xml
<?xml version="1.0" ?>
<sdf version="1.9">
  <world name="robot_world">
    <!-- Physics plugin -->
    <plugin filename="gz-sim-physics-system"
            name="gz::sim::systems::Physics"/>

    <!-- User interface -->
    <plugin filename="gz-sim-user-commands-system"
            name="gz::sim::systems::UserCommands"/>

    <!-- Scene renderer -->
    <plugin filename="gz-sim-scene-broadcaster-system"
            name="gz::sim::systems::SceneBroadcaster"/>

    <!-- Ground plane -->
    <model name="ground_plane">
      <static>true</static>
      <link name="link">
        <collision name="surface">
          <geometry><plane><normal>0 0 1</normal></plane></geometry>
        </collision>
        <visual name="visual">
          <geometry><plane><normal>0 0 1</normal><size>100 100</size></plane></geometry>
        </visual>
      </link>
    </model>

    <!-- Sun light -->
    <light type="directional" name="sun">
      <cast_shadows>true</cast_shadows>
      <pose>0 0 10 0 0 0</pose>
      <direction>-0.5 0.1 -0.9</direction>
    </light>

  </world>
</sdf>
```

## Adding a Robot to Gazebo

Extend your URDF with Gazebo-specific plugins:

```xml
<!-- In your URDF file -->
<gazebo reference="camera_link">
  <sensor name="camera" type="camera">
    <camera>
      <horizontal_fov>1.047</horizontal_fov>
      <image>
        <width>640</width>
        <height>480</height>
        <format>R8G8B8</format>
      </image>
      <clip><near>0.1</near><far>100</far></clip>
    </camera>
    <always_on>1</always_on>
    <update_rate>30</update_rate>
    <visualize>true</visualize>
    <topic>/camera/image_raw</topic>
  </sensor>
</gazebo>

<!-- LiDAR sensor -->
<gazebo reference="lidar_link">
  <sensor name="gpu_lidar" type="gpu_lidar">
    <update_rate>10</update_rate>
    <topic>/scan</topic>
    <gz_frame_id>lidar_link</gz_frame_id>
    <lidar>
      <scan>
        <horizontal>
          <samples>360</samples>
          <resolution>1</resolution>
          <min_angle>-3.14159</min_angle>
          <max_angle>3.14159</max_angle>
        </horizontal>
      </scan>
      <range>
        <min>0.08</min>
        <max>10.0</max>
        <resolution>0.01</resolution>
      </range>
    </lidar>
  </sensor>
</gazebo>
```

## ROS 2 ↔ Gazebo Bridge

The bridge forwards Gazebo topics to ROS 2 and vice versa:

```yaml
# bridge_config.yaml
- ros_topic_name: /camera/image_raw
  gz_topic_name: /camera/image_raw
  ros_type_name: sensor_msgs/msg/Image
  gz_type_name: gz.msgs.Image
  direction: GZ_TO_ROS

- ros_topic_name: /cmd_vel
  gz_topic_name: /cmd_vel
  ros_type_name: geometry_msgs/msg/Twist
  gz_type_name: gz.msgs.Twist
  direction: ROS_TO_GZ
```

```bash
# Launch the bridge
ros2 run ros_gz_bridge parameter_bridge --ros-args \
  -p config_file:=bridge_config.yaml
```

## Simulating Physics Accurately

Gazebo uses **ODE** or **Bullet** physics engines. Key parameters:

```xml
<physics name="default_physics" default="true" type="ode">
  <max_step_size>0.001</max_step_size>    <!-- 1 ms physics step -->
  <real_time_factor>1.0</real_time_factor> <!-- 1.0 = real time -->
  <ode>
    <solver>
      <type>quick</type>
      <iters>150</iters>
    </solver>
    <constraints>
      <cfm>0.0</cfm>
      <erp>0.2</erp>
    </constraints>
  </ode>
</physics>
```

:::info
For bipedal robot simulation, use **physics step size ≤ 1ms** to avoid instability during contact events (foot strikes). Larger steps cause the robot to "explode."
:::

## Running Your First Simulation

```bash
# Terminal 1: Start Gazebo
gz sim robot_world.sdf

# Terminal 2: Launch ROS 2 nodes + bridge
ros2 launch my_robot sim.launch.py

# Terminal 3: Visualize in RViz2
ros2 run rviz2 rviz2

# Terminal 4: Teleop (keyboard control)
ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

## Headless Simulation for CI/CD

```bash
# Run without GUI (useful in pipelines)
gz sim -s robot_world.sdf &   # -s = server only

# Or with ROS2 launch
ros2 launch my_robot sim.launch.py headless:=true
```

:::tip
For mass simulation (training AI policies), use **Isaac Gym** or **Mujoco** — they run 1000s of parallel environments on a GPU. Gazebo is better for single-robot, high-fidelity validation.
:::

## Summary

Gazebo is essential infrastructure for safe robot development. Key skills:
- Writing SDF world files
- Adding sensor plugins to URDF
- Bridging Gazebo ↔ ROS 2 topics
- Tuning physics parameters for stability

Next: we build the perception stack that processes sensor data.
