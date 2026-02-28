import os
from typing import Any, Dict

import httpx
from msal import ConfidentialClientApplication


def _get_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"{name} is not set")
    return v


def get_powerbi_embed_config() -> Dict[str, Any]:
    """Return embed config for a Power BI Report using a Service Principal.

    Required env vars:
    - POWERBI_TENANT_ID
    - POWERBI_CLIENT_ID
    - POWERBI_CLIENT_SECRET
    - POWERBI_WORKSPACE_ID
    - POWERBI_REPORT_ID
    """
    tenant_id = _get_env("POWERBI_TENANT_ID")
    client_id = _get_env("POWERBI_CLIENT_ID")
    client_secret = _get_env("POWERBI_CLIENT_SECRET")
    workspace_id = _get_env("POWERBI_WORKSPACE_ID")
    report_id = _get_env("POWERBI_REPORT_ID")

    authority = f"https://login.microsoftonline.com/{tenant_id}"
    app = ConfidentialClientApplication(
        client_id=client_id,
        client_credential=client_secret,
        authority=authority,
    )

    # Acquire token for Power BI API
    token_result = app.acquire_token_silent(scopes=["https://analysis.windows.net/powerbi/api/.default"], account=None)
    if not token_result:
        token_result = app.acquire_token_for_client(scopes=["https://analysis.windows.net/powerbi/api/.default"])
    if "access_token" not in token_result:
        raise RuntimeError(f"Failed to acquire Power BI token: {token_result.get('error_description') or token_result}")

    access_token = token_result["access_token"]

    # Fetch report metadata to get embedUrl
    url = f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    with httpx.Client(timeout=20.0) as client:
        r = client.get(url, headers=headers)
        r.raise_for_status()
        data = r.json()

    return {
        "type": "report",
        "reportId": report_id,
        "embedUrl": data.get("embedUrl"),
        "accessToken": access_token,
        "tokenType": "Aad",
    }
