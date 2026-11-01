from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models.problem import Problem
from schemas.problem import ProblemIn, ProblemOut

router = APIRouter(prefix="/problems", tags=["problems"])