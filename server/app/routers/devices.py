# 기기 라우터 — 익명 기기ID 발급 (회원가입 없음, Fallcent와 동일 방식)
# PLATFORM: server
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device
from app.schemas import DeviceOut

router = APIRouter(tags=["devices"])


@router.post("/devices", response_model=DeviceOut)
def create_device(db: Session = Depends(get_db)) -> DeviceOut:
    """최초 실행 시 클라이언트가 호출 — 랜덤 기기ID 발급"""
    device_id = str(uuid.uuid4())
    db.add(Device(id=device_id))
    db.commit()
    return DeviceOut(device_id=device_id)
