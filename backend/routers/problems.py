from fastapi import APIRouter, Depends
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.problem import Problem
from schemas.problem import ProblemOut, ProblemIn
from services.tag_labeling import label_problem

router = APIRouter(prefix="/problems", tags=["problems"])

@router.post(path='/{contestid}/{index}', response_model=ProblemOut,
            description='Retrieve the extra tags for a problem, identified by its contest ID and index')
async def get_extra_tags(
        contestid : int,
        index : str,
        problem : ProblemIn,
        db : AsyncSession = Depends(get_db)
):
    results = await db.execute(select(Problem).where(
        and_(Problem.contestID == contestid, Problem.index == index)
    ))

    problemObject = results.scalar_one_or_none()
    if problemObject is not None:
        problem_with_tags = ProblemOut.model_validate(problemObject)
        return problem_with_tags
    else:
        tags = await label_problem(problem.problemText)
        problemObject = Problem(contestID=contestid, index=index, extraTags=[tag.value for tag in tags])
        db.add(problemObject)
        await db.commit()
        return ProblemOut.model_validate(problemObject)