from pydantic import BaseModel, ConfigDict
from typing import Optional, Any


class ApiResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    code: int = 200
    msg: str = "ok"
    data: Any = None


class PageResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    code: int = 200
    msg: str = "ok"
    total: int = 0
    rows: list = []


class BookmarkUpdate(BaseModel):
    starred: bool = False
    tags: list[str] = []
    note: str = ""


class SessionQuery(BaseModel):
    project_id: Optional[str] = None
    agent: Optional[str] = None
    date_from: Optional[int] = None
    date_to: Optional[int] = None
    q: Optional[str] = None
    page: int = 1
    per_page: int = 50
