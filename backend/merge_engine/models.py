from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from enum import Enum


class MergeStrategy(str, Enum):
    MERGE = "merge"
    FIRST_SUCCESS = "first_success"
    ALL_REQUIRED = "all_required"
    MAJORITY_SUCCESS = "majority_success"
    FALLBACK_CHAIN = "fallback_chain"


class ConflictResolution(str, Enum):
    AVERAGE = "average"
    FIRST_WINS = "first_wins"
    LAST_WINS = "last_wins"
    MAJORITY = "majority"


class TimeoutConfig(BaseModel):
    connect_timeout: float = Field(default=5.0, ge=0.5, le=30.0)
    read_timeout: float = Field(default=10.0, ge=0.5, le=60.0)
    total_timeout: float = Field(default=30.0, ge=1.0, le=120.0)


class RetryConfig(BaseModel):
    max_retries: int = Field(default=2, ge=0, le=5)
    base_delay: float = Field(default=0.5, ge=0.1, le=5.0)
    max_delay: float = Field(default=8.0, ge=1.0, le=30.0)
    jitter: bool = True


class ApiExecutionConfig(BaseModel):
    api_id: str
    timeout: Optional[TimeoutConfig] = None
    retry: Optional[RetryConfig] = None


class MergeExecutionRequest(BaseModel):
    api_ids: List[str] = Field(min_length=2, max_length=20)
    strategy: MergeStrategy = MergeStrategy.MERGE
    user_id: Optional[str] = None
    workflow_id: Optional[str] = None
    timeout: Optional[TimeoutConfig] = None
    retry: Optional[RetryConfig] = None
    conflict_resolution: ConflictResolution = ConflictResolution.AVERAGE
    normalize: bool = True
    per_api_config: Optional[Dict[str, ApiExecutionConfig]] = None


class ApiCallResult(BaseModel):
    api_id: str
    api_name: str
    success: bool
    status_code: Optional[int] = None
    latency_ms: int
    response_size_bytes: int = 0
    retry_count: int = 0
    data: Optional[Any] = None
    error: Optional[str] = None
    timeout_type: Optional[str] = None


class MergeExecutionResult(BaseModel):
    success: bool
    strategy: MergeStrategy
    execution_time_ms: int
    successful_apis: int
    failed_apis: int
    total_apis: int
    data: Optional[Any] = None
    errors: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}
    workflow_id: Optional[str] = None
