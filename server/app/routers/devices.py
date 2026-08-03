# 기기 라우터 — 익명 기기ID 발급 (회원가입 없음, Fallcent와 동일 방식)
# PLATFORM: server
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device
from app.schemas import DeviceOut, DeviceRegisterIn

router = APIRouter(tags=["devices"])


@router.post("/devices", response_model=DeviceOut)
def create_device(
    payload: DeviceRegisterIn | None = None, db: Session = Depends(get_db)
) -> DeviceOut:
    """최초 실행 시 클라이언트가 호출 — 클라이언트 생성 UUID 등록 (이미 등록됐으면 재사용)"""
    device_id = (payload.device_id if payload and payload.device_id else str(uuid.uuid4())).strip()
    if db.get(Device, device_id) is None:
        db.add(Device(id=device_id))
        db.commit()
    return DeviceOut(device_id=device_id)
