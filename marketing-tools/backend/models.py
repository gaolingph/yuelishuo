"""数据库模型 — 获客转化工具系统 (v2.0 多校区+留痕+佣金)"""
import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Enum, Boolean, ForeignKey, JSON, Numeric
from sqlalchemy.orm import relationship
from database import Base

import enum


class SocialPlatform(str, enum.Enum):
    """社交媒体平台"""
    DOUYIN = "douyin"                       # 抖音
    XIAOHONGSHU = "xiaohongshu"            # 小红书
    WECHAT_VIDEO = "wechat_video"           # 视频号


class LeadSource(str, enum.Enum):
    """线索来源"""
    SCHOOL_DIRECTORY = "school_directory"   # 学校名录采集
    COLD_CALL = "cold_call"                 # 电话陌拜
    GROUND_PUSH = "ground_push"             # 地推
    FRIEND_REFERRAL = "friend_referral"     # 转介绍
    DOUYIN = "douyin"                        # 抖音
    XIAOHONGSHU = "xiaohongshu"            # 小红书
    WECHAT = "wechat"                       # 微信
    ONLINE_AD = "online_ad"                 # 线上广告
    EXCEL_IMPORT = "excel_import"           # Excel导入
    MANUAL = "manual"                       # 手工录入


class LeadStatus(str, enum.Enum):
    """线索状态 / 跟进度"""
    NEW = "new"                         # 新线索
    FIRST_CONTACT = "first_contact"     # 已初次联系
    INTERESTED = "interested"           # 有意向
    TRIAL_SET = "trial_set"             # 已安排试听
    TRIAL_DONE = "trial_done"           # 已试听
    NEGOTIATING = "negotiating"         # 报价/谈判中
    CONVERTED = "converted"             # 已成交
    LOST = "lost"                       # 已流失
    NOT_CONTACTED = "not_contacted"     # 无法联系


class SubjectType(str, enum.Enum):
    """学科类型"""
    ENGLISH = "english"         # 英语单词速记
    MATH = "math"               # 数学
    CHINESE = "chinese"         # 语文
    PHYSICS = "physics"         # 物理
    CHEMISTRY = "chemistry"     # 化学
    OTHER = "other"             # 其他


class SchoolType(str, enum.Enum):
    """学校类型"""
    PRIMARY = "primary"         # 小学
    JUNIOR = "junior"           # 初中
    SENIOR = "senior"           # 高中
    NINE_YEAR = "nine_year"     # 九年一贯制
    OTHER = "other"             # 其他


class UserRole(str, enum.Enum):
    """用户角色 (v2.0)"""
    SUPER_ADMIN = "super_admin"       # 总端口 — 看全部
    CAMPUS_ADMIN = "campus_admin"     # 校区端口 — 看本校区
    PRINCIPAL = "principal"           # 校长端口 — 看本校
    STAFF = "staff"                   # 员工录入端口


# ─────────────────────────────────────────
# 校区表 (v2.0 新增)
# ─────────────────────────────────────────
class Campus(Base):
    """校区 / 组织"""
    __tablename__ = "campuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)                       # 校区名称
    code = Column(String(50), unique=True, nullable=True)            # 校区编码
    address = Column(String(300), nullable=True)                     # 地址
    phone = Column(String(50), nullable=True)                        # 联系电话
    contact_person = Column(String(100), nullable=True)              # 联系人
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # 关联
    team_members = relationship("TeamMember", back_populates="campus")
    leads = relationship("Lead", back_populates="campus")
    deals = relationship("Deal", back_populates="campus")


# ─────────────────────────────────────────
# 学校信息表
# ─────────────────────────────────────────
class School(Base):
    """学校信息 — 从公开数据采集"""
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)          # 学校名称
    province = Column(String(50), nullable=True)                     # 省
    city = Column(String(50), nullable=True, index=True)            # 市
    district = Column(String(50), nullable=True)                    # 区
    address = Column(String(300), nullable=True)                    # 详细地址
    phone = Column(String(100), nullable=True)                      # 公开电话（可能有多个）
    school_type = Column(String(20), default=SchoolType.PRIMARY)   # 学校类型
    website = Column(String(200), nullable=True)                    # 官网
    source = Column(String(50), default="manual")                  # 数据来源
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)  # v2.0 所属校区
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # 关联
    leads = relationship("Lead", back_populates="school")
    campus = relationship("Campus", foreign_keys=[campus_id])


# ─────────────────────────────────────────
# 线索表（核心）
# ─────────────────────────────────────────
class Lead(Base):
    """客户线索"""
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    # 联系人信息
    name = Column(String(100), nullable=True)                      # 联系人姓名
    phone = Column(String(50), nullable=True, index=True)          # 联系电话
    wechat = Column(String(100), nullable=True)                    # 微信号
    role = Column(String(50), nullable=True)                       # 角色（家长/老师/校长）

    # 学校信息
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)
    school = relationship("School", back_populates="leads")
    school_name = Column(String(200), nullable=True)               # 学校名（冗余，方便脱离学校表）
    grade = Column(String(50), nullable=True)                      # 年级

    # 需求信息
    subjects = Column(JSON, default=list)                          # 感兴趣的学科 ["english", "math"]
    budget = Column(String(100), nullable=True)                    # 预算范围
    notes = Column(Text, nullable=True)                            # 备注

    # 跟进状态
    status = Column(String(20), default=LeadStatus.NEW)           # 跟进阶段
    status_updated_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner = Column(String(50), default="default")                  # 负责人

    # 来源
    source = Column(String(30), default=LeadSource.MANUAL)        # 线索来源
    source_detail = Column(String(200), nullable=True)             # 来源详情

    # v2.0 多校区归属 + 录入人
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)   # 所属校区
    created_by_id = Column(Integer, ForeignKey("team_members.id"), nullable=True)  # 录入员工
    created_by = relationship("TeamMember", foreign_keys=[created_by_id])
    campus = relationship("Campus", foreign_keys=[campus_id], back_populates="leads")

    # 时间戳
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    next_followup_at = Column(DateTime, nullable=True)             # 下次跟进时间

    # 关联
    interactions = relationship("Interaction", back_populates="lead", order_by="Interaction.created_at.desc()")
    deals = relationship("Deal", back_populates="lead")


# ─────────────────────────────────────────
# 沟通记录表
# ─────────────────────────────────────────
class Interaction(Base):
    """与客户的沟通记录"""
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    lead = relationship("Lead", back_populates="interactions")

    interaction_type = Column(String(30), default="phone")         # phone / wechat / visit / other
    content = Column(Text, nullable=True)                          # 沟通内容
    summary = Column(String(500), nullable=True)                   # 沟通摘要
    outcome = Column(String(100), nullable=True)                   # 沟通结果
    next_action = Column(String(300), nullable=True)               # 下一步行动
    next_followup = Column(DateTime, nullable=True)                # 下次跟进时间
    created_by = Column(String(50), default="default")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 用户/团队成员表 (v2.0 升级)
# ─────────────────────────────────────────
class TeamMember(Base):
    """团队成员 — 手机号登录 + 多校区角色"""
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=True)      # 旧版用户名（可为空）
    password_hash = Column(String(200), nullable=True)             # 旧版密码（可为空）
    display_name = Column(String(100), nullable=True)              # 显示名称

    # v2.0 新增字段
    phone = Column(String(20), unique=True, nullable=False)       # 手机号（登录凭证）
    role = Column(String(20), default=UserRole.STAFF)             # super_admin / campus_admin / principal / staff
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)  # 所属校区（super_admin可为空）
    campus = relationship("Campus", back_populates="team_members")
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)   # 所属学校（principal/staff 用）
    school = relationship("School", foreign_keys=[school_id])

    # 短信验证码（临时存储）
    sms_code = Column(String(10), nullable=True)
    sms_code_expires = Column(DateTime, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 操作审计日志表 (v2.0 新增)
# ─────────────────────────────────────────
class AuditLog(Base):
    """操作留痕 — 记录所有对客户信息的修改"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    user_name = Column(String(100), nullable=True)                 # 操作人姓名（冗余）
    user_role = Column(String(20), nullable=True)                  # 操作人角色
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)

    action_type = Column(String(20), nullable=False)               # create / update / delete
    target_type = Column(String(50), nullable=False)               # lead / school / deal / interaction
    target_id = Column(Integer, nullable=True)                     # 被操作对象的ID

    field_name = Column(String(100), nullable=True)                # 变更的字段名（update时）
    old_value = Column(Text, nullable=True)                        # 旧值
    new_value = Column(Text, nullable=True)                        # 新值

    ip_address = Column(String(50), nullable=True)                 # 操作IP
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 成交记录表 (v2.0 新增)
# ─────────────────────────────────────────
class Deal(Base):
    """成交记录"""
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    lead = relationship("Lead", back_populates="deals")
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=False)
    campus = relationship("Campus", foreign_keys=[campus_id], back_populates="deals")

    course_name = Column(String(200), nullable=False)              # 成交课程名称
    amount = Column(Numeric(10, 2), default=0.00)                  # 成交金额
    deal_date = Column(DateTime, default=datetime.datetime.utcnow) # 成交日期

    status = Column(String(20), default="confirmed")               # pending / confirmed / cancelled
    notes = Column(Text, nullable=True)                            # 备注

    created_by_id = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    created_by = relationship("TeamMember", foreign_keys=[created_by_id])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 关联佣金
    commission_records = relationship("CommissionRecord", back_populates="deal")


# ─────────────────────────────────────────
# 佣金规则表 (v2.0 新增)
# ─────────────────────────────────────────
class CommissionRule(Base):
    """佣金分配规则"""
    __tablename__ = "commission_rules"

    id = Column(Integer, primary_key=True, index=True)
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=False)  # 适用校区
    campus = relationship("Campus", foreign_keys=[campus_id])

    name = Column(String(200), nullable=False)                     # 规则名称
    role_type = Column(String(20), nullable=False)                 # staff / campus_admin （适用角色）
    commission_type = Column(String(20), default="percentage")     # percentage / fixed
    commission_value = Column(Numeric(10, 4), default=0.00)        # 比例（如 0.05=5%）或固定金额

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 佣金发放记录表 (v2.0 新增)
# ─────────────────────────────────────────
class CommissionRecord(Base):
    """佣金发放记录"""
    __tablename__ = "commission_records"

    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False)
    deal = relationship("Deal", back_populates="commission_records")
    user_id = Column(Integer, ForeignKey("team_members.id"), nullable=False)
    user = relationship("TeamMember", foreign_keys=[user_id])
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)

    commission_amount = Column(Numeric(10, 2), default=0.00)       # 佣金金额
    status = Column(String(20), default="pending")                 # pending / paid
    paid_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 视频内容模板表
# ─────────────────────────────────────────
class VideoTemplate(Base):
    """短视频内容模板"""
    __tablename__ = "video_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)                    # 模板名称
    subject = Column(String(30), default=SubjectType.ENGLISH)    # 学科
    content_type = Column(String(50), default="word_memory")     # 内容类型
    template_config = Column(JSON, default=dict)                  # 模板配置（字体、颜色、背景等）
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 已生成的视频记录表
# ─────────────────────────────────────────
class VideoRecord(Base):
    """已生成的视频记录"""
    __tablename__ = "video_records"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("video_templates.id"), nullable=True)
    title = Column(String(200), nullable=True)                    # 视频标题
    content_text = Column(Text, nullable=True)                    # 视频文案
    file_path = Column(String(500), nullable=True)                # 视频文件路径
    duration = Column(Float, default=0.0)                         # 视频时长（秒）
    status = Column(String(20), default="draft")                  # draft / generated / published
    published_platform = Column(String(50), nullable=True)        # 发布平台
    published_url = Column(String(500), nullable=True)            # 发布链接
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 社交媒体账号表 (自媒体拓客 v3.0 新增)
# ─────────────────────────────────────────
class SocialAccount(Base):
    """绑定的社交媒体账号"""
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(30), nullable=False)                    # douyin / xiaohongshu / wechat_video
    account_id = Column(String(200), nullable=False)                 # 平台侧账号ID
    nickname = Column(String(200), nullable=True)                   # 昵称
    avatar = Column(String(500), nullable=True)                     # 头像URL
    follower_count = Column(Integer, default=0)                     # 粉丝数
    status = Column(String(20), default="active")                   # active / inactive / expired
    last_sync_at = Column(DateTime, nullable=True)                  # 最后同步时间
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)
    campus = relationship("Campus", foreign_keys=[campus_id])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 采集的社交媒体帖子表 (自媒体拓客 v3.0 新增)
# ─────────────────────────────────────────
class SocialPost(Base):
    """从社交媒体采集到的帖子/笔记/视频"""
    __tablename__ = "social_posts"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(30), nullable=False, index=True)       # douyin / xiaohongshu / wechat_video
    post_id = Column(String(200), nullable=False)                   # 平台侧帖子ID
    author_id = Column(String(200), nullable=True)                  # 作者ID
    author_name = Column(String(200), nullable=True)                # 作者昵称
    title = Column(String(500), nullable=True)                      # 标题
    content = Column(Text, nullable=True)                           # 正文/文案
    images = Column(JSON, default=list)                             # 图片URL列表
    video_url = Column(String(500), nullable=True)                  # 视频URL
    like_count = Column(Integer, default=0)                         # 点赞数
    comment_count = Column(Integer, default=0)                      # 评论数
    share_count = Column(Integer, default=0)                        # 分享数
    posted_at = Column(DateTime, nullable=True)                     # 帖子发布时间
    collected_at = Column(DateTime, default=datetime.datetime.utcnow)  # 采集时间
    is_lead_generated = Column(Boolean, default=False)               # 是否已生成线索
    source_keywords = Column(String(500), nullable=True)            # 采集中使用的关键词（冗余）
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)
    campus = relationship("Campus", foreign_keys=[campus_id])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─────────────────────────────────────────
# 关键词配置表 (自媒体拓客 v3.0 新增)
# ─────────────────────────────────────────
class KeywordConfig(Base):
    """要监控的关键词配置"""
    __tablename__ = "keyword_configs"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(30), nullable=False)                    # douyin / xiaohongshu / wechat_video
    name = Column(String(200), nullable=False)                      # 配置名称（便于管理）
    keywords = Column(JSON, default=list)                           # 关键词列表 ["留学咨询", "英语培训"]
    match_mode = Column(String(20), default="fuzzy")                # exact / fuzzy
    search_interval_hours = Column(Integer, default=6)             # 搜索间隔（小时）
    is_active = Column(Boolean, default=True)
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)
    campus = relationship("Campus", foreign_keys=[campus_id])
    created_by_id = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    created_by = relationship("TeamMember", foreign_keys=[created_by_id])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # 关联
    tasks = relationship("CollectionTask", back_populates="keyword_config")


# ─────────────────────────────────────────
# 采集任务记录表 (自媒体拓客 v3.0 新增)
# ─────────────────────────────────────────
class CollectionTask(Base):
    """采集任务执行记录"""
    __tablename__ = "collection_tasks"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(30), nullable=False)                    # douyin / xiaohongshu / wechat_video
    task_type = Column(String(30), default="keyword_search")        # keyword_search / comment_collect / account_sync
    keyword_config_id = Column(Integer, ForeignKey("keyword_configs.id"), nullable=True)
    keyword_config = relationship("KeywordConfig", back_populates="tasks")

    status = Column(String(20), default="pending")                  # pending / running / completed / failed
    total_found = Column(Integer, default=0)                        # 找到的帖子数
    leads_created = Column(Integer, default=0)                      # 生成的线索数
    started_at = Column(DateTime, nullable=True)                    # 开始时间
    completed_at = Column(DateTime, nullable=True)                  # 完成时间
    error_message = Column(Text, nullable=True)                     # 错误信息
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)
    campus = relationship("Campus", foreign_keys=[campus_id])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
