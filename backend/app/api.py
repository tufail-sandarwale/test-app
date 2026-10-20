from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from slowapi import Limiter
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from . import repository
from .config import Settings
from .models import SavedLocation, SavedRoute, User
from .schemas import Credentials, LocationInput, LocationOutput, RouteInput, RouteOutput, Token

passwords = PasswordHash.recommended()
dummy_hash = passwords.hash("unused-password-for-timing-only")
bearer = HTTPBearer(auto_error=False)


def create_router(session_factory, settings: Settings, limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    def database():
        with session_factory() as session:
            yield session

    def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), session=Depends(database)):
        failure = HTTPException(401, "Invalid or expired credentials.", headers={"WWW-Authenticate": "Bearer"})
        if credentials is None:
            raise failure
        try:
            payload = jwt.decode(credentials.credentials, settings.jwt_secret.get_secret_value(), algorithms=["HS256"], audience="mock-gps-client", issuer="mock-gps-tester", options={"require": ["exp", "iat", "sub"]})
            user = session.get(User, payload["sub"])
        except jwt.InvalidTokenError:
            raise failure from None
        if user is None:
            raise failure
        return user

    def token(user: User) -> Token:
        now = datetime.now(timezone.utc)
        encoded = jwt.encode({"sub": user.id, "iat": now, "exp": now + timedelta(minutes=settings.token_minutes), "iss": "mock-gps-tester", "aud": "mock-gps-client"}, settings.jwt_secret.get_secret_value(), algorithm="HS256")
        return Token(access_token=encoded, expires_in=settings.token_minutes * 60)

    @router.post("/auth/register", response_model=Token, status_code=201)
    @limiter.limit("5/minute")
    def register(request: Request, body: Credentials, response: Response, session=Depends(database)):
        user = User(email=str(body.email).lower(), password_hash=passwords.hash(body.password.get_secret_value()))
        session.add(user)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(409, "Account cannot be registered with these details.") from None
        response.headers["Cache-Control"] = "no-store"
        return token(user)

    @router.post("/auth/login", response_model=Token)
    @limiter.limit("10/minute")
    def login(request: Request, body: Credentials, response: Response, session=Depends(database)):
        user = session.scalar(select(User).where(User.email == str(body.email).lower()))
        valid = passwords.verify(body.password.get_secret_value(), user.password_hash if user else dummy_hash)
        if not valid or user is None:
            raise HTTPException(401, "Invalid email or password.")
        response.headers["Cache-Control"] = "no-store"
        return token(user)

    @router.get("/locations", response_model=list[LocationOutput])
    def locations(offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100), user=Depends(current_user), session=Depends(database)):
        return repository.list_owned(session, SavedLocation, user.id, offset, limit)

    @router.post("/locations", response_model=LocationOutput, status_code=201)
    def create_location(body: LocationInput, user=Depends(current_user), session=Depends(database)):
        return repository.save(session, SavedLocation, user.id, body.model_dump())

    @router.get("/locations/{item_id}", response_model=LocationOutput)
    def get_location(item_id: str, user=Depends(current_user), session=Depends(database)):
        return repository.serialize(repository.owned(session, SavedLocation, user.id, item_id))

    @router.put("/locations/{item_id}", response_model=LocationOutput)
    def update_location(item_id: str, body: LocationInput, user=Depends(current_user), session=Depends(database)):
        return repository.save(session, SavedLocation, user.id, body.model_dump(), item_id)

    @router.delete("/locations/{item_id}", status_code=204)
    def delete_location(item_id: str, user=Depends(current_user), session=Depends(database)):
        repository.delete(session, SavedLocation, user.id, item_id)
        return Response(status_code=204)

    @router.get("/routes", response_model=list[RouteOutput])
    def routes(offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100), user=Depends(current_user), session=Depends(database)):
        return repository.list_owned(session, SavedRoute, user.id, offset, limit)

    @router.post("/routes", response_model=RouteOutput, status_code=201)
    def create_route(body: RouteInput, user=Depends(current_user), session=Depends(database)):
        return repository.save(session, SavedRoute, user.id, body.model_dump())

    @router.get("/routes/{item_id}", response_model=RouteOutput)
    def get_route(item_id: str, user=Depends(current_user), session=Depends(database)):
        return repository.serialize(repository.owned(session, SavedRoute, user.id, item_id))

    @router.put("/routes/{item_id}", response_model=RouteOutput)
    def update_route(item_id: str, body: RouteInput, user=Depends(current_user), session=Depends(database)):
        return repository.save(session, SavedRoute, user.id, body.model_dump(), item_id)

    @router.delete("/routes/{item_id}", status_code=204)
    def delete_route(item_id: str, user=Depends(current_user), session=Depends(database)):
        repository.delete(session, SavedRoute, user.id, item_id)
        return Response(status_code=204)

    return router