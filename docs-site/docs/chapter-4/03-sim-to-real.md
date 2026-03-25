---
title: Sim-to-Real Transfer
description: Bridging the reality gap between simulation and physical robots using domain randomization, system identification, and adaptation layers.
sidebar_position: 3
---

# Sim-to-Real Transfer

Training robots in simulation is fast and safe. Deploying those policies on real hardware is where the challenge lies — the **reality gap**. Sim-to-real transfer is the set of techniques that minimize this gap.

## Sources of the Reality Gap

| Source | Description | Impact |
|---|---|---|
| **Dynamics mismatch** | Simulated physics ≠ real physics | Policy fails on real robot |
| **Sensor noise** | Real sensors are noisy and imperfect | Wrong observations → wrong actions |
| **Actuator delays** | Real motors have response lag | Instability in fast motions |
| **Contact dynamics** | Friction, ground compliance | Slipping, falling |
| **Visual domain** | Sim images look different from real | Vision models fail |

## Domain Randomization

The primary technique: train in simulation with **randomized parameters** so the policy learns to generalize across a wide range of dynamics:

```python
"""
Domain randomization for locomotion training in Isaac Lab.
"""
import torch
from omni.isaac.lab.envs import ManagerBasedRLEnv

class DomainRandomizer:
    def __init__(
        self,
        mass_range: tuple = (0.8, 1.2),         # ±20% mass variation
        friction_range: tuple = (0.4, 1.5),      # floor friction
        push_force_range: tuple = (0.0, 100.0),  # random external pushes
        motor_delay_range: tuple = (0.0, 0.02),  # 0–20ms action delay
        payload_range: tuple = (0.0, 5.0),       # 0–5 kg backpack
    ):
        self.mass_range = mass_range
        self.friction_range = friction_range
        self.push_force_range = push_force_range
        self.motor_delay_range = motor_delay_range
        self.payload_range = payload_range

    def randomize_episode(self, env: ManagerBasedRLEnv, env_ids: torch.Tensor):
        """Apply random parameters to selected environments."""
        n = len(env_ids)

        # Randomize link masses
        mass_scale = torch.FloatTensor(n).uniform_(*self.mass_range)
        env.scene.robots["h1"].data.default_mass[env_ids] *= mass_scale.unsqueeze(-1)

        # Randomize floor friction
        friction = torch.FloatTensor(n).uniform_(*self.friction_range)
        env.scene.terrain.material_properties[env_ids, 0] = friction

        # Add random payload
        payload = torch.FloatTensor(n).uniform_(*self.payload_range)
        # Add mass to torso link
        torso_idx = env.scene.robots["h1"].find_bodies("torso")[0]
        env.scene.robots["h1"].data.default_mass[env_ids, torso_idx] += payload

    def add_random_push(
        self, env: ManagerBasedRLEnv, env_ids: torch.Tensor, step: int
    ):
        """Randomly push robots every 5 seconds."""
        if step % 500 != 0:
            return
        n = len(env_ids)
        force = torch.FloatTensor(n, 3).uniform_(
            -self.push_force_range[1], self.push_force_range[1]
        )
        env.scene.robots["h1"].apply_external_force(force, env_ids=env_ids)
```

## System Identification (Sysid)

Rather than randomizing blindly, **system identification** measures real robot parameters and programs them into simulation:

```python
class SystemIdentification:
    """
    Estimate robot physical parameters from real hardware data.
    Uses least-squares regression on recorded trajectory data.
    """

    def identify_joint_friction(
        self,
        commanded_torques: np.ndarray,   # shape (T, n_joints)
        joint_velocities: np.ndarray,    # shape (T, n_joints)
        joint_accelerations: np.ndarray, # shape (T, n_joints)
        inertias: np.ndarray             # known joint inertias
    ) -> np.ndarray:
        """
        Model: τ_cmd = I*q_ddot + b*q_dot + f*sign(q_dot)
        Solve for b (viscous) and f (coulomb) friction.
        """
        n_joints = commanded_torques.shape[1]
        friction_params = np.zeros((n_joints, 2))  # [b, f] per joint

        for j in range(n_joints):
            tau = commanded_torques[:, j]
            qd = joint_velocities[:, j]
            qdd = joint_accelerations[:, j]

            # Remove inertia component
            tau_net = tau - inertias[j] * qdd

            # Regression matrix: [q_dot, sign(q_dot)]
            A = np.column_stack([qd, np.sign(qd)])
            # Least squares: tau_net = A @ [b, f]
            result, _, _, _ = np.linalg.lstsq(A, tau_net, rcond=None)
            friction_params[j] = result

        return friction_params

    def identify_contact_parameters(
        self,
        grf_data: np.ndarray,     # ground reaction forces (T, 3)
        foot_velocities: np.ndarray  # foot velocity at contact (T, 3)
    ) -> dict:
        """Estimate floor friction coefficient from contact data."""
        # Coulomb friction: |F_tangential| / F_normal
        F_normal = grf_data[:, 2]
        F_tangential = np.linalg.norm(grf_data[:, :2], axis=1)

        valid = F_normal > 10.0  # filter weak contacts
        mu_estimates = F_tangential[valid] / F_normal[valid]

        return {
            "mu_mean": float(mu_estimates.mean()),
            "mu_std": float(mu_estimates.std()),
            "mu_conservative": float(np.percentile(mu_estimates, 10))
        }
```

## Privileged Learning

Train a **teacher policy** in simulation with access to privileged information (true friction, true mass), then distill it into a **student policy** that only uses real-sensor observations:

```python
import torch
import torch.nn as nn

class TeacherPolicy(nn.Module):
    """
    Teacher has access to privileged info (only available in sim).
    """
    def __init__(self, obs_dim: int, priv_dim: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim + priv_dim, 256),  # privileged obs
            nn.ELU(),
            nn.Linear(256, 256),
            nn.ELU(),
            nn.Linear(256, action_dim)
        )

class StudentPolicy(nn.Module):
    """
    Student only sees real sensor observations.
    Trained via DAgger to match teacher actions.
    """
    def __init__(self, obs_dim: int, action_dim: int, history_len: int = 50):
        super().__init__()
        # GRU to estimate hidden state (implicit privileged info)
        self.gru = nn.GRU(obs_dim, 64, batch_first=True)
        self.policy_net = nn.Sequential(
            nn.Linear(obs_dim + 64, 256),
            nn.ELU(),
            nn.Linear(256, action_dim)
        )
        self.hidden = None

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        obs_seq = obs.unsqueeze(1)
        gru_out, self.hidden = self.gru(obs_seq, self.hidden)
        latent = gru_out.squeeze(1)
        return self.policy_net(torch.cat([obs, latent], dim=-1))

def distill_teacher_to_student(teacher, student, sim_env, n_steps=500000):
    """DAgger distillation loop."""
    optimizer = torch.optim.Adam(student.parameters(), lr=1e-4)
    loss_fn = nn.MSELoss()

    obs = sim_env.reset()
    for step in range(n_steps):
        with torch.no_grad():
            teacher_action = teacher(obs)

        student_action = student(obs[:, :student_obs_dim])
        loss = loss_fn(student_action, teacher_action)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        obs, _, done, _ = sim_env.step(teacher_action)  # collect with teacher
        if done.any():
            obs = sim_env.reset()
```

## Adaptation at Deployment

Once deployed, a fast **adaptation module** estimates latent environment parameters from recent observation history:

```python
class RapidMotorAdaptation(nn.Module):
    """
    Estimates latent environment parameters from observation history.
    Deployed on-robot to adapt to real-world conditions.
    Reference: Kumar et al., "RMA: Rapid Motor Adaptation" (2021)
    """
    def __init__(self, obs_dim: int, latent_dim: int = 8, history_len: int = 50):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(obs_dim * history_len, 256),
            nn.ELU(),
            nn.Linear(256, latent_dim)
        )

    def forward(self, obs_history: torch.Tensor) -> torch.Tensor:
        """
        obs_history: (batch, history_len, obs_dim)
        Returns: (batch, latent_dim) — estimated env vector
        """
        flat = obs_history.view(obs_history.shape[0], -1)
        return self.encoder(flat)
```

:::tip
**ETH Zürich's ANYmal** and **CMU/Berkeley's Spot** locomotion papers use exactly this teacher-student + adaptation pipeline. It's currently the most reliable approach for real-world deployment.
:::

## Deployment Checklist

Before deploying a sim-trained policy to real hardware:
- [ ] System identification complete (mass, friction, delays measured)
- [ ] Domain randomization covers ±20% of all identified parameters
- [ ] Student policy distillation loss < 0.001 MSE
- [ ] 100+ episodes in digital twin with < 2% fall rate
- [ ] Safety stop tested (E-stop interrupts within 10ms)
- [ ] Gradual rollout: 10% speed → 50% → 100%

## Summary

Sim-to-real transfer requires:
- **Domain randomization** to expose the policy to diverse physics
- **System identification** to narrow the sim parameters to reality
- **Privileged learning** to transfer knowledge despite sensor limits
- **Adaptation modules** to handle distribution shift at runtime
