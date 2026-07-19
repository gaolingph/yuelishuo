"""Pydantic schemas for request/response validation (v2.0)"""
from pydantic import BaseModel
from typing import Optional, List, Any
import datetime
from decimal import Decimal


# ─── 校区 (Campus) ───
class CampusBase(BaseModel):
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    is_active: bool = True

class CampusCreate(CampusBase):
    pass

class CampusUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    is_active: Optional[bool] = None

class CampusResponse(CampusBase):
    id: int
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True


# ─── 员工 / 团队成员 ───
class StaffBase(BaseModel):
    phone: str
    display_name: Optional[str] = None
    role: str = "staff"
    campus_id: Optional[int] = None
    school_id: Optional[int] = None
    is_active: bool = True

class StaffCreate(StaffBase):
    pass

class StaffUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    campus_id: Optional[int] = None
    is_active: Optional[bool] = None

class StaffResponse(StaffBase):
    id: int
    username: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True


# ─── 认证 ───
class SendCodeRequest(BaseModel):
    phone: str

class LoginRequest(BaseModel):
    phone: str
    code: str

class LoginResponse(BaseModel):
    token: str
    user: StaffResponse
    campus: Optional[CampusResponse] = None

class CurrentUser(BaseModel):
    id: int
    display_name: Optional[str] = None
    phone: str
    role: str
    campus_id: Optional[int] = None
    school_id: Optional[int] = None


# ─── 学校 ───
class SchoolBase(BaseModel):
    name: str
    province: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    school_type: Optional[str] = "primary"
    website: Optional[str] = None
    source: Optional[str] = "manual"

class SchoolCreate(SchoolBase):
    pass

class SchoolResponse(SchoolBase):
    id: int
    campus_id: Optional[int] = None
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True


# ─── 线索 ───
class LeadBase(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    wechat: Optional[str] = None
    role: Optional[str] = None
    school_id: Optional[int] = None
    school_name: Optional[str] = None
    grade: Optional[str] = None
    subjects: Optional[List[str]] = []
    budget: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "new"
    source: Optional[str] = "manual"
    source_detail: Optional[str] = None
    owner: Optional[str] = "default"
    next_followup_at: Optional[datetime.datetime] = None

class LeadCreate(LeadBase):
    phone: Optional[str] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    wechat: Optional[str] = None
    role: Optional[str] = None
    school_id: Optional[int] = None
    school_name: Optional[str] = None
    grade: Optional[str] = None
    subjects: Optional[List[str]] = None
    budget: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    source_detail: Optional[str] = None
    owner: Optional[str] = None
    next_followup_at: Optional[datetime.datetime] = None

class LeadResponse(LeadBase):
    id: int
    campus_id: Optional[int] = None
    created_by_id: Optional[int] = None
    status_updated_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    interaction_count: Optional[int] = 0
    class Config:
        from_attributes = True

class LeadListResponse(BaseModel):
    total: int
    items: List[LeadResponse]


# ─── 沟通记录 ───
class InteractionBase(BaseModel):
    lead_id: int
    interaction_type: str = "phone"
    content: Optional[str] = None
    summary: Optional[str] = None
    outcome: Optional[str] = None
    next_action: Optional[str] = None
    next_followup: Optional[datetime.datetime] = None

class InteractionCreate(InteractionBase):
    pass

class InteractionResponse(InteractionBase):
    id: int
    created_by: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True


# ─── 审计日志 (AuditLog) ───
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    campus_id: Optional[int] = None
    action_type: str
    target_type: str
    target_id: Optional[int] = None
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True

class AuditLogListResponse(BaseModel):
    total: int
    items: List[AuditLogResponse]


# ─── 成交记录 (Deal) ───
class DealBase(BaseModel):
    lead_id: int
    course_name: str
    amount: Decimal = Decimal('0.00')
    deal_date: Optional[datetime.datetime] = None
    status: str = "confirmed"
    notes: Optional[str] = None

class DealCreate(DealBase):
    pass

class DealUpdate(BaseModel):
    course_name: Optional[str] = None
    amount: Optional[Decimal] = None
    deal_date: Optional[datetime.datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class DealResponse(DealBase):
    id: int
    campus_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    lead_name: Optional[str] = None  # 冗余，方便展示
    lead_phone: Optional[str] = None
    class Config:
        from_attributes = True

class DealListResponse(BaseModel):
    total: int
    items: List[DealResponse]

class DealStatsResponse(BaseModel):
    total_deals: int = 0
    total_amount: float = 0.0
    by_course: Optional[dict] = {}
    by_campus: Optional[dict] = {}
    monthly: Optional[dict] = {}


# ─── 佣金规则 (CommissionRule) ───
class CommissionRuleBase(BaseModel):
    campus_id: int
    name: str
    role_type: str  # staff / campus_admin
    commission_type: str = "percentage"  # percentage / fixed
    commission_value: Decimal = Decimal('0.00')
    is_active: bool = True

class CommissionRuleCreate(CommissionRuleBase):
    pass

class CommissionRuleUpdate(BaseModel):
    name: Optional[str] = None
    role_type: Optional[str] = None
    commission_type: Optional[str] = None
    commission_value: Optional[Decimal] = None
    is_active: Optional[bool] = None

class CommissionRuleResponse(CommissionRuleBase):
    id: int
    created_at: Optional[datetime.datetime] = None
    campus_name: Optional[str] = None
    class Config:
        from_attributes = True


# ─── 佣金记录 (CommissionRecord) ───
class CommissionRecordResponse(BaseModel):
    id: int
    deal_id: int
    user_id: int
    campus_id: Optional[int] = None
    commission_amount: Optional[Decimal] = Decimal('0.00')
    status: str = "pending"
    paid_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    user_name: Optional[str] = None
    deal_info: Optional[str] = None
    class Config:
        from_attributes = True

class CommissionRecordListResponse(BaseModel):
    total: int
    items: List[CommissionRecordResponse]


# ─── 视频模板 ───
class VideoTemplateBase(BaseModel):
    name: str
    subject: str = "english"
    content_type: str = "word_memory"
    template_config: Optional[dict] = {}
    is_active: bool = True

class VideoTemplateCreate(VideoTemplateBase):
    pass

class VideoTemplateResponse(VideoTemplateBase):
    id: int
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True


# ─── 视频记录 ───
class VideoRecordBase(BaseModel):
    template_id: Optional[int] = None
    title: Optional[str] = None
    content_text: Optional[str] = None
    file_path: Optional[str] = None
    duration: Optional[float] = 0.0
    status: str = "draft"

class VideoRecordCreate(VideoRecordBase):
    pass

class VideoRecordResponse(VideoRecordBase):
    id: int
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True


# ─── 统计 ───
class StatsOverview(BaseModel):
    total_leads: int = 0
    new_leads: int = 0
    interested: int = 0
    converted: int = 0
    lost: int = 0
    conversion_rate: float = 0.0
    total_schools: int = 0
    total_videos: int = 0
    total_deals: int = 0
    total_revenue: float = 0.0


# ─── 学校采集请求 ───
class SchoolCollectRequest(BaseModel):
    city: str
    district: Optional[str] = None
    school_type: Optional[str] = None


# ─── 视频生成请求 ───
class VideoGenerateRequest(BaseModel):
    template_id: int
    word_data: Optional[dict] = None
    count: int = 1


# ─── 社交媒体账号 ───
class SocialAccountBase(BaseModel):
    platform: str  # douyin / xiaohongshu / wechat_video
    account_id: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    follower_count: int = 0
    status: str = "active"
    campus_id: Optional[int] = None

class SocialAccountCreate(SocialAccountBase):
    pass

class SocialAccountResponse(SocialAccountBase):
    id: int
    last_sync_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True

class SocialAccountListResponse(BaseModel):
    total: int
    items: List[SocialAccountResponse]


# ─── 社交媒体帖子 ───
class SocialPostBase(BaseModel):
    platform: str
    post_id: str
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    images: Optional[List[str]] = []
    video_url: Optional[str] = None
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    posted_at: Optional[datetime.datetime] = None
    is_lead_generated: bool = False
    source_keywords: Optional[str] = None
    campus_id: Optional[int] = None

class SocialPostCreate(SocialPostBase):
    pass

class SocialPostResponse(SocialPostBase):
    id: int
    collected_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True

class SocialPostListResponse(BaseModel):
    total: int
    items: List[SocialPostResponse]


# ─── 关键词配置 ───
class KeywordConfigBase(BaseModel):
    platform: str
    name: str
    keywords: List[str] = []
    match_mode: str = "fuzzy"
    search_interval_hours: int = 6
    is_active: bool = True
    campus_id: Optional[int] = None

class KeywordConfigCreate(KeywordConfigBase):
    pass

class KeywordConfigUpdate(BaseModel):
    name: Optional[str] = None
    keywords: Optional[List[str]] = None
    match_mode: Optional[str] = None
    search_interval_hours: Optional[int] = None
    is_active: Optional[bool] = None

class KeywordConfigResponse(KeywordConfigBase):
    id: int
    created_by_id: Optional[int] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True

class KeywordConfigListResponse(BaseModel):
    total: int
    items: List[KeywordConfigResponse]


# ─── 采集任务记录 ───
class CollectionTaskCreateRequest(BaseModel):
    platform: str
    keyword_config_id: int
    task_type: str = "keyword_search"
    campus_id: Optional[int] = None

class CollectionTaskResponse(BaseModel):
    id: int
    platform: str
    task_type: str = "keyword_search"
    keyword_config_id: Optional[int] = None
    status: str = "pending"
    total_found: int = 0
    leads_created: int = 0
    started_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    error_message: Optional[str] = None
    campus_id: Optional[int] = None
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True

class CollectionTaskListResponse(BaseModel):
    total: int
    items: List[CollectionTaskResponse]
