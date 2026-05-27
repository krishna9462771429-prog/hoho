from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import httpx
import asyncio

from supabase_client import get_supabase
from websocket.manager import (
    broadcast_api_status,
    broadcast_new_log,
    broadcast_failure,
    broadcast_recovery,
    broadcast_diagnosis,
    broadcast_ai_fallback,
    broadcast_ticker_ping,
)
from services.diagnosis_service import create_diagnosis

scheduler = AsyncIOScheduler()


async def check_all_apis():
    """Periodically check all active APIs and store results."""
    sb = get_supabase()
    apis_res = sb.table("apis").select("*").eq("is_active", True).execute()
    if not apis_res.data:
        return

    for api in apis_res.data:
        try:
            await check_single_api(sb, api)
        except Exception as e:
            print(f"Error checking API {api.get('name')}: {e}")


async def check_single_api(sb, api: dict):
    start = datetime.utcnow()
    previous_status = api.get("last_status", "unknown")
    result = {"status": "error", "status_code": None, "latency_ms": 0, "error_message": ""}
    user_id = api["user_id"]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.request(
                method=api.get("method", "GET"),
                url=api["url"],
                headers=api.get("headers", {}),
                timeout=api.get("timeout", 5000) / 1000,
            )
        latency = int((datetime.utcnow() - start).total_seconds() * 1000)
        expected = api.get("expected_status", 200)
        result = {
            "status": "success" if resp.status_code == expected else "error",
            "status_code": resp.status_code,
            "latency_ms": latency,
            "error_message": "" if resp.status_code == expected else f"Expected {expected}, got {resp.status_code}",
        }
    except Exception as e:
        latency = int((datetime.utcnow() - start).total_seconds() * 1000)
        result = {"status": "error", "status_code": None, "latency_ms": latency, "error_message": str(e)}

    log_payload = {
        **result,
        "api_id": api["id"],
        "user_id": user_id,
        "checked_at": datetime.utcnow().isoformat(),
    }
    sb.table("api_logs").insert(log_payload).execute()

    total = api.get("total_checks", 0) + 1
    failed = api.get("failed_checks", 0) + (1 if result["status"] == "error" else 0)
    uptime = round(((total - failed) / total) * 100, 2) if total > 0 else 100.0

    sb.table("apis").update({
        "last_status": result["status"],
        "last_latency_ms": result["latency_ms"],
        "last_checked_at": datetime.utcnow().isoformat(),
        "total_checks": total,
        "failed_checks": failed,
        "uptime_percent": uptime,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", api["id"]).execute()

    await broadcast_api_status(
        user_id=user_id,
        api_id=api["id"],
        api_name=api["name"],
        status=result["status"],
        latency_ms=result["latency_ms"],
        status_code=result["status_code"],
    )

    await broadcast_new_log(user_id=user_id, log=log_payload)

    if result["status"] == "error":
        if previous_status == "success":
            await broadcast_failure(
                user_id=user_id,
                api_id=api["id"],
                api_name=api["name"],
                error_message=result["error_message"],
                latency_ms=result["latency_ms"],
                status_code=result["status_code"],
            )

        try:
            diagnosis = await create_diagnosis(
                user_id=user_id,
                api_id=api["id"],
                api_name=api["name"],
                url=api["url"],
                status_code=result["status_code"],
                error_message=result["error_message"],
                latency_ms=result["latency_ms"],
            )
            await broadcast_diagnosis(user_id=user_id, diagnosis=diagnosis)
        except Exception as e:
            print(f"Diagnosis failed: {e}")

    elif result["status"] == "success" and previous_status == "error":
        await broadcast_recovery(
            user_id=user_id,
            api_id=api["id"],
            api_name=api["name"],
            latency_ms=result["latency_ms"],
        )


async def ping_all_tickers():
    """Ping all active keep-alive services."""
    sb = get_supabase()
    tickers_res = sb.table("ticker_services").select("*").eq("is_active", True).execute()
    if not tickers_res.data:
        return

    for ticker in tickers_res.data:
        user_id = ticker["user_id"]
        start = datetime.utcnow()
        status = "error"
        latency = 0

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.get(ticker["url"])
            status = "success"
            latency = int((datetime.utcnow() - start).total_seconds() * 1000)
        except Exception:
            status = "error"
            latency = int((datetime.utcnow() - start).total_seconds() * 1000)

        sb.table("ticker_services").update({
            "last_pinged_at": datetime.utcnow().isoformat(),
            "last_status": status,
            "ping_count": ticker["ping_count"] + 1,
        }).eq("id", ticker["id"]).execute()

        await broadcast_ticker_ping(
            user_id=user_id,
            ticker_id=ticker["id"],
            ticker_name=ticker["name"],
            status=status,
            latency_ms=latency,
        )


def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(check_all_apis, IntervalTrigger(seconds=60), id="check_apis", replace_existing=True)
        scheduler.add_job(ping_all_tickers, IntervalTrigger(seconds=300), id="ping_tickers", replace_existing=True)
        scheduler.start()
