---
title: Inverse Kinematics for Robot Arms
description: Solving the IK problem analytically and numerically for robot manipulators and humanoid arms.
sidebar_position: 2
---

# Inverse Kinematics for Robot Arms

**Inverse Kinematics (IK)** answers: given a desired end-effector pose (position + orientation), what joint angles produce that pose? It is the inverse of Forward Kinematics (FK), which computes the end-effector pose from joint angles.

IK is fundamentally hard: it is nonlinear, may have multiple solutions, and can be unsolvable (target outside workspace). Robotics engineers use both analytical and numerical methods to solve it.

## Forward Kinematics Review

FK maps joint angles **q** → end-effector pose **T** using Denavit-Hartenberg (DH) parameters:

```python
import numpy as np

def dh_matrix(a: float, alpha: float, d: float, theta: float) -> np.ndarray:
    """Denavit-Hartenberg transformation matrix."""
    ct, st = np.cos(theta), np.sin(theta)
    ca, sa = np.cos(alpha), np.sin(alpha)
    return np.array([
        [ct,    -st*ca,  st*sa,  a*ct],
        [st,     ct*ca, -ct*sa,  a*st],
        [0,      sa,     ca,     d   ],
        [0,      0,      0,      1   ]
    ])

def forward_kinematics(q: list[float], dh_params: list[tuple]) -> np.ndarray:
    """
    Compute end-effector transform from joint angles.
    dh_params: list of (a, alpha, d, theta_offset)
    Returns 4x4 homogeneous transform.
    """
    T = np.eye(4)
    for i, (a, alpha, d, theta_off) in enumerate(dh_params):
        T = T @ dh_matrix(a, alpha, d, q[i] + theta_off)
    return T
```

## Jacobian-Based Numerical IK

The **Jacobian** **J** relates joint velocity **q̇** to end-effector velocity **ẋ**:

```
ẋ = J(q) × q̇
```

Numerical IK iteratively steps in joint space toward the target:

```python
class JacobianIK:
    def __init__(self, fk_fn, n_joints: int, damping: float = 0.01):
        self.fk = fk_fn
        self.n = n_joints
        self.lam = damping  # damping factor (prevents singularities)

    def compute_jacobian(self, q: np.ndarray, delta: float = 1e-5) -> np.ndarray:
        """Numerical Jacobian via finite differences."""
        T0 = self.fk(q)
        p0 = T0[:3, 3]
        J = np.zeros((3, self.n))
        for i in range(self.n):
            q_perturb = q.copy()
            q_perturb[i] += delta
            T_perturb = self.fk(q_perturb)
            J[:, i] = (T_perturb[:3, 3] - p0) / delta
        return J

    def solve(
        self,
        q0: np.ndarray,
        target_pos: np.ndarray,
        max_iter: int = 200,
        tol: float = 1e-3
    ) -> tuple[np.ndarray, bool]:
        """
        Damped Least Squares IK.
        Returns (joint_angles, converged).
        """
        q = q0.copy()
        for iteration in range(max_iter):
            T = self.fk(q)
            error = target_pos - T[:3, 3]

            if np.linalg.norm(error) < tol:
                return q, True

            J = self.compute_jacobian(q)
            # Damped least squares: dq = Jᵀ(JJᵀ + λ²I)⁻¹ × error
            A = J @ J.T + self.lam**2 * np.eye(3)
            dq = J.T @ np.linalg.solve(A, error)

            # Line search step size
            alpha = 0.5
            q = q + alpha * dq

            # Clamp to joint limits
            q = np.clip(q, -np.pi, np.pi)

        return q, False
```

## Analytical IK: 2-Link Arm

For simple manipulators, closed-form solutions exist:

```python
def ik_2link(
    px: float, py: float,
    l1: float, l2: float,
    elbow_up: bool = True
) -> Optional[tuple[float, float]]:
    """
    Analytical IK for a 2-link planar arm.
    Returns (theta1, theta2) in radians.
    """
    r = np.hypot(px, py)

    # Check reachability
    if r > l1 + l2 or r < abs(l1 - l2):
        return None  # Target unreachable

    cos_q2 = (px**2 + py**2 - l1**2 - l2**2) / (2 * l1 * l2)
    cos_q2 = np.clip(cos_q2, -1.0, 1.0)

    # Elbow-up vs elbow-down solutions
    sign = -1 if elbow_up else 1
    sin_q2 = sign * np.sqrt(1 - cos_q2**2)
    theta2 = np.arctan2(sin_q2, cos_q2)

    k1 = l1 + l2 * cos_q2
    k2 = l2 * sin_q2
    theta1 = np.arctan2(py, px) - np.arctan2(k2, k1)

    return theta1, theta2
```

## IK with MoveIt 2 (ROS 2)

For production systems, use **MoveIt 2** — the ROS 2 motion planning framework:

```bash
sudo apt install ros-humble-moveit
```

```python
import rclpy
from moveit.planning import MoveItPy
from moveit.core.robot_state import RobotState

class ArmController:
    def __init__(self):
        rclpy.init()
        self.moveit = MoveItPy(node_name="arm_controller")
        self.arm = self.moveit.get_planning_component("arm")
        self.robot_model = self.moveit.get_robot_model()

    def move_to_pose(self, x: float, y: float, z: float) -> bool:
        """Plan and execute motion to Cartesian goal."""
        from geometry_msgs.msg import PoseStamped
        target = PoseStamped()
        target.header.frame_id = "world"
        target.pose.position.x = x
        target.pose.position.y = y
        target.pose.position.z = z
        target.pose.orientation.w = 1.0

        self.arm.set_start_state_to_current_state()
        self.arm.set_goal_state(pose_stamped_msg=target, pose_link="hand_link")

        plan_result = self.arm.plan()
        if plan_result:
            robot_trajectory = plan_result.trajectory
            self.moveit.execute(robot_trajectory, controllers=[])
            return True
        return False
```

## Singularities

Singularities occur when the Jacobian loses rank — the robot cannot move in certain directions. Near singularities:
- The damping λ in DLS IK prevents infinite joint velocities
- Detect via: `if abs(np.linalg.det(J @ J.T)) < 1e-4: warn_singularity()`

:::warning
Never command a robot arm through a singularity configuration — it causes infinite velocity commands that can damage actuators or cause erratic motion.
:::

## Summary

| Method | Pros | Cons |
|---|---|---|
| Analytical | Exact, fast | Only simple geometries |
| Jacobian DLS | General, 6-DoF | Iterative, may not converge |
| MoveIt 2 | Full planning + collision | Complex setup |

For humanoid arms with 7 DoF (redundant), use **null-space projection** to optimize secondary objectives (elbow position, joint limit avoidance) while tracking the primary IK target.
