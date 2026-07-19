"""
学校线索采集服务

功能：从公开数据源采集学校信息（名称、地址、联系电话等）
数据来源：高德地图POI API（需自行申请API Key）

使用说明：
1. 前往 https://lbs.amap.com/ 注册开发者账号
2. 创建应用，获取 Web服务 API Key
3. 在 .env 文件中设置 AMAP_API_KEY=your_key

⚠️ 法律声明：
本工具仅采集学校官方公开的联系方式（学校总机、办公电话），
不涉及个人隐私数据。使用者应确保符合当地数据合规要求。
"""
import json
import time
from typing import List, Optional
import httpx

from config import settings


# 高德地图 API 配置
AMAP_API_KEY = settings.AMAP_API_KEY
AMAP_SEARCH_URL = "https://restapi.amap.com/v3/place/text"
AMAP_DISTRICT_URL = "https://restapi.amap.com/v3/config/district"

# 学校类型关键词映射
SCHOOL_TYPES = {
    "primary": "小学",
    "junior": "初中",
    "senior": "高中",
    "nine_year": "九年一贯制学校",
    " vocational": "职业学校",
}


class SchoolCollector:
    """学校信息采集器"""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or AMAP_API_KEY
        self.client = httpx.Client(timeout=30.0)

    def search_by_district(
        self,
        city: str,
        district: Optional[str] = None,
        school_type: Optional[str] = None,
    ) -> List[dict]:
        """
        按区域采集学校信息

        参数:
            city: 城市名，如 "北京"、"上海"
            district: 区名，如 "海淀区"（可选）
            school_type: 学校类型，如 "primary"（可选）

        返回:
            学校信息列表
        """
        # 构建搜索关键词
        keywords = f"{city}"
        if district:
            keywords = f"{district}{city}" if district not in city else f"{district}"

        # 学校类型
        type_keyword = ""
        if school_type and school_type in SCHOOL_TYPES:
            type_keyword = SCHOOL_TYPES[school_type]
        else:
            type_keyword = "学校"

        all_schools = []
        page = 1

        while True:
            params = {
                "key": self.api_key,
                "keywords": keywords,
                "types": f"科教文化服务|{type_keyword}",
                "city": city,
                "offset": 25,  # 每页25条
                "page": page,
                "extensions": "all",
            }

            try:
                resp = self.client.get(AMAP_SEARCH_URL, params=params)
                data = resp.json()

                if data.get("status") != "1":
                    print(f"API 返回错误: {data.get('info', 'unknown')}")
                    break

                pois = data.get("pois", [])
                if not pois:
                    break

                for poi in pois:
                    # 过滤：只保留学校相关
                    if self._is_school(poi):
                        school = self._parse_poi(poi)
                        if school:
                            all_schools.append(school)

                # 检查是否还有更多页
                total = int(data.get("count", 0))
                if page * 25 >= total:
                    break

                page += 1
                time.sleep(0.3)  # API 限流控制

            except Exception as e:
                print(f"采集出错: {e}")
                break

        return all_schools

    def search_by_name(self, name: str, city: Optional[str] = None) -> List[dict]:
        """
        按学校名称搜索

        参数:
            name: 学校名称关键词
            city: 城市（可选）
        """
        params = {
            "key": self.api_key,
            "keywords": name,
            "types": "科教文化服务|学校",
            "offset": 25,
            "extensions": "all",
        }
        if city:
            params["city"] = city

        try:
            resp = self.client.get(AMAP_SEARCH_URL, params=params)
            data = resp.json()
            if data.get("status") != "1":
                return []

            schools = []
            for poi in data.get("pois", []):
                if self._is_school(poi):
                    school = self._parse_poi(poi)
                    if school:
                        schools.append(school)
            return schools
        except Exception as e:
            print(f"搜索出错: {e}")
            return []

    def _is_school(self, poi: dict) -> bool:
        """判断POI是否为学校"""
        types = poi.get("type", "")
        name = poi.get("name", "")
        typecode = poi.get("typecode", "")

        # 通过 type 判断
        school_keywords = ["学校", "小学", "中学", "高中", "初中", "学院", "大学",
                           "幼儿园", "教育", "培训", "补习"]
        return any(kw in types or kw in name for kw in school_keywords)

    def _parse_poi(self, poi: dict) -> Optional[dict]:
        """解析POI数据为学校信息"""
        try:
            # 判断学校类型
            type_str = poi.get("type", "")
            name = poi.get("name", "")

            school_type = self._detect_school_type(type_str, name)

            # 提取电话（可能有多个，用分号分隔）
            phone = poi.get("tel", "") or ""

            # 提取地址
            address = poi.get("address", "") or ""
            pname = poi.get("pname", "") or ""  # 省
            cname = poi.get("cityname", "") or ""  # 市
            adname = poi.get("adname", "") or ""  # 区

            return {
                "name": name,
                "province": pname,
                "city": cname,
                "district": adname,
                "address": address,
                "phone": phone,
                "school_type": school_type,
                "source": "amap_poi",
            }
        except Exception as e:
            print(f"解析POI出错: {e}")
            return None

    def _detect_school_type(self, type_str: str, name: str) -> str:
        """检测学校类型"""
        info = type_str + name
        if "小学" in info and "初中" not in info and "中学" not in info:
            return "primary"
        if "初中" in info or ("中学" in info and "高级" not in info and "高中" not in info):
            return "junior"
        if "高中" in info or "高级中学" in info:
            return "senior"
        if "九年一贯制" in info:
            return "nine_year"
        if "幼儿园" in info:
            return "kindergarten"
        return "other"

    def close(self):
        """关闭 HTTP 客户端"""
        self.client.close()


# 便捷函数
def collect_schools(
    city: str,
    district: Optional[str] = None,
    school_type: Optional[str] = None,
    api_key: Optional[str] = None,
) -> List[dict]:
    """
    采集指定区域的学校信息（便捷函数）

    示例:
        schools = collect_schools("北京", "海淀区", "primary")
        for s in schools:
            print(s["name"], s["phone"])
    """
    collector = SchoolCollector(api_key)
    try:
        return collector.search_by_district(city, district, school_type)
    finally:
        collector.close()


if __name__ == "__main__":
    # 测试
    print("=" * 50)
    print("学校线索采集工具 — 测试")
    print("=" * 50)
    print(f"API Key: {AMAP_API_KEY[:8]}...")
    print()
    print("请先设置环境变量 AMAP_API_KEY")
    print("或直接修改 services/school_collector.py 中的 AMAP_API_KEY")
