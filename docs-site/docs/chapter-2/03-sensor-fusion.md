---
title: Kalman Filter & Sensor Fusion
description: Combining data from multiple sensors using the Extended Kalman Filter for accurate state estimation.
sidebar_position: 3
---

# Kalman Filter & Sensor Fusion

No single sensor is perfect. Cameras are affected by lighting; LiDAR struggles in rain; GPS drifts indoors. **Sensor fusion** combines multiple imperfect sensors to produce a single, reliable state estimate. The **Kalman Filter** is the mathematical foundation of this process.

## The Sensor Fusion Problem

A robot needs to know its **state** — position, velocity, orientation — at all times. It has:
- **Process model**: how the state evolves over time (physics)
- **Sensor models**: how each sensor relates to the state

Sensor fusion optimally blends these two sources of information.

## Kalman Filter Intuition

The Kalman Filter alternates two steps:

1. **Predict**: Use the physics model to predict where the robot should be now
2. **Update**: Correct the prediction using a new sensor measurement

The correction weight (Kalman Gain **K**) depends on trust: if the sensor is very accurate, trust it more; if the model is accurate, trust it more.

```
K = P_pred × Hᵀ × (H × P_pred × Hᵀ + R)⁻¹
```

Where:
- `P_pred` = predicted covariance (model uncertainty)
- `H` = observation matrix (relates state to measurement)
- `R` = measurement noise covariance

## Python Implementation: 1D Kalman Filter

```python
import numpy as np

class KalmanFilter1D:
    """
    Tracks position and velocity of a 1D system.
    State: [position, velocity]
    """
    def __init__(
        self,
        dt: float = 0.01,        # time step
        process_noise: float = 0.1,
        measurement_noise: float = 1.0
    ):
        # State vector [x, v]
        self.x = np.array([[0.0], [0.0]])

        # State transition matrix: x_new = F * x
        self.F = np.array([[1, dt], [0, 1]])

        # Observation matrix: z = H * x (we only observe position)
        self.H = np.array([[1, 0]])

        # Process noise covariance
        self.Q = process_noise * np.eye(2)

        # Measurement noise covariance
        self.R = np.array([[measurement_noise]])

        # Error covariance (uncertainty in state estimate)
        self.P = np.eye(2) * 1000.0  # high initial uncertainty

    def predict(self):
        """Predict next state."""
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q
        return self.x[0, 0]  # predicted position

    def update(self, measurement: float):
        """Update with new sensor measurement."""
        z = np.array([[measurement]])
        S = self.H @ self.P @ self.H.T + self.R  # Innovation covariance
        K = self.P @ self.H.T @ np.linalg.inv(S) # Kalman gain
        y = z - self.H @ self.x                   # Innovation
        self.x = self.x + K @ y
        self.P = (np.eye(2) - K @ self.H) @ self.P
        return self.x[0, 0]  # updated position
```

## Extended Kalman Filter (EKF) for Robot Pose

For nonlinear systems (like robot orientation), we use the **EKF**, which linearizes around the current estimate using Jacobians:

```python
class RobotEKF:
    """
    2D robot pose estimation: [x, y, theta, v, omega]
    Fuses wheel odometry + IMU + GPS.
    """
    def __init__(self):
        self.state = np.zeros(5)  # [x, y, theta, v, omega]
        self.P = np.diag([1.0, 1.0, 0.1, 0.5, 0.1])

        # Process noise
        self.Q = np.diag([0.01, 0.01, 0.001, 0.1, 0.01])

        # GPS measurement noise (meters)
        self.R_gps = np.diag([0.5, 0.5])

        # IMU measurement noise
        self.R_imu = np.diag([0.01])  # heading

    def motion_model(self, state, dt):
        """Non-linear motion model."""
        x, y, theta, v, omega = state
        x_new = x + v * np.cos(theta) * dt
        y_new = y + v * np.sin(theta) * dt
        theta_new = theta + omega * dt
        return np.array([x_new, y_new, theta_new, v, omega])

    def motion_jacobian(self, state, dt):
        """Jacobian of motion model wrt state."""
        _, _, theta, v, _ = state
        F = np.eye(5)
        F[0, 2] = -v * np.sin(theta) * dt
        F[0, 3] = np.cos(theta) * dt
        F[1, 2] = v * np.cos(theta) * dt
        F[1, 3] = np.sin(theta) * dt
        F[2, 4] = dt
        return F

    def predict(self, dt: float):
        F = self.motion_jacobian(self.state, dt)
        self.state = self.motion_model(self.state, dt)
        self.P = F @ self.P @ F.T + self.Q

    def update_gps(self, gps_x: float, gps_y: float):
        """Update with GPS position fix."""
        H = np.zeros((2, 5))
        H[0, 0] = 1.0
        H[1, 1] = 1.0
        z = np.array([gps_x, gps_y])
        self._update(z, H, self.R_gps)

    def update_imu(self, heading: float):
        """Update with IMU heading measurement."""
        H = np.zeros((1, 5))
        H[0, 2] = 1.0
        z = np.array([heading])
        self._update(z, H, self.R_imu)

    def _update(self, z, H, R):
        """Generic EKF update step."""
        y = z - H @ self.state
        # Normalize angle
        if H.shape[0] == 1 and H[0, 2] == 1.0:
            y[0] = (y[0] + np.pi) % (2 * np.pi) - np.pi
        S = H @ self.P @ H.T + R
        K = self.P @ H.T @ np.linalg.inv(S)
        self.state = self.state + K @ y
        self.P = (np.eye(5) - K @ H) @ self.P
```

## ROS 2 robot_localization Package

For production systems, use the battle-tested `robot_localization` package:

```bash
sudo apt install ros-humble-robot-localization
```

```yaml
# ekf.yaml — fuse odometry + IMU
frequency: 30.0
sensor_timeout: 0.1
two_d_mode: false
publish_tf: true
map_frame: map
odom_frame: odom
base_link_frame: base_link
world_frame: odom

odom0: /wheel_odometry
odom0_config: [true, true, false,   # x, y, z
               false, false, true,  # roll, pitch, yaw
               true, true, false,   # vx, vy, vz
               false, false, true,  # vroll, vpitch, vyaw
               false, false, false] # ax, ay, az

imu0: /imu/data
imu0_config: [false, false, false,
              true, true, true,
              false, false, false,
              true, true, true,
              true, true, true]
imu0_remove_gravitational_acceleration: true
```

```bash
ros2 launch robot_localization ekf.launch.py
```

:::tip
Always visualize your EKF state estimate vs raw sensor data in RViz2. If the estimate diverges, check your covariance matrices first — wrong noise values are the most common EKF bug.
:::

## IMU Dead Reckoning

When GPS is unavailable (indoors), estimate position from IMU alone:

```python
class IMUDeadReckoning:
    def __init__(self, dt: float = 0.01):
        self.dt = dt
        self.pos = np.zeros(3)
        self.vel = np.zeros(3)
        self.orientation = np.eye(3)  # rotation matrix

    def update(self, accel: np.ndarray, gyro: np.ndarray):
        """
        accel: [ax, ay, az] in m/s² (body frame, gravity-corrected)
        gyro:  [wx, wy, wz] in rad/s
        """
        # Rotate acceleration to world frame
        accel_world = self.orientation @ accel

        # Integrate acceleration → velocity → position
        self.vel += accel_world * self.dt
        self.pos += self.vel * self.dt

        # Update rotation (small-angle approximation)
        angle = np.linalg.norm(gyro) * self.dt
        if angle > 1e-10:
            axis = gyro / np.linalg.norm(gyro)
            K = np.array([[0, -axis[2], axis[1]],
                          [axis[2], 0, -axis[0]],
                          [-axis[1], axis[0], 0]])
            dR = np.eye(3) + np.sin(angle)*K + (1-np.cos(angle))*(K@K)
            self.orientation = self.orientation @ dR

        return self.pos.copy()
```

:::warning
IMU dead reckoning drifts fast — position error grows as O(t²). Always fuse with a position sensor (GPS, visual odometry, or UWB) for long-duration operation.
:::

## Summary

Sensor fusion via Kalman Filtering is the backbone of reliable robot state estimation. Key concepts:
- **KF**: optimal for linear systems with Gaussian noise
- **EKF**: linearization handles nonlinear robot models
- **robot_localization**: production-ready ROS 2 package
- Always fuse ≥2 independent sensors for robustness
