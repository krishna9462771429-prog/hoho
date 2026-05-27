from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from routers import apis, ai, merge, ticker, monitoring, analytics, workflows
from websocket.events import router as websocket_router
from scheduler.jobs import start_scheduler

app = FastAPI(
    title="APIMerge API",
    description="AI-Powered API Reliability & Orchestration Platform",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    start_scheduler()


@app.get("/")
async def root():
    return {"status": "ok", "service": "APIMerge API", "version": "1.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


app.include_router(apis.router, prefix="/apis", tags=["APIs"])
app.include_router(ai.router, prefix="/ai", tags=["AI"])
app.include_router(merge.router, prefix="/merge", tags=["Merge"])
app.include_router(ticker.router, prefix="/ticker", tags=["Ticker"])
app.include_router(monitoring.router, prefix="/monitoring", tags=["Monitoring"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(workflows.router, prefix="/workflows", tags=["Workflows"])
app.include_router(websocket_router, tags=["WebSocket"])


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
