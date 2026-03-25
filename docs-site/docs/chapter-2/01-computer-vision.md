---
title: Computer Vision for Robots
description: Applying computer vision techniques for robotic perception — object detection, depth estimation, and semantic segmentation.
sidebar_position: 1
---

# Computer Vision for Robots

Robotic computer vision differs from general computer vision in one critical way: **the output must drive real-time actions**. A robot cannot wait 500ms for a detection result — its perception pipeline must run at 30–60 fps to support safe, responsive behavior.

## Camera Types in Robotics

| Camera | Output | Use Case |
|---|---|---|
| Monocular RGB | 2D image | Classification, detection |
| Stereo | Disparity map → depth | Navigation, grasping |
| RGB-D (Intel RealSense) | RGB + depth per pixel | Manipulation |
| Event camera | Sparse events | High-speed tracking |
| 360° fisheye | Wide-angle image | Spatial awareness |

## Object Detection Pipeline

The standard pipeline for robotic object detection:

```python
import cv2
import numpy as np
from ultralytics import YOLO

class RobotVision:
    def __init__(self, model_path: str = "yolov8n.pt"):
        self.model = YOLO(model_path)
        self.model.to("cuda")  # GPU inference

    def detect(self, frame: np.ndarray) -> list[dict]:
        """Run object detection on a single frame."""
        results = self.model(frame, conf=0.5, iou=0.45)
        detections = []
        for r in results:
            for box in r.boxes:
                detections.append({
                    "class": r.names[int(box.cls)],
                    "confidence": float(box.conf),
                    "bbox": box.xyxy[0].tolist(),  # [x1,y1,x2,y2]
                    "center": (
                        (box.xyxy[0][0] + box.xyxy[0][2]) / 2,
                        (box.xyxy[0][1] + box.xyxy[0][3]) / 2
                    )
                })
        return detections

    def detect_ros(self, ros_image_msg):
        """Convert ROS image message and detect."""
        from cv_bridge import CvBridge
        bridge = CvBridge()
        frame = bridge.imgmsg_to_cv2(ros_image_msg, "bgr8")
        return self.detect(frame)
```

## Depth Estimation

**Stereo depth** computes distance using the disparity between two cameras:

```python
import cv2
import numpy as np

def compute_stereo_depth(
    left_img: np.ndarray,
    right_img: np.ndarray,
    focal_length: float = 600.0,
    baseline: float = 0.12  # 12 cm stereo baseline
) -> np.ndarray:
    """
    Returns a depth map in meters.
    depth = (focal_length * baseline) / disparity
    """
    left_gray = cv2.cvtColor(left_img, cv2.COLOR_BGR2GRAY)
    right_gray = cv2.cvtColor(right_img, cv2.COLOR_BGR2GRAY)

    stereo = cv2.StereoSGBM_create(
        minDisparity=0,
        numDisparities=128,
        blockSize=11,
        P1=8 * 3 * 11**2,
        P2=32 * 3 * 11**2,
        disp12MaxDiff=1,
        uniquenessRatio=10,
        speckleWindowSize=100,
        speckleRange=32
    )

    disparity = stereo.compute(left_gray, right_gray).astype(np.float32) / 16.0
    # Avoid division by zero
    disparity[disparity <= 0] = 0.1
    depth = (focal_length * baseline) / disparity
    return depth
```

## Semantic Segmentation for Navigation

Segmentation identifies which pixels belong to walkable floors, obstacles, or manipulation targets:

```python
from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
import torch

class SceneSegmenter:
    FLOOR_LABEL = 3
    OBSTACLE_LABEL = 1

    def __init__(self):
        self.processor = SegformerImageProcessor.from_pretrained(
            "nvidia/segformer-b0-finetuned-ade-512-512"
        )
        self.model = SegformerForSemanticSegmentation.from_pretrained(
            "nvidia/segformer-b0-finetuned-ade-512-512"
        )
        self.model.eval()

    def segment(self, image: np.ndarray) -> np.ndarray:
        """Returns a label map of shape (H, W)."""
        from PIL import Image as PILImage
        pil_img = PILImage.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        inputs = self.processor(images=pil_img, return_tensors="pt")

        with torch.no_grad():
            outputs = self.model(**inputs)

        upsampled = torch.nn.functional.interpolate(
            outputs.logits,
            size=image.shape[:2],
            mode="bilinear",
            align_corners=False
        )
        return upsampled.argmax(dim=1).squeeze().numpy()

    def get_walkable_mask(self, image: np.ndarray) -> np.ndarray:
        seg = self.segment(image)
        return (seg == self.FLOOR_LABEL).astype(np.uint8) * 255
```

## Visual Odometry

Visual Odometry (VO) estimates the robot's motion from camera frames:

```python
class VisualOdometry:
    def __init__(self, K: np.ndarray):
        """K = 3x3 camera intrinsic matrix."""
        self.K = K
        self.orb = cv2.ORB_create(nfeatures=2000)
        self.matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        self.prev_frame = None
        self.prev_kp = None
        self.prev_desc = None

    def update(self, frame: np.ndarray):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        kp, desc = self.orb.detectAndCompute(gray, None)

        if self.prev_frame is None:
            self.prev_frame, self.prev_kp, self.prev_desc = gray, kp, desc
            return None

        matches = self.matcher.match(self.prev_desc, desc)
        matches = sorted(matches, key=lambda x: x.distance)[:200]

        pts1 = np.float32([self.prev_kp[m.queryIdx].pt for m in matches])
        pts2 = np.float32([kp[m.trainIdx].pt for m in matches])

        E, mask = cv2.findEssentialMat(pts1, pts2, self.K, method=cv2.RANSAC)
        _, R, t, _ = cv2.recoverPose(E, pts1, pts2, self.K, mask=mask)

        self.prev_frame, self.prev_kp, self.prev_desc = gray, kp, desc
        return R, t
```

:::info
For production robotic systems, **Foundation Models** like DINO, SAM, and Grounding DINO provide far better zero-shot detection than YOLOv8. They are slower but more generalizable.
:::

## Integrating Vision with ROS 2

```python
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from vision_msgs.msg import Detection2DArray

class VisionNode(Node):
    def __init__(self):
        super().__init__('vision_node')
        self.detector = RobotVision()
        self.sub = self.create_subscription(
            Image, '/camera/image_raw', self.image_callback, 10
        )
        self.pub = self.create_publisher(
            Detection2DArray, '/detections', 10
        )

    def image_callback(self, msg):
        detections = self.detector.detect_ros(msg)
        # Publish detections
        result = Detection2DArray()
        # ... fill result ...
        self.pub.publish(result)
```

## Summary

Robotic computer vision requires real-time pipelines for detection, depth, segmentation, and motion estimation. Key stack:
- **YOLOv8** for fast object detection
- **Stereo/RGB-D** for depth
- **SegFormer** for scene understanding
- **ORB + Essential Matrix** for visual odometry
