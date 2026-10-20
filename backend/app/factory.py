from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .api import create_router
from .config import Settings


def create_app(settings: Settings, engine=None) -> FastAPI:
    database = engine if engine is not None else create_engine(settings.database_url.get_secret_value(), pool_pre_ping=True)

    @asynccontextmanager
    async def lifespan(app):
        yield
        database.dispose()

    app = FastAPI(title="Mock GPS Tester API", version="1.0.0", lifespan=lifespan)
    limiter = Limiter(key_func=get_remote_address, storage_uri=settings.rate_limit_storage_uri, default_limits=["120/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(create_router(sessionmaker(database, expire_on_commit=False), settings, limiter))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        return JSONResponse(status_code=422, content={"detail": [{"loc": list(issue["loc"]), "msg": issue["msg"], "type": issue["type"]} for issue in error.errors()]})

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app