"""审计日志服务 — 操作留痕

自动记录所有对客户信息的创建、修改、删除操作。
支持字段级变更追踪：谁在什么时间修改了什么字段，从什么值改为什么值。

使用方式：
    from services.audit_logger import AuditLogger
    
    # 在路由中调用
    AuditLogger.log_create(db, user, "lead", lead.id, {"name": "张三", "phone": "138..."})
    AuditLogger.log_update(db, user, "lead", lead.id, old_values, new_values)
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models import AuditLog, TeamMember


class AuditLogger:

    @staticmethod
    def log(
        db: Session,
        user: Optional[TeamMember],
        action_type: str,
        target_type: str,
        target_id: Optional[int],
        field_name: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        ip_address: Optional[str] = None,
    ):
        """写入一条审计日志"""
        log = AuditLog(
            user_id=user.id if user else None,
            user_name=user.display_name if user else "系统",
            user_role=user.role if user else "system",
            campus_id=user.campus_id if user else None,
            action_type=action_type,
            target_type=target_type,
            target_id=target_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
        )
        db.add(log)

    @staticmethod
    def log_create(
        db: Session,
        user: Optional[TeamMember],
        target_type: str,
        target_id: int,
        created_data: Dict[str, Any],
        ip_address: Optional[str] = None,
    ):
        """记录创建操作 — 记录所有字段的初始值"""
        for field, value in created_data.items():
            if value is not None:
                AuditLogger.log(
                    db, user, "create", target_type, target_id,
                    field_name=field,
                    new_value=str(value),
                    ip_address=ip_address,
                )

    @staticmethod
    def log_update(
        db: Session,
        user: Optional[TeamMember],
        target_type: str,
        target_id: int,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        ip_address: Optional[str] = None,
        sensitive_fields: Optional[list] = None,
    ):
        """
        记录更新操作 — 自动比对字段变更
        
        Args:
            sensitive_fields: 如果指定，只记录这些字段的变更（如 ["phone", "name"]）
                              如果不指定，记录所有字段变更
        """
        for field in new_values:
            # 如果指定了敏感字段，只记录这些字段
            if sensitive_fields and field not in sensitive_fields:
                continue

            old_val = old_values.get(field)
            new_val = new_values[field]

            # 只有值确实发生变化时才记录
            if str(old_val) != str(new_val):
                AuditLogger.log(
                    db, user, "update", target_type, target_id,
                    field_name=field,
                    old_value=str(old_val) if old_val is not None else "",
                    new_value=str(new_val) if new_val is not None else "",
                    ip_address=ip_address,
                )

    @staticmethod
    def log_delete(
        db: Session,
        user: Optional[TeamMember],
        target_type: str,
        target_id: int,
        deleted_data: Dict[str, Any],
        ip_address: Optional[str] = None,
    ):
        """记录删除操作"""
        AuditLogger.log(
            db, user, "delete", target_type, target_id,
            field_name="id",
            old_value=str(deleted_data.get("id", target_id)),
            ip_address=ip_address,
        )
