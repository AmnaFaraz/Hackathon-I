---
title: Bipedal Walking Control
description: Controlling bipedal locomotion using Zero Moment Point theory, model predictive control, and learning-based methods.
sidebar_position: 3
---

# Bipedal Walking Control

Bipedal walking is one of the most challenging problems in robotics. Humans do it effortlessly; robots struggle because walking is an inherently unstable process — the robot is always on the verge of falling. This chapter covers the physics and control algorithms that make walking possible.

## Why Walking is Hard

A walking robot is an **underactuated system** — it has fewer control inputs than degrees of freedom. The key constraint: the foot can only push, never pull, against the ground. This means the robot must constantly manage its **center of mass (CoM)** trajectory to avoid falling.

## Zero Moment Point (ZMP)

The **Zero Moment Point** is the point on the ground where the net ground reaction force has zero moment. For a robot to be stable:

**ZMP must remain within the support polygon (convex hull of contact points)**

```python
import numpy as np

def compute_zmp(
    com_pos: np.ndarray,       # [x, y, z] center of mass
    com_accel: np.ndarray,     # [ax, ay, az] CoM acceleration
    g: float = 9.81
) -> tuple[float, float]:
    """
    Compute ZMP position on the ground plane.
    Assumes flat ground at z=0.
    """
    # Simplified ZMP formula (Vukobratovic):
    # ZMP_x = com_x - (com_z * com_accel_x) / (g + com_accel_z)
    # ZMP_y = com_y - (com_z * com_accel_y) / (g + com_accel_z)
    denom = g + com_accel[2]
    if abs(denom) < 1e-6:
        return com_pos[0], com_pos[1]  # degenerate case

    zmp_x = com_pos[0] - (com_pos[2] * com_accel[0]) / denom
    zmp_y = com_pos[1] - (com_pos[2] * com_accel[1]) / denom
    return zmp_x, zmp_y

def is_stable(zmp: tuple[float, float], support_polygon: list[tuple]) -> bool:
    """Check if ZMP is inside the support polygon using winding number."""
    from shapely.geometry import Point, Polygon
    p = Point(zmp)
    poly = Polygon(support_polygon)
    return poly.contains(p)
```

## Linear Inverted Pendulum Model (LIPM)

The LIPM simplifies the robot to a point mass on a massless rod — surprisingly effective for gait planning:

```python
class LIPMWalkingPlanner:
    """
    Linear Inverted Pendulum Model gait planner.
    Plans CoM trajectory to track a desired ZMP trajectory.
    """
    def __init__(self, com_height: float = 0.85, dt: float = 0.005):
        self.h = com_height  # CoM height (constant in LIPM)
        self.dt = dt
        self.g = 9.81
        self.omega = np.sqrt(self.g / self.h)  # natural frequency

        # State: [x, x_dot, y, y_dot]
        self.state = np.zeros(4)

    def step(self, zmp_ref_x: float, zmp_ref_y: float) -> np.ndarray:
        """Advance CoM state by one timestep given reference ZMP."""
        x, xd, y, yd = self.state

        # LIPM dynamics: x_ddot = omega² * (x - zmp_x)
        xdd = self.omega**2 * (x - zmp_ref_x)
        ydd = self.omega**2 * (y - zmp_ref_y)

        # Semi-implicit Euler integration
        xd_new = xd + xdd * self.dt
        x_new = x + xd_new * self.dt
        yd_new = yd + ydd * self.dt
        y_new = y + yd_new * self.dt

        self.state = np.array([x_new, xd_new, y_new, yd_new])
        return self.state.copy()

    def generate_step_sequence(
        self,
        n_steps: int = 10,
        step_length: float = 0.3,
        step_width: float = 0.18,
        step_duration: float = 0.5
    ) -> list[dict]:
        """Generate a sequence of footstep targets."""
        steps = []
        for i in range(n_steps):
            side = 'right' if i % 2 == 0 else 'left'
            x = i * step_length / 2
            y = step_width / 2 * (1 if side == 'right' else -1)
            steps.append({
                'foot': side,
                'x': x, 'y': y,
                'duration': step_duration,
                'height': 0.08  # 8 cm step height
            })
        return steps
```

## Swing Foot Trajectory

During each step, the swing foot must lift, swing, and land gracefully:

```python
def swing_trajectory(
    start: np.ndarray,       # [x, y, z] lift-off position
    end: np.ndarray,         # [x, y, z] landing position
    max_height: float = 0.08,
    t: float = 0.0,          # normalized time [0, 1]
) -> np.ndarray:
    """
    Generate smooth swing foot position at normalized time t.
    Uses cubic polynomial for horizontal, parabola for vertical.
    """
    # Horizontal: cubic interpolation
    pos_xy = (1 - t)**2 * (1 + 2*t) * start[:2] + t**2 * (3 - 2*t) * end[:2]

    # Vertical: parabolic arc
    pos_z = max_height * 4 * t * (1 - t)  # parabola, zero at t=0 and t=1

    return np.array([pos_xy[0], pos_xy[1], pos_z])
```

## Whole-Body Control (WBC)

Modern humanoids use **Whole-Body Control** — a QP (quadratic program) that simultaneously handles:
- CoM tracking
- Swing foot tracking
- Angular momentum
- Joint limits and torque limits

```python
from scipy.optimize import minimize

class SimpleWBC:
    def __init__(self, n_joints: int):
        self.n = n_joints

    def solve(
        self,
        M: np.ndarray,     # mass matrix (n×n)
        C: np.ndarray,     # Coriolis + gravity (n×1)
        J_com: np.ndarray, # CoM Jacobian (3×n)
        ddx_com_des: np.ndarray,  # desired CoM acceleration
        joint_limits: tuple = (-np.pi, np.pi)
    ) -> np.ndarray:
        """Solve for joint accelerations using WBC."""
        def objective(ddq):
            # Minimize norm of joint accelerations
            return np.linalg.norm(ddq)**2

        def task_constraint(ddq):
            # CoM acceleration task: J*ddq + Jdot*dq = ddx_des
            return J_com @ ddq - ddx_com_des

        constraints = [{'type': 'eq', 'fun': task_constraint}]
        bounds = [joint_limits] * self.n
        x0 = np.zeros(self.n)

        result = minimize(objective, x0, method='SLSQP',
                         constraints=constraints, bounds=bounds)
        return result.x
```

## Learning-Based Locomotion

The frontier of bipedal locomotion is **reinforcement learning**. NVIDIA Isaac Lab trains locomotion policies in simulation:

```python
# Simplified RL training loop concept
# (Full implementation uses IsaacLab / RSL-RL)

class LocomotionPolicy:
    """
    Neural network policy for bipedal locomotion.
    Input: proprioceptive state (joint angles, velocities, IMU)
    Output: joint position targets
    """
    def __init__(self, n_joints: int = 12):
        import torch.nn as nn
        self.net = nn.Sequential(
            nn.Linear(48, 256),  # 48-dim observation
            nn.ELU(),
            nn.Linear(256, 256),
            nn.ELU(),
            nn.Linear(256, n_joints)
        )

    def get_action(self, obs: np.ndarray) -> np.ndarray:
        import torch
        with torch.no_grad():
            obs_t = torch.FloatTensor(obs).unsqueeze(0)
            return self.net(obs_t).squeeze(0).numpy()
```

:::tip
**Unitree H1** and **Go2** robots are popular research platforms for learning-based locomotion. They ship with ROS 2 support and have active open-source communities.
:::

## Summary

Bipedal walking control progresses from classical to learned:
- **ZMP** provides stability criterion
- **LIPM** enables online footstep planning
- **Swing trajectory** gives smooth foot motion
- **WBC** handles full-body coordination
- **RL policies** achieve robust, adaptive locomotion
