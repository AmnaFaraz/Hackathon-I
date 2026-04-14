---
title: A* and RRT Path Planning Algorithms
description: Implementing A* and Rapidly-exploring Random Trees for autonomous robot navigation.
sidebar_position: 1
slug: intro
---

import AskButton from '@site/src/components/AskButton';

<div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--ifm-border-color)' }}>
  <small style={{ color: 'var(--ifm-color-content)', opacity: 0.6 }}>
    Home &gt; Chapters &gt; Path Planning Algorithms
  </small>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
     <small style={{ color: 'var(--ifm-color-content)', opacity: 0.6 }}>⏱️ 10 min read</small>
     <AskButton title="Path Planning" />
  </div>
</div>

# A* and RRT Path Planning Algorithms

Path planning is the process of finding a collision-free route from a start position to a goal. Two algorithms dominate robotic path planning: **A\*** for grid-based environments and **RRT** (Rapidly-exploring Random Trees) for high-dimensional configuration spaces.

## A* Algorithm

A\* is a best-first search algorithm that guarantees finding the shortest path by combining:
- **g(n)**: actual cost from start to node n
- **h(n)**: heuristic estimate from n to goal
- **f(n) = g(n) + h(n)**: total estimated cost

```python
import heapq
import numpy as np
from typing import Optional

class AStarPlanner:
    def __init__(self, grid: np.ndarray, resolution: float = 0.05):
        """
        grid: 2D numpy array. 0=free, 1=obstacle
        resolution: meters per cell
        """
        self.grid = grid
        self.res = resolution
        self.h, self.w = grid.shape

    def heuristic(self, a: tuple, b: tuple) -> float:
        """Euclidean distance heuristic."""
        return np.hypot(b[0] - a[0], b[1] - a[1])

    def plan(
        self,
        start: tuple[int, int],
        goal: tuple[int, int]
    ) -> Optional[list[tuple[int, int]]]:
        """
        Returns list of (row, col) cells from start to goal,
        or None if no path exists.
        """
        open_set = []
        heapq.heappush(open_set, (0.0, start))

        came_from = {}
        g_score = {start: 0.0}
        f_score = {start: self.heuristic(start, goal)}

        neighbors_8 = [
            (-1,-1),(-1,0),(-1,1),
            (0,-1),         (0,1),
            (1,-1), (1,0),  (1,1)
        ]

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == goal:
                return self._reconstruct(came_from, current)

            for dr, dc in neighbors_8:
                nr, nc = current[0]+dr, current[1]+dc
                if not (0 <= nr < self.h and 0 <= nc < self.w):
                    continue
                if self.grid[nr, nc] == 1:  # obstacle
                    continue

                move_cost = 1.414 if (dr != 0 and dc != 0) else 1.0
                tentative_g = g_score[current] + move_cost

                neighbor = (nr, nc)
                if tentative_g < g_score.get(neighbor, float('inf')):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f = tentative_g + self.heuristic(neighbor, goal)
                    f_score[neighbor] = f
                    heapq.heappush(open_set, (f, neighbor))

        return None  # No path found

    def _reconstruct(self, came_from, current):
        path = [current]
        while current in came_from:
            current = came_from[current]
            path.append(current)
        return list(reversed(path))

    def world_to_grid(self, wx: float, wy: float, origin=(0,0)):
        """Convert world coordinates (meters) to grid indices."""
        row = int((wy - origin[1]) / self.res)
        col = int((wx - origin[0]) / self.res)
        return row, col

    def grid_to_world(self, row: int, col: int, origin=(0,0)):
        """Convert grid indices to world coordinates (meters)."""
        wx = col * self.res + origin[0]
        wy = row * self.res + origin[1]
        return wx, wy
```

## RRT (Rapidly-exploring Random Trees)

RRT excels in high-dimensional spaces (robot arm with 7+ DoF) where grid-based methods are infeasible:

```python
import random
from dataclasses import dataclass, field

@dataclass
class RRTNode:
    x: float
    y: float
    parent: Optional['RRTNode'] = field(default=None, repr=False)

class RRTPlanner:
    def __init__(
        self,
        x_range: tuple[float, float],
        y_range: tuple[float, float],
        obstacle_check_fn,
        step_size: float = 0.3,
        max_iter: int = 5000,
        goal_bias: float = 0.1
    ):
        self.x_range = x_range
        self.y_range = y_range
        self.is_collision = obstacle_check_fn
        self.step_size = step_size
        self.max_iter = max_iter
        self.goal_bias = goal_bias

    def plan(
        self,
        start: tuple[float, float],
        goal: tuple[float, float],
        goal_threshold: float = 0.5
    ) -> Optional[list[tuple[float, float]]]:
        start_node = RRTNode(*start)
        goal_node = RRTNode(*goal)
        tree = [start_node]

        for _ in range(self.max_iter):
            # Sample random point (with goal bias)
            if random.random() < self.goal_bias:
                rand = goal
            else:
                rand = (
                    random.uniform(*self.x_range),
                    random.uniform(*self.y_range)
                )

            # Find nearest node in tree
            nearest = min(tree, key=lambda n: self._dist(n, rand))

            # Steer toward random point
            new_node = self._steer(nearest, rand)

            # Check collision
            if self.is_collision(nearest.x, nearest.y,
                                  new_node.x, new_node.y):
                continue

            tree.append(new_node)

            # Check if goal reached
            if self._dist(new_node, goal) < goal_threshold:
                goal_node.parent = new_node
                return self._extract_path(goal_node)

        return None  # Max iterations reached

    def _dist(self, node, point):
        if isinstance(point, RRTNode):
            return np.hypot(node.x - point.x, node.y - point.y)
        return np.hypot(node.x - point[0], node.y - point[1])

    def _steer(self, from_node: RRTNode, to: tuple) -> RRTNode:
        dx = to[0] - from_node.x
        dy = to[1] - from_node.y
        dist = np.hypot(dx, dy)
        if dist < self.step_size:
            return RRTNode(to[0], to[1], parent=from_node)
        scale = self.step_size / dist
        return RRTNode(
            from_node.x + dx * scale,
            from_node.y + dy * scale,
            parent=from_node
        )

    def _extract_path(self, node: RRTNode):
        path = []
        while node is not None:
            path.append((node.x, node.y))
            node = node.parent
        return list(reversed(path))
```

## Path Smoothing

Raw paths from A\* or RRT are jagged. Smooth them with B-splines:

```python
from scipy.interpolate import splprep, splev

def smooth_path(
    path: list[tuple[float, float]],
    smoothing: float = 0.5,
    num_points: int = 100
) -> list[tuple[float, float]]:
    """Smooth a path using B-spline interpolation."""
    if len(path) < 4:
        return path

    xs = [p[0] for p in path]
    ys = [p[1] for p in path]

    tck, _ = splprep([xs, ys], s=smoothing, k=3)
    t = np.linspace(0, 1, num_points)
    sx, sy = splev(t, tck)
    return list(zip(sx.tolist(), sy.tolist()))
```

## Nav2 Integration (ROS 2)

For production navigation, use **Nav2** (Navigation 2):

```bash
sudo apt install ros-humble-navigation2 ros-humble-nav2-bringup
```

```yaml
# nav2_params.yaml (key sections)
bt_navigator:
  ros__parameters:
    global_frame: map
    robot_base_frame: base_link
    default_bt_xml_filename: "navigate_w_replanning_and_recovery.xml"

planner_server:
  ros__parameters:
    planner_plugins: ["GridBased"]
    GridBased:
      plugin: "nav2_navfn_planner/NavfnPlanner"
      tolerance: 0.5
      use_astar: true

controller_server:
  ros__parameters:
    controller_plugins: ["FollowPath"]
    FollowPath:
      plugin: "nav2_mppi_controller::MPPIController"
      time_steps: 56
      model_dt: 0.05
      batch_size: 2000
      vx_max: 0.5
      vy_max: 0.0
      wz_max: 1.9
```

:::info
**Nav2 MPPI Controller** (Model Predictive Path Integral) outperforms DWB for humanoid navigation because it handles dynamic constraints naturally and avoids oscillation.
:::

## Algorithm Comparison

| Algorithm | Completeness | Optimality | Dimensions | Speed |
|---|---|---|---|---|
| A* | Yes (finite grid) | Yes | 2D/3D | Fast |
| RRT | Probabilistic | No | High-D | Medium |
| RRT* | Probabilistic | Asymptotic | High-D | Slow |
| PRM | Probabilistic | No | High-D | Fast (query) |
| Nav2 MPPI | - | No | 2D | Real-time |

## Summary

- Use **A\*** for 2D navigation with known maps
- Use **RRT** for high-DoF arm planning
- Use **Nav2** for complete autonomous navigation in ROS 2
- Always smooth raw paths before sending to the controller
