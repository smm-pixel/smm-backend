from datetime import datetime, timezone
from typing import Any, Annotated
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
import uuid

def _to_str(v: Any) -> str:
    return str(v)
PyObjectId = Annotated[str, BeforeValidator(_to_str)]
def genid() -> str: return str(uuid.uuid4())
def now_utc() -> datetime: return datetime.now(timezone.utc)
class BaseRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, extra="ignore")
    id: str = Field(default_factory=genid)
    def to_record(self) -> dict:
        d = self.model_dump()
        for k, v in list(d.items()):
            if isinstance(v, datetime): d[k] = v.isoformat()
        return d
    @classmethod
    def from_record(cls, doc: dict):
        if not doc: return None
        d = dict(doc); d.pop("id", None); return cls(**d)
