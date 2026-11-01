from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.problem import Problem
from schemas.problem import ProblemOut, ProblemIn
from services.openai_service import create_client
from services.tag_labeling import label_problem

router = APIRouter(prefix="/problems", tags=["problems"])

@router.post(path='/{contestid}/{index}', response_model=ProblemOut,
            description='Retrieve the extra tags for a problem, identified by its contest ID and index')
async def get_extra_tags(
        contestid : int,
        index : str,
        problem : ProblemIn,
        x_openai_key : str | None = Header(default=None),
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
        # Only a new problem needs the caller's OpenAI key; saved tags are served without one.
        api_key = (x_openai_key or "").strip()
        if not api_key:
            raise HTTPException(
                status_code=401,
                detail="An OpenAI API key is required to label new problems. Add yours in the CodeTerra popup.",
            )
        async with create_client(api_key) as client:
            tags = await label_problem(client, problem.problemText)
        problemObject = Problem(contestID=contestid, index=index, extraTags=[tag.value for tag in tags])
        db.add(problemObject)
        await db.commit()
        return ProblemOut.model_validate(problemObject)