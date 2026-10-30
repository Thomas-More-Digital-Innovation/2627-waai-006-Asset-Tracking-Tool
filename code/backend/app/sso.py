import json
import os
import urllib.parse
import urllib.request

import jwt

from .security import AUTH_METHOD

TENANT_ID = os.environ.get("AZURE_TENANT_ID", "").strip()
CLIENT_ID = os.environ.get("AZURE_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET", "").strip()
if AUTH_METHOD == "sso" and not (TENANT_ID and CLIENT_ID and CLIENT_SECRET):
    raise RuntimeError("AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are required for SSO")

# The address of the frontend, Microsoft sends the user back to it after logging in
APP_URL = os.environ.get("APP_URL", f"http://localhost:{os.environ.get('FRONTEND_PORT', '5173')}").rstrip("/")
REDIRECT_URI = f"{APP_URL}/api/auth/sso/callback"

# The tenant in the address makes sure only accounts of this organisation can log in
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
SCOPE = "openid profile email"

# Fetches the public keys of Microsoft only when a token has to be checked, and caches them
jwks_client = jwt.PyJWKClient(f"{AUTHORITY}/discovery/v2.0/keys")


def authorization_url(state: str, nonce: str) -> str:
    query = urllib.parse.urlencode(
        {
            "client_id": CLIENT_ID,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "response_mode": "query",
            "scope": SCOPE,
            "state": state,
            "nonce": nonce,
        }
    )
    return f"{AUTHORITY}/oauth2/v2.0/authorize?{query}"


def fetch_id_token_claims(code: str, nonce: str) -> dict:
    """Trades the code from Microsoft for an ID token and returns its checked claims.

    Raises urllib.error.URLError when Microsoft refuses the code and jwt.PyJWTError when the token is not valid.
    """
    data = urllib.parse.urlencode(
        {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "scope": SCOPE,
        }
    ).encode()
    with urllib.request.urlopen(f"{AUTHORITY}/oauth2/v2.0/token", data=data, timeout=10) as response:
        id_token = json.load(response)["id_token"]

    signing_key = jwks_client.get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=CLIENT_ID,
        issuer=f"{AUTHORITY}/v2.0",
    )
    # The nonce ties the token to the login that this browser started
    if claims.get("nonce") != nonce:
        raise jwt.InvalidTokenError("Nonce does not match")
    return claims
 