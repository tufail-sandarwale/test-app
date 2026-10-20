from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import SavedLocation, SavedRoute


def serialize(record: SavedLocation | SavedRoute) -> dict:
    return {**record.data, "id": record.id, "createdAt": record.created_at, "updatedAt": record.updated_at}


def owned(session: Session, model, owner_id: str, item_id: str):
    record = session.scalar(select(model).where(model.id == item_id, model.owner_id == owner_id))
    if record is None:
        raise HTTPException(404, "Preset not found.")
    return record


def list_owned(session: Session, model, owner_id: str, offset: int, limit: int):
    statement = select(model).where(model.owner_id == owner_id).order_by(model.created_at, model.id).offset(offset).limit(limit)
    return [serialize(record) for record in session.scalars(statement)]


def save(session: Session, model, owner_id: str, data: dict, item_id: str | None = None):
    record = owned(session, model, owner_id, item_id) if item_id else model(owner_id=owner_id)
    record.data = data
    session.add(record)
    session.commit()
    session.refresh(record)
    return serialize(record)


def delete(session: Session, model, owner_id: str, item_id: str):
    session.delete(owned(session, model, owner_id, item_id))
    session.commit()