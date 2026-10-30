import os
from functools import cache

import jwt
import msal
import requests

from .security import AUTH_METHOD, JWT_ALGORITHM, JWT_SECRET

TENANT_ID = os.environ.get("AZURE_TENANT_ID", "").strip()
CLIENT_ID = os.environ.get("AZURE_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET", "").strip()
if AUTH_METHOD == "sso" and not (TENANT_ID and CLIENT_ID and CLIENT_SECRET):
    raise RuntimeError("AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are required for SSO")

# The address of the frontend, Microsoft sends the user back to it after logging in
APP_URL = os.environ.get("APP_URL", f"http://localhost:{os.environ.get('FRONTEND_PORT', '5173')}").rstrip("/")
# Must match a Web redirect URI of the Azure app exactly, the path is always the callback of the backend
REDIRECT_URI = os.environ.get("AZURE_REDIRECT_URI", "").strip() or f"{APP_URL}/api/auth/sso/callback"

# The tenant in the address makes sure only accounts of this organisation can log in
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
# Asks for the email claim, MSAL adds openid and profile itself
SCOPES = ["email"]


class SsoError(Exception):
    """The login with Microsoft failed, or did not start in this browser."""


# Made on first use, so the backend also starts when Microsoft cannot be reached
@cache
def client() -> msal.ConfidentialClientApplication:
    return msal.ConfidentialClientApplication(CLIENT_ID, client_credential=CLIENT_SECRET, authority=AUTHORITY)


def start_login() -> tuple[str, str]:
    """Returns the address of the Microsoft login page and the flow to keep in a cookie until the callback.

    The flow holds the state, nonce and PKCE verifier that MSAL checks the answer of Microsoft against.
    """
    # The first call fetches the settings of the tenant from Microsoft, which fails when it cannot be reached
    try:
        flow = client().initiate_auth_code_flow(SCOPES, redirect_uri=REDIRECT_URI)
    except (ValueError, requests.RequestException) as exception:
        raise SsoError from exception
    auth_uri = flow.pop("auth_uri")
    # Signed, so the browser cannot change the flow it hands back
    return auth_uri, jwt.encode(flow, JWT_SECRET, algorithm=JWT_ALGORITHM)


def finish_login(flow_cookie: str | None, query: dict[str, str]) -> dict:
    """Trades the code from Microsoft for an ID token and returns its claims, such as name and email."""
    try:
        flow = jwt.decode(flow_cookie or "", JWT_SECRET, algorithms=[JWT_ALGORITHM])
        result = client().acquire_token_by_auth_code_flow(flow, query)
    except (jwt.InvalidTokenError, ValueError, requests.RequestException) as exception:
        raise SsoError from exception
    if "id_token_claims" not in result:
        raise SsoError(result.get("error_description") or result.get("error"))
    return result["id_token_claims"]
