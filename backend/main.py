from fastapi import FastAPI

import models  # noqa: F401  (registers tables on Base.metadata)
from database import Base, engine
from routers import problems

Base.metadata.create_all(engine)

app = FastAPI()
app.include_router(problems.router)
