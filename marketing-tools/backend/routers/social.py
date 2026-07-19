"""自媒体拓客 — 社交媒体采集与管理 API 路由（含认证、校区隔离、审计日志）"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import datetime

from database import get_db
from models import SocialAccount, SocialPost, KeywordConfig, CollectionTask, Lead, LeadSource, TeamMember
from schemas import (
    SocialAccountCreate, SocialAccountResponse, SocialAccountListResponse,
    SocialPostCreate, SocialPostResponse, SocialPostListResponse,
    KeywordConfigCreate, KeywordConfigUpdate, KeywordConfigResponse, KeywordConfigListResponse,
    CollectionTaskCreateRequest, CollectionTaskResponse, CollectionTaskListResponse,
)
from auth import get_current_user, check_role
from services.audit_logger import AuditLogger
from services.social.task_manager import (
    execute_collection_task,
    register_keyword_task,
    unregister_keyword_task,
)

router = APIRouter(tags=["自媒体拓客"])


def _get_campus_filter(db, user, model):
    """根据用户角色返回带校区过滤的 query"""
    if user.role == "super_admin":
        return db.query(model)
    return db.query(model).filter(model.campus_id == user.campus_id)


# ═══════════════════════════════════════════
# 社交媒体账号管理
# ═══════════════════════════════════════════

@router.get("/social/accounts", response_model=SocialAccountListResponse)
def list_accounts(
    platform: Optional[str] = Query(None, description="按平台筛选"),
    campus_id: Optional[int] = Query(None, description="按校区筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取已绑定的社交媒体账号列表（按校区隔离）"""
    query = _get_campus_filter(db, user, SocialAccount)
    if platform:
        query = query.filter(SocialAccount.platform == platform)
    if campus_id and user.role == "super_admin":
        query = query.filter(SocialAccount.campus_id == campus_id)

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "items": items}


@router.post("/social/accounts", response_model=SocialAccountResponse, status_code=201)
def create_account(
    data: SocialAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """绑定新的社交媒体账号"""
    # 非 super_admin 只能绑定自己校区的账号
    if user.role != "super_admin":
        data.campus_id = data.campus_id or user.campus_id
        if data.campus_id != user.campus_id:
            raise HTTPException(status_code=403, detail="不能为其他校区绑定账号")

    existing = db.query(SocialAccount).filter(
        SocialAccount.platform == data.platform,
        SocialAccount.account_id == data.account_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="该账号已在平台绑定")

    account = SocialAccount(**data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)

    AuditLogger.log_create(
        db, user, "social_account", account.id,
        {"platform": account.platform, "account_id": account.account_id, "nickname": account.nickname},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return account


@router.delete("/social/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """解绑社交媒体账号"""
    account = db.query(SocialAccount).filter(SocialAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    # 校区隔离
    if user.role != "super_admin" and account.campus_id != user.campus_id:
        raise HTTPException(status_code=403, detail="无权操作其他校区账号")

    AuditLogger.log_delete(
        db, user, "social_account", account.id,
        {"id": account.id, "platform": account.platform, "account_id": account.account_id},
        ip_address=request.client.host if request.client else None,
    )
    db.delete(account)
    db.commit()


# ═══════════════════════════════════════════
# 采集帖子管理
# ═══════════════════════════════════════════

@router.get("/social/posts", response_model=SocialPostListResponse)
def list_posts(
    platform: Optional[str] = Query(None, description="按平台筛选"),
    is_lead_generated: Optional[bool] = Query(None, description="是否已转为线索"),
    keyword: Optional[str] = Query(None, description="按关键词模糊搜索"),
    campus_id: Optional[int] = Query(None, description="按校区筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取采集到的社交媒体帖子列表（按校区隔离）"""
    query = _get_campus_filter(db, user, SocialPost)
    if platform:
        query = query.filter(SocialPost.platform == platform)
    if is_lead_generated is not None:
        query = query.filter(SocialPost.is_lead_generated == is_lead_generated)
    if keyword:
        query = query.filter(
            SocialPost.title.contains(keyword) | SocialPost.content.contains(keyword)
        )
    if campus_id and user.role == "super_admin":
        query = query.filter(SocialPost.campus_id == campus_id)

    total = query.count()
    items = query.order_by(SocialPost.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return {"total": total, "items": items}


@router.get("/social/posts/{post_id}", response_model=SocialPostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取帖子详情"""
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    # 校区隔离
    if user.role != "super_admin" and post.campus_id != user.campus_id:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return post


@router.post("/social/posts/{post_id}/generate-lead", response_model=dict)
def generate_lead_from_post(
    post_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """从指定帖子手动生成线索"""
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    if post.is_lead_generated:
        raise HTTPException(status_code=409, detail="该帖子已生成过线索")
    # 校区隔离
    if user.role != "super_admin" and post.campus_id != user.campus_id:
        raise HTTPException(status_code=404, detail="帖子不存在")

    # 平台到 LeadSource 的映射
    platform_source_map = {
        "douyin": LeadSource.DOUYIN.value,
        "xiaohongshu": LeadSource.XIAOHONGSHU.value,
        "wechat_video": LeadSource.WECHAT.value,
    }
    source = platform_source_map.get(post.platform, LeadSource.MANUAL.value)

    # 创建线索
    lead = Lead(
        name=post.author_name,
        source=source,
        source_detail=f"{post.platform}帖子: {post.post_id} | {post.title or ''}",
        notes=f"从{post.platform}自动采集\n作者: {post.author_name}\n标题: {post.title or ''}\n内容: {(post.content or '')[:200]}",
        campus_id=post.campus_id,
        status="new",
    )
    db.add(lead)
    db.flush()

    # 标记帖子已生成线索
    post.is_lead_generated = True

    # 审计日志
    AuditLogger.log_create(
        db, user, "lead", lead.id,
        {"name": lead.name, "source": lead.source, "post_id": post.post_id, "platform": post.platform},
        ip_address=request.client.host if request.client else None,
    )
    AuditLogger.log(
        db, user, "update", "social_post", post.id,
        field_name="is_lead_generated",
        old_value="False",
        new_value="True",
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    return {"message": "线索已生成", "lead_id": lead.id}


# ═══════════════════════════════════════════
# 关键词配置管理
# ═══════════════════════════════════════════

@router.get("/social/keywords", response_model=KeywordConfigListResponse)
def list_keywords(
    platform: Optional[str] = Query(None, description="按平台筛选"),
    is_active: Optional[bool] = Query(None, description="按状态筛选"),
    campus_id: Optional[int] = Query(None, description="按校区筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取关键词监控配置列表（按校区隔离）"""
    query = _get_campus_filter(db, user, KeywordConfig)
    if platform:
        query = query.filter(KeywordConfig.platform == platform)
    if is_active is not None:
        query = query.filter(KeywordConfig.is_active == is_active)
    if campus_id and user.role == "super_admin":
        query = query.filter(KeywordConfig.campus_id == campus_id)

    total = query.count()
    items = query.order_by(KeywordConfig.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return {"total": total, "items": items}


@router.post("/social/keywords", response_model=KeywordConfigResponse, status_code=201)
def create_keyword(
    data: KeywordConfigCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """新增关键词监控配置（自动注册定时任务）"""
    # 非 super_admin 只能创建自己校区的配置
    if user.role != "super_admin":
        data.campus_id = data.campus_id or user.campus_id
        if data.campus_id != user.campus_id:
            raise HTTPException(status_code=403, detail="不能为其他校区创建配置")

    keyword_config = KeywordConfig(
        **data.model_dump(),
        created_by_id=user.id,
    )
    db.add(keyword_config)
    db.commit()
    db.refresh(keyword_config)

    # 审计日志
    AuditLogger.log_create(
        db, user, "keyword_config", keyword_config.id,
        {"name": keyword_config.name, "platform": keyword_config.platform,
         "keywords": str(keyword_config.keywords), "is_active": str(keyword_config.is_active)},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    # 自动注册定时采集任务
    if keyword_config.is_active:
        register_keyword_task(keyword_config)

    return keyword_config


@router.put("/social/keywords/{keyword_id}", response_model=KeywordConfigResponse)
def update_keyword(
    keyword_id: int,
    data: KeywordConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """修改关键词配置（自动同步定时任务）"""
    kw = db.query(KeywordConfig).filter(KeywordConfig.id == keyword_id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="关键词配置不存在")
    # 校区隔离
    if user.role != "super_admin" and kw.campus_id != user.campus_id:
        raise HTTPException(status_code=404, detail="关键词配置不存在")

    # 记录旧状态用于审计和任务同步
    old_active = kw.is_active
    old_platform = kw.platform
    old_values = {
        "name": kw.name, "platform": kw.platform,
        "keywords": str(kw.keywords), "is_active": str(kw.is_active),
        "search_interval_hours": str(kw.search_interval_hours),
    }

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kw, field, value)
    kw.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(kw)

    # 审计日志（记录变更的字段）
    new_values = {
        "name": kw.name, "platform": kw.platform,
        "keywords": str(kw.keywords), "is_active": str(kw.is_active),
        "search_interval_hours": str(kw.search_interval_hours),
    }
    AuditLogger.log_update(
        db, user, "keyword_config", kw.id, old_values, new_values,
        ip_address=request.client.host if request.client else None,
        sensitive_fields=list(update_data.keys()),
    )
    db.commit()

    # 同步调度器任务
    was_active_before = old_active and kw.is_active
    became_inactive = old_active and not kw.is_active
    became_active = not old_active and kw.is_active

    if became_inactive:
        unregister_keyword_task(kw.id, old_platform)
    elif became_active:
        register_keyword_task(kw)
    elif was_active_before and (old_platform != kw.platform or update_data.get("search_interval_hours")):
        unregister_keyword_task(kw.id, old_platform)
        register_keyword_task(kw)

    return kw


@router.delete("/social/keywords/{keyword_id}", status_code=204)
def delete_keyword(
    keyword_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """删除关键词配置（自动取消定时任务）"""
    kw = db.query(KeywordConfig).filter(KeywordConfig.id == keyword_id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="关键词配置不存在")
    # 校区隔离
    if user.role != "super_admin" and kw.campus_id != user.campus_id:
        raise HTTPException(status_code=404, detail="关键词配置不存在")

    # 取消定时任务
    if kw.is_active:
        unregister_keyword_task(kw.id, kw.platform)

    AuditLogger.log_delete(
        db, user, "keyword_config", kw.id,
        {"id": kw.id, "name": kw.name, "platform": kw.platform, "keywords": str(kw.keywords)},
        ip_address=request.client.host if request.client else None,
    )
    db.delete(kw)
    db.commit()


# ═══════════════════════════════════════════
# 采集任务管理
# ═══════════════════════════════════════════

@router.get("/social/tasks", response_model=CollectionTaskListResponse)
def list_tasks(
    platform: Optional[str] = Query(None, description="按平台筛选"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    campus_id: Optional[int] = Query(None, description="按校区筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取采集任务历史记录（按校区隔离）"""
    query = _get_campus_filter(db, user, CollectionTask)
    if platform:
        query = query.filter(CollectionTask.platform == platform)
    if status:
        query = query.filter(CollectionTask.status == status)
    if campus_id and user.role == "super_admin":
        query = query.filter(CollectionTask.campus_id == campus_id)

    total = query.count()
    items = query.order_by(CollectionTask.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return {"total": total, "items": items}


@router.post("/social/tasks", response_model=CollectionTaskResponse, status_code=201)
def create_task(
    data: CollectionTaskCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """创建采集任务（由调度器异步执行）"""
    kw = db.query(KeywordConfig).filter(KeywordConfig.id == data.keyword_config_id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="关键词配置不存在")
    # 校区隔离
    if user.role != "super_admin" and kw.campus_id != user.campus_id:
        raise HTTPException(status_code=404, detail="关键词配置不存在")

    task = CollectionTask(
        platform=data.platform,
        task_type=data.task_type,
        keyword_config_id=data.keyword_config_id,
        status="pending",
        campus_id=data.campus_id or kw.campus_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    AuditLogger.log_create(
        db, user, "collection_task", task.id,
        {"platform": task.platform, "keyword_config_id": str(task.keyword_config_id), "task_type": task.task_type},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return task


@router.post("/social/tasks/{task_id}/execute", response_model=dict)
async def execute_task(
    task_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """手动触发执行指定采集任务"""
    task = db.query(CollectionTask).filter(CollectionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status == "running":
        raise HTTPException(status_code=409, detail="任务正在执行中")
    # 校区隔离
    if user.role != "super_admin" and task.campus_id != user.campus_id:
        raise HTTPException(status_code=404, detail="任务不存在")

    AuditLogger.log(
        db, user, "update", "collection_task", task.id,
        field_name="status", old_value=task.status, new_value="running",
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    await execute_collection_task(
        task_id=task.id,
        keyword_config_id=task.keyword_config_id,
        platform=task.platform,
    )

    # 重新加载以获取最新状态
    db.refresh(task)
    AuditLogger.log(
        db, user, "update", "collection_task", task.id,
        field_name="status", old_value="running", new_value=task.status,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    return {
        "message": "任务执行完成",
        "task_id": task.id,
        "status": task.status,
        "total_found": task.total_found,
        "leads_created": task.leads_created,
    }


@router.post("/social/collect-now", response_model=dict)
async def collect_now(
    request: Request,
    platform: str = Query(..., description="平台: douyin / xiaohongshu / wechat_video"),
    keywords: str = Query(..., description="搜索关键词，多个用逗号分隔"),
    name: str = Query("临时采集", description="配置名称"),
    campus_id: Optional[int] = Query(None, description="校区ID"),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """
    一键采集：创建临时关键词配置 → 立即执行采集 → 返回结果统计
    适用于快速测试和手动补采
    """
    import asyncio
    from services.social.task_manager import COLLECTOR_MAP, PLATFORM_SOURCE_MAP
    from services.social.scoring_engine import ScoringEngine

    # 校区归属
    if user.role != "super_admin":
        campus_id = campus_id or user.campus_id
        if campus_id != user.campus_id:
            raise HTTPException(status_code=403, detail="不能为其他校区执行采集")
    ip_addr = request.client.host if request.client else None

    keyword_list = [kw.strip() for kw in keywords.split(",") if kw.strip()]
    if not keyword_list:
        raise HTTPException(status_code=400, detail="至少提供一个关键词")

    # 1. 创建临时关键词配置
    kw_config = KeywordConfig(
        platform=platform,
        name=name,
        keywords=keyword_list,
        match_mode="fuzzy",
        is_active=False,
        campus_id=campus_id,
        created_by_id=user.id,
    )
    db.add(kw_config)
    db.commit()
    db.refresh(kw_config)

    # 2. 创建任务记录
    task = CollectionTask(
        platform=platform,
        task_type="keyword_search",
        keyword_config_id=kw_config.id,
        status="running",
        campus_id=campus_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # 3. 执行采集
    collector_cls = COLLECTOR_MAP.get(platform)
    if not collector_cls:
        raise HTTPException(status_code=400, detail=f"不支持的平台: {platform}")

    collector = collector_cls()
    try:
        raw_posts = await collector.collect_to_leads(keyword_list)

        # 4. 评分并创建线索
        engine = ScoringEngine()
        leads_created = 0
        created_leads = []

        for post_data in raw_posts:
            content = post_data.get("content", "") or ""
            title = post_data.get("title", "") or ""
            score_result = engine.score_post(content, title)

            if not score_result["should_convert"]:
                continue

            # 写入 SocialPost
            social_post = SocialPost(
                platform=platform,
                post_id=post_data.get("post_id", ""),
                author_id=post_data.get("author_id", ""),
                author_name=post_data.get("author_name", ""),
                title=title,
                content=content,
                like_count=post_data.get("like_count", 0),
                comment_count=post_data.get("comment_count", 0),
                share_count=post_data.get("share_count", 0),
                posted_at=post_data.get("posted_at"),
                is_lead_generated=True,
                source_keywords=post_data.get("source_keywords", ""),
                campus_id=campus_id,
            )
            db.add(social_post)
            db.flush()

            # 创建 Lead
            source = PLATFORM_SOURCE_MAP.get(platform, LeadSource.MANUAL.value)
            lead = Lead(
                name=post_data.get("author_name"),
                source=source,
                source_detail=f"{platform}即时采集 | {title}",
                notes=f"一键采集 | 评分: {score_result['total_score']}分\n"
                      f"平台: {platform} | 作者: {post_data.get('author_name', '')}\n"
                      f"标题: {title}\n"
                      f"内容: {content[:200]}",
                campus_id=campus_id,
                status="new",
            )
            db.add(lead)
            db.flush()
            leads_created += 1
            created_leads.append({"lead_id": lead.id, "score": score_result["total_score"]})

        # 5. 更新任务状态
        task.status = "completed"
        task.total_found = len(raw_posts)
        task.leads_created = leads_created
        task.completed_at = datetime.datetime.utcnow()

        # 一键采集审计：记录创建的动作
        AuditLogger.log_create(
            db, user, "keyword_config", kw_config.id,
            {"name": kw_config.name, "platform": platform, "keywords": str(keyword_list), "type": "collect-now"},
            ip_address=ip_addr,
        )
        AuditLogger.log(
            db, user, "update", "collection_task", task.id,
            field_name="status", old_value="running", new_value="completed",
            ip_address=ip_addr,
        )
        for ld in created_leads:
            AuditLogger.log(
                db, user, "create", "lead", ld["lead_id"],
                field_name="source", new_value=source,
                ip_address=ip_addr,
            )
        db.commit()

        return {
            "message": "一键采集完成",
            "total_found": len(raw_posts),
            "leads_created": leads_created,
            "scored_posts": [
                {
                    "author_name": p.get("author_name", ""),
                    "title": p.get("title", ""),
                    "score": engine.score_post(
                        p.get("content", "") or "",
                        p.get("title", "") or "",
                    )["total_score"],
                }
                for p in raw_posts[:20]
            ],
            "created_leads": created_leads,
        }

    finally:
        await collector.close()
