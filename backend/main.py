from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

load_dotenv()

import models  # noqa: F401  (registers tables on Base.metadata)
from database import Base, engine
from openai import APIError
from pydantic import ValidationError
from routers import problems
from services.tag_labeling import TagLabelingError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError



@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(problems.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.exception_handler(TagLabelingError)
async def tag_labeling_error_handler(request: Request, exc: TagLabelingError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(APIError)
async def openai_error_handler(request: Request, exc: APIError):
    return JSONResponse(status_code=502, content={"detail": "The AI service failed. Try again."})


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(status_code=409, content={"detail": "That conflicts with existing data."})


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    return JSONResponse(status_code=503, content={"detail": "Database error. Try again."})


@app.exception_handler(ValidationError)
async def model_validation_error_handler(request: Request, exc: ValidationError):
    # Raised by manual model_validate calls on our own data, so this is a server-side problem.
    return JSONResponse(status_code=500, content={"detail": "Stored data did not match the expected format."})
