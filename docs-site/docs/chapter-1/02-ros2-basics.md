---
title: ROS 2 Architecture & Nodes
description: Deep dive into the Robot Operating System 2 — nodes, topics, services, and actions.
sidebar_position: 2
---

# ROS 2 Architecture & Nodes

**ROS 2** (Robot Operating System 2) is not an operating system — it is a set of software libraries and tools for building robot applications. It handles the hard problems of robotics middleware: inter-process communication, hardware abstraction, simulation integration, and tooling.

## Why ROS 2 over ROS 1?

ROS 1 was groundbreaking but had architectural limitations. ROS 2 was redesigned from scratch:

| Feature | ROS 1 | ROS 2 |
|---|---|---|
| Communication | Custom TCPROS | DDS (Data Distribution Service) |
| Real-time support | No | Yes (with RTOS) |
| Security | None | SROS2 (TLS, authentication) |
| Multi-robot | Hard | Native |
| Python | 2.x | 3.x |
| Lifecycle nodes | No | Yes |

## Core Concepts

### Nodes
A **node** is the fundamental unit of computation in ROS 2. Each node is a process that performs a specific function:
- `camera_driver` node: reads camera and publishes images
- `lidar_driver` node: reads LiDAR and publishes point clouds
- `motion_planner` node: subscribes to goals, publishes joint trajectories
- `joint_controller` node: subscribes to trajectories, controls motors

Nodes communicate via **topics**, **services**, and **actions**.

### Topics (Publish/Subscribe)

Topics are asynchronous, one-to-many communication channels:

```python
import rclpy
from rclpy.node import Node
from std_msgs.msg import Float64MultiArray

class JointPublisher(Node):
    def __init__(self):
        super().__init__('joint_publisher')
        self.publisher_ = self.create_publisher(
            Float64MultiArray, '/joint_commands', 10
        )
        # Publish at 100 Hz
        self.timer = self.create_timer(0.01, self.publish_joints)

    def publish_joints(self):
        msg = Float64MultiArray()
        msg.data = [0.0, 0.5, -0.3, 0.1]  # 4 joint angles (radians)
        self.publisher_.publish(msg)
        self.get_logger().info(f'Publishing: {msg.data}')

def main():
    rclpy.init()
    node = JointPublisher()
    rclpy.spin(node)
    rclpy.shutdown()
```

### Services (Request/Response)

Services are synchronous, one-to-one calls for discrete operations:

```python
from example_interfaces.srv import AddTwoInts

class AddService(Node):
    def __init__(self):
        super().__init__('add_service')
        self.srv = self.create_service(
            AddTwoInts, 'add_two_ints', self.add_callback
        )

    def add_callback(self, request, response):
        response.sum = request.a + request.b
        return response
```

### Actions (Long-Running Tasks)

Actions are for tasks that take time and require feedback — perfect for robot motion:

```python
from rclpy.action import ActionServer
from control_msgs.action import FollowJointTrajectory

class TrajectoryServer(Node):
    def __init__(self):
        super().__init__('trajectory_server')
        self._action_server = ActionServer(
            self,
            FollowJointTrajectory,
            'follow_joint_trajectory',
            self.execute_callback
        )

    async def execute_callback(self, goal_handle):
        # Stream feedback during execution
        feedback = FollowJointTrajectory.Feedback()
        for i in range(100):
            feedback.actual.time_from_start.sec = i
            goal_handle.publish_feedback(feedback)
        goal_handle.succeed()
        return FollowJointTrajectory.Result()
```

## TF2: Coordinate Frame Management

ROS 2 uses **TF2** to track coordinate transformations between frames. Every physical component of the robot has its own frame:

```
world
  └── base_footprint
        └── base_link
              ├── torso_link
              │     ├── left_shoulder_link
              │     │     └── left_hand_link
              │     └── right_shoulder_link
              └── head_link
```

```python
from tf2_ros import TransformBroadcaster
from geometry_msgs.msg import TransformStamped

class FrameBroadcaster(Node):
    def __init__(self):
        super().__init__('frame_broadcaster')
        self.br = TransformBroadcaster(self)
        self.timer = self.create_timer(0.1, self.broadcast)

    def broadcast(self):
        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = 'base_link'
        t.child_frame_id = 'camera_link'
        t.transform.translation.x = 0.0
        t.transform.translation.y = 0.0
        t.transform.translation.z = 1.5  # camera 1.5m above base
        t.transform.rotation.w = 1.0
        self.br.sendTransform(t)
```

## Launch Files

Launch files coordinate the startup of multiple nodes:

```python
# launch/robot.launch.py
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='robot_drivers',
            executable='camera_node',
            name='front_camera',
            parameters=[{'frame_rate': 30}]
        ),
        Node(
            package='robot_drivers',
            executable='lidar_node',
            name='front_lidar',
        ),
        Node(
            package='motion_planning',
            executable='planner_node',
            name='motion_planner',
        ),
    ])
```

Run it:
```bash
ros2 launch robot_drivers robot.launch.py
```

## Useful CLI Commands

```bash
# List all running nodes
ros2 node list

# Inspect a topic
ros2 topic echo /joint_states

# Check topic rate
ros2 topic hz /camera/image_raw

# Call a service
ros2 service call /add_two_ints example_interfaces/srv/AddTwoInts "{a: 3, b: 5}"

# Record and play back data
ros2 bag record /joint_states /camera/image_raw
ros2 bag play my_recording.db3
```

:::tip
Use `rqt_graph` to visualize the node/topic graph of your entire system in real time:
```bash
rqt_graph
```
:::

## Summary

ROS 2 provides the backbone for all robot software. Master topics, services, actions, and TF2 transforms — everything else in robotics builds on these primitives.
