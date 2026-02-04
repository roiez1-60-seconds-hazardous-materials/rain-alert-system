#!/usr/bin/env python3
"""
Rain Alert Dashboard - Backend Service
מערכת לניטור גשם בזמן אמת עבור ישראל
"""

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import cv2
import numpy as np
from playwright.async_api import async_playwright
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
DATA_DIR = Path("data")
SCREENSHOTS_DIR = DATA_DIR / "screenshots"
OUTPUT_DIR = DATA_DIR / "output"

# Create directories
for dir_path in [DATA_DIR, SCREENSHOTS_DIR, OUTPUT_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# dBZ to mm/hour conversion table (from user's provided table)
DBZ_TO_MM_CONVERSION = {
    (20, 30): {"color": "lightblue", "mm_min": 0.5, "mm_max": 1.5, "name": "תכלת/כחול", "level": "light"},
    (30, 35): {"color": "green", "mm_min": 1.5, "mm_max": 2.5, "name": "ירוק", "level": "light"},
    (35, 40): {"color": "yellow", "mm_min": 2.5, "mm_max": 8.0, "name": "צהוב", "level": "warning"},
    (40, 45): {"color": "orange", "mm_min": 8.0, "mm_max": 15.0, "name": "כתום", "level": "danger"},
    (45, 100): {"color": "red", "mm_min": 15.0, "mm_max": 300.0, "name": "אדום", "level": "severe"}
}


class RadarAnalyzer:
    """מנתח מפות מכ\"ם גשם"""
    
    def __init__(self):
        self.current_data = None
        
    def analyze_colors_simple(self, image_path: str) -> Dict:
        """
        ניתוח פשוט של תמונה לפי צבעים (OCR חינמי)
        זיהוי אזורים עם גשם חזק בלבד (35+ dBZ)
        """
        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                logger.error(f"Failed to load image: {image_path}")
                return {"error": "Failed to load image"}
            
            # Convert BGR to HSV for better color detection
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            
            # Define color ranges for detection
            # Yellow (35-40 dBZ) - warning level
            yellow_lower = np.array([20, 100, 100])
            yellow_upper = np.array([30, 255, 255])
            
            # Orange (40-45 dBZ) - danger level
            orange_lower = np.array([10, 100, 100])
            orange_upper = np.array([20, 255, 255])
            
            # Red (45+ dBZ) - severe level
            red_lower1 = np.array([0, 100, 100])
            red_upper1 = np.array([10, 255, 255])
            red_lower2 = np.array([170, 100, 100])
            red_upper2 = np.array([180, 255, 255])
            
            # Create masks
            yellow_mask = cv2.inRange(hsv, yellow_lower, yellow_upper)
            orange_mask = cv2.inRange(hsv, orange_lower, orange_upper)
            red_mask1 = cv2.inRange(hsv, red_lower1, red_upper1)
            red_mask2 = cv2.inRange(hsv, red_lower2, red_upper2)
            red_mask = cv2.bitwise_or(red_mask1, red_mask2)
            
            # Calculate percentages
            total_pixels = img.shape[0] * img.shape[1]
            yellow_pixels = cv2.countNonZero(yellow_mask)
            orange_pixels = cv2.countNonZero(orange_mask)
            red_pixels = cv2.countNonZero(red_mask)
            
            yellow_percent = (yellow_pixels / total_pixels) * 100
            orange_percent = (orange_pixels / total_pixels) * 100
            red_percent = (red_pixels / total_pixels) * 100
            
            # Determine alert level
            alert_level = "none"
            if red_percent > 0.1:
                alert_level = "severe"
            elif orange_percent > 0.5:
                alert_level = "danger"
            elif yellow_percent > 1.0:
                alert_level = "warning"
            
            result = {
                "timestamp": datetime.now().isoformat(),
                "source": "color_analysis",
                "analysis": {
                    "yellow": {
                        "percent": round(yellow_percent, 2),
                        "dbz_range": "35-40",
                        "mm_per_hour": "2.5-8.0"
                    },
                    "orange": {
                        "percent": round(orange_percent, 2),
                        "dbz_range": "40-45",
                        "mm_per_hour": "8.0-15.0"
                    },
                    "red": {
                        "percent": round(red_percent, 2),
                        "dbz_range": "45+",
                        "mm_per_hour": "15.0+"
                    }
                },
                "alert_level": alert_level,
                "has_significant_rain": alert_level != "none"
            }
            
            logger.info(f"Analysis complete: Alert level {alert_level}")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return {"error": str(e)}


class ScreenshotCapture:
    """צילום מסך אוטומטי של מפות מכ\"ם"""
    
    def __init__(self):
        self.browser = None
        self.context = None
        
    async def setup(self):
        """Initialize browser"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='he-IL'
        )
        
    async def capture_windy(self) -> Optional[str]:
        """צילום מסך של Windy radar"""
        try:
            page = await self.context.new_page()
            
            # Navigate to Windy radar for Israel
            url = "https://www.windy.com/he/-מכ\"ם-מזג-האוויר-radar?radar,32.399,34.869,7"
            await page.goto(url, wait_until='networkidle')
            
            # Wait for radar to load
            await asyncio.sleep(5)
            
            # Take screenshot
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = str(SCREENSHOTS_DIR / f"windy_{timestamp}.png")
            await page.screenshot(path=screenshot_path, full_page=False)
            
            await page.close()
            logger.info(f"Windy screenshot saved: {screenshot_path}")
            return screenshot_path
            
        except Exception as e:
            logger.error(f"Error capturing Windy screenshot: {e}")
            return None
    
    async def capture_govmap(self) -> Optional[str]:
        """צילום מסך של GovMap radar"""
        try:
            page = await self.context.new_page()
            
            # Navigate to GovMap radar
            url = "https://www.govmap.gov.il/?c=219143.61,618345.06&app=app12"
            await page.goto(url, wait_until='networkidle')
            
            # Wait for map to load
            await asyncio.sleep(8)
            
            # Take screenshot
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = str(SCREENSHOTS_DIR / f"govmap_{timestamp}.png")
            await page.screenshot(path=screenshot_path, full_page=False)
            
            await page.close()
            logger.info(f"GovMap screenshot saved: {screenshot_path}")
            return screenshot_path
            
        except Exception as e:
            logger.error(f"Error capturing GovMap screenshot: {e}")
            return None
    
    async def cleanup(self):
        """Close browser"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()


async def process_radar_update(source: str = "both"):
    """
    עיבוד עדכון מכ\"ם
    source: "windy", "govmap", or "both"
    """
    logger.info(f"Starting radar update from {source}")
    
    capture = ScreenshotCapture()
    analyzer = RadarAnalyzer()
    
    try:
        await capture.setup()
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "sources": {}
        }
        
        # Capture and analyze Windy
        if source in ["windy", "both"]:
            windy_path = await capture.capture_windy()
            if windy_path:
                windy_analysis = analyzer.analyze_colors_simple(windy_path)
                results["sources"]["windy"] = {
                    "screenshot": windy_path,
                    "analysis": windy_analysis
                }
        
        # Capture and analyze GovMap
        if source in ["govmap", "both"]:
            govmap_path = await capture.capture_govmap()
            if govmap_path:
                govmap_analysis = analyzer.analyze_colors_simple(govmap_path)
                # For GovMap, multiply by 6 (mm/10min to mm/hour)
                if "analysis" in govmap_analysis:
                    for level in govmap_analysis["analysis"].values():
                        if "mm_per_hour" in level:
                            # This would need proper parsing, simplified for now
                            pass
                results["sources"]["govmap"] = {
                    "screenshot": govmap_path,
                    "analysis": govmap_analysis
                }
        
        # Save results
        output_file = OUTPUT_DIR / "latest_analysis.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Analysis saved to {output_file}")
        return results
        
    except Exception as e:
        logger.error(f"Error in radar update: {e}")
        return {"error": str(e)}
    
    finally:
        await capture.cleanup()


if __name__ == "__main__":
    # Run once for testing
    asyncio.run(process_radar_update("both"))
