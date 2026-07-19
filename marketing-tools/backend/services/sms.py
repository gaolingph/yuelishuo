"""短信服务 — 验证码发送（支持模拟 / 阿里云 / 腾讯云）

配置方式（.env 文件）:
    SMS_PROVIDER=mock        # mock | aliyun | tencent
    SMS_ACCESS_KEY_ID=xxx
    SMS_ACCESS_KEY_SECRET=xxx
    SMS_SIGN_NAME=乐说邦
    SMS_TEMPLATE_CODE=SMS_XXXXX
"""
import random
import datetime
from typing import Optional

from config import settings

# 内存存储验证码（生产环境应使用 Redis）
_verification_codes: dict[str, dict] = {}


async def send_sms_code(phone: str, code: Optional[str] = None) -> str:
    """
    发送短信验证码
    返回验证码本身（方便调试）
    """
    if code is None:
        code = f"{random.randint(100000, 999999)}"

    # 存储验证码（带过期时间）
    _verification_codes[phone] = {
        "code": code,
        "expires_at": datetime.datetime.utcnow() + datetime.timedelta(seconds=settings.SMS_CODE_EXPIRE_SECONDS),
        "sent_at": datetime.datetime.utcnow(),
    }

    provider = settings.SMS_PROVIDER

    if provider == "aliyun":
        await _send_aliyun(phone, code)
    elif provider == "tencent":
        await _send_tencent(phone, code)
    else:
        # 模拟模式 — 打印到控制台
        print(f"\n{'='*60}")
        print(f"  [短信模拟] 发送验证码到 {phone}")
        print(f"  [短信模拟] 验证码: {code}")
        print(f"  [短信模拟] 有效期: {settings.SMS_CODE_EXPIRE_SECONDS} 秒")
        print(f"{'='*60}\n")

    return code


async def _send_aliyun(phone: str, code: str):
    """通过阿里云短信发送验证码"""
    try:
        from aliyunsdkcore.client import AcsClient
        from aliyunsdkcore.request import CommonRequest

        client = AcsClient(
            settings.SMS_ACCESS_KEY_ID,
            settings.SMS_ACCESS_KEY_SECRET,
            "cn-hangzhou"
        )
        request = CommonRequest()
        request.set_accept_format("json")
        request.set_domain("dysmsapi.aliyuncs.com")
        request.set_method("POST")
        request.set_protocol_type("https")
        request.set_version("2017-05-25")
        request.set_action_name("SendSms")
        request.add_query_param("PhoneNumbers", phone)
        request.add_query_param("SignName", settings.SMS_SIGN_NAME)
        request.add_query_param("TemplateCode", settings.SMS_TEMPLATE_CODE)
        request.add_query_param("TemplateParam", f'{{"code":"{code}"}}')

        response = client.do_action_with_exception(request)
        print(f"[阿里云短信] 发送结果: {response.decode('utf-8')}")
    except ImportError:
        print("[阿里云短信] 请先安装: pip install aliyun-python-sdk-core")
    except Exception as e:
        print(f"[阿里云短信] 发送失败: {e}")


async def _send_tencent(phone: str, code: str):
    """通过腾讯云短信发送验证码"""
    try:
        from tencentcloud.common import credential
        from tencentcloud.sms.v20210111 import sms_client, models

        cred = credential.Credential(
            settings.SMS_ACCESS_KEY_ID,
            settings.SMS_ACCESS_KEY_SECRET
        )
        client = sms_client.SmsClient(cred, "ap-guangzhou")

        req = models.SendSmsRequest()
        req.PhoneNumberSet = [f"+86{phone}"]
        req.SignName = settings.SMS_SIGN_NAME
        req.TemplateId = settings.SMS_TEMPLATE_CODE
        req.TemplateParamSet = [code]

        resp = client.SendSms(req)
        print(f"[腾讯云短信] 发送结果: {resp}")
    except ImportError:
        print("[腾讯云短信] 请先安装: pip install tencentcloud-sdk-python")
    except Exception as e:
        print(f"[腾讯云短信] 发送失败: {e}")


def verify_sms_code(phone: str, code: str) -> bool:
    """验证短信验证码"""
    record = _verification_codes.get(phone)
    if not record:
        return False

    # 检查是否过期
    if datetime.datetime.utcnow() > record["expires_at"]:
        del _verification_codes[phone]
        return False

    # 验证码匹配
    if record["code"] == code:
        del _verification_codes[phone]  # 一次性使用
        return True

    return False


def get_last_code(phone: str) -> Optional[str]:
    """
    获取最近发送的验证码（仅开发调试用）
    生产环境应移除或加上权限控制
    """
    record = _verification_codes.get(phone)
    if record and datetime.datetime.utcnow() <= record["expires_at"]:
        return record["code"]
    return None
