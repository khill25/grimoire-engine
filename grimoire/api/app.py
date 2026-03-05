"""FastAPI application — main entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from grimoire.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Shutdown: cleanup resources
    session = getattr(app, "session", None)
    if session:
        if session.db:
            await session.db.close()
        if session.llm and hasattr(session.llm, "close"):
            await session.llm.close()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Grimoire Engine",
        description="Dynamic RPG world simulation backend",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(router)
    return app


app = create_app()
