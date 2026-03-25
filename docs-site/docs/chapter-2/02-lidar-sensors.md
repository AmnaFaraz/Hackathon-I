---
title: LiDAR & Depth Cameras
description: Using LiDAR point clouds and structured-light depth cameras for 3D environment modeling in robotics.
sidebar_position: 2
---

# LiDAR & Depth Cameras

3D sensors give robots spatial awareness beyond what cameras alone can provide. **LiDAR** (Light Detection and Ranging) and **depth cameras** (structured light or ToF) produce 3D point clouds that enable accurate obstacle avoidance, mapping, and manipulation.

## LiDAR Technology

LiDAR measures distance by emitting laser pulses and measuring time-of-flight. A rotating LiDAR (like Velodyne HDL-64) fires 64 laser beams at 10–20 Hz, generating ~1.3 million points per second.

### Types of LiDAR

| Type | Example | Range | FoV | Use Case |
|---|---|---|---|---|
| Spinning | Velodyne HDL-64 | 100m | 360° horizontal | Outdoor navigation |
| Solid-state | Livox Mid-360 | 40m | 360° horizon | Indoor + outdoor |
| 2D | SICK TiM571 | 25m | 270° | Floor-level navigation |
| MEMS | Hesai AT128 | 200m | 120° H × 25° V | Automotive |

### Reading LiDAR in ROS 2

LiDAR publishes `sensor_msgs/PointCloud2` messages:

```python
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import PointCloud2
import sensor_msgs_py.point_cloud2 as pc2
import numpy as np

class LiDARProcessor(Node):
    def __init__(self):
        super().__init__('lidar_processor')
        self.sub = self.create_subscription(
            PointCloud2, '/velodyne_points',
            self.cloud_callback, 10
        )

    def cloud_callback(self, msg: PointCloud2):
        # Convert to numpy array
        points = np.array(list(pc2.read_points(
            msg, field_names=("x", "y", "z", "intensity")
        )))
        if len(points) == 0:
            return

        # Filter: keep only points within 5 meters, above floor
        mask = (
            (np.abs(points[:, 0]) < 5.0) &
            (np.abs(points[:, 1]) < 5.0) &
            (points[:, 2] > 0.1) &  # above ground
            (points[:, 2] < 2.0)    # below ceiling
        )
        filtered = points[mask]
        self.get_logger().info(
            f'Points: total={len(points)}, filtered={len(filtered)}'
        )
        return filtered
```

## Point Cloud Processing with Open3D

**Open3D** is the standard library for 3D point cloud processing:

```python
import open3d as o3d
import numpy as np

def process_lidar_cloud(points_xyz: np.ndarray) -> dict:
    """
    Full processing pipeline: downsample → denoise → segment floor → cluster.
    """
    # 1. Create Open3D point cloud
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points_xyz)

    # 2. Voxel downsample (reduce density, keep shape)
    pcd_down = pcd.voxel_down_sample(voxel_size=0.05)  # 5 cm voxels

    # 3. Statistical outlier removal
    pcd_clean, ind = pcd_down.remove_statistical_outlier(
        nb_neighbors=20, std_ratio=2.0
    )

    # 4. RANSAC plane segmentation (find floor)
    plane_model, inliers = pcd_clean.segment_plane(
        distance_threshold=0.02,  # 2 cm tolerance
        ransac_n=3,
        num_iterations=100
    )
    floor_cloud = pcd_clean.select_by_index(inliers)
    obstacle_cloud = pcd_clean.select_by_index(inliers, invert=True)

    # 5. DBSCAN clustering of obstacles
    labels = np.array(obstacle_cloud.cluster_dbscan(
        eps=0.3,      # 30 cm neighborhood
        min_points=10
    ))
    n_clusters = labels.max() + 1

    return {
        "n_obstacles": n_clusters,
        "floor_points": len(inliers),
        "obstacle_cloud": obstacle_cloud,
        "cluster_labels": labels
    }
```

## Depth Cameras (RGB-D)

**Intel RealSense D435i** is the most common depth camera in robotics. It combines:
- RGB camera (1920×1080 @ 30fps)
- Depth sensor (848×480 @ 90fps, range 0.1–10m)
- IMU (accelerometer + gyroscope)

```python
import pyrealsense2 as rs
import numpy as np
import cv2

class RealSenseReader:
    def __init__(self):
        self.pipeline = rs.pipeline()
        config = rs.config()
        config.enable_stream(rs.stream.depth, 848, 480, rs.format.z16, 30)
        config.enable_stream(rs.stream.color, 640, 480, rs.format.bgr8, 30)
        config.enable_stream(rs.stream.accel, rs.format.motion_xyz32f, 200)
        self.profile = self.pipeline.start(config)

        # Get depth scale (converts raw values to meters)
        depth_sensor = self.profile.get_device().first_depth_sensor()
        self.depth_scale = depth_sensor.get_depth_scale()

        # Alignment (align depth to color)
        self.align = rs.align(rs.stream.color)

    def get_rgbd_frame(self) -> tuple[np.ndarray, np.ndarray]:
        """Returns (rgb_image, depth_in_meters)."""
        frames = self.pipeline.wait_for_frames()
        aligned = self.align.process(frames)

        depth_frame = aligned.get_depth_frame()
        color_frame = aligned.get_color_frame()

        depth = np.asanyarray(depth_frame.get_data()) * self.depth_scale
        color = np.asanyarray(color_frame.get_data())
        return color, depth

    def depth_to_3d_point(
        self, depth_img: np.ndarray, px: int, py: int,
        fx: float = 609.0, fy: float = 609.0,
        cx: float = 320.0, cy: float = 240.0
    ) -> tuple[float, float, float]:
        """Convert pixel + depth to 3D robot-frame point."""
        z = depth_img[py, px]
        x = (px - cx) * z / fx
        y = (py - cy) * z / fy
        return x, y, z
```

## 3D Mapping with SLAM

**SLAM** (Simultaneous Localization and Mapping) builds a 3D map while tracking the robot's position:

```bash
# Install SLAM toolbox
sudo apt install ros-humble-slam-toolbox

# Launch 3D LiDAR SLAM
ros2 launch slam_toolbox online_async_launch.py \
  slam_params_file:=./slam_config.yaml
```

```yaml
# slam_config.yaml
solver_plugin: solver_plugins::CeresSolver
ceres_linear_solver: SPARSE_NORMAL_CHOLESKY
ceres_preconditioner: SCHUR_JACOBI
resolution: 0.05
max_laser_range: 20.0
minimum_time_interval: 0.2
use_scan_matching: true
do_loop_closing: true
```

## Obstacle Detection for Navigation

```python
def build_occupancy_grid(
    lidar_points: np.ndarray,
    grid_size: float = 0.05,
    map_width: int = 200,
    map_height: int = 200
) -> np.ndarray:
    """
    Convert 2D LiDAR scan to occupancy grid.
    Returns a binary grid: 1=occupied, 0=free.
    """
    grid = np.zeros((map_height, map_width), dtype=np.uint8)
    center = (map_width // 2, map_height // 2)

    for x, y in lidar_points[:, :2]:
        gx = int(center[0] + x / grid_size)
        gy = int(center[1] + y / grid_size)
        if 0 <= gx < map_width and 0 <= gy < map_height:
            grid[gy, gx] = 1

    # Dilate obstacles for robot clearance
    kernel = np.ones((3, 3), np.uint8)
    grid = cv2.dilate(grid, kernel, iterations=2)
    return grid
```

:::warning
LiDAR is poor in rain, fog, or bright sunlight. Always fuse LiDAR with cameras and IMU for robust outdoor operation.
:::

## Summary

LiDAR and depth cameras provide the 3D spatial awareness robots need for safe navigation and manipulation. Key stack:
- **Open3D** for point cloud processing
- **RealSense SDK** for RGB-D
- **SLAM Toolbox** for mapping
- **Occupancy grids** for navigation
