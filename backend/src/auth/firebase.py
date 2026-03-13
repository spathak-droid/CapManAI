"""Firebase ID token verification without Admin SDK."""

from typing import Any

import httpx
import jwt as pyjwt
from cachetools import TTLCache
from cryptography.x509 import load_pem_x509_certificate

from src.core.config import settings

GOOGLE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)

_certs_cache: TTLCache[str, dict[str, str]] = TTLCache(
    maxsize=1, ttl=3600
)


def _get_google_certs() -> dict[str, str]:
    """Fetch and cache Google's public certificates."""
    cached = _certs_cache.get("certs")
    if cached is not None:
        return cached
    resp = httpx.get(GOOGLE_CERTS_URL, timeout=10)
    resp.raise_for_status()
    certs: dict[str, str] = resp.json()
    _certs_cache["certs"] = certs
    return certs


def verify_firebase_token(id_token: str) -> dict[str, Any]:
    """Verify a Firebase ID token and return its payload.

    Raises jwt.PyJWTError on any verification failure.
    """
    header = pyjwt.get_unverified_header(id_token)
    kid = header.get("kid")
    if not kid:
        raise pyjwt.InvalidTokenError("Token has no kid header")

    certs = _get_google_certs()
    cert_pem = certs.get(kid)
    if not cert_pem:
        # Refresh certs in case of key rotation
        _certs_cache.pop("certs", None)
        certs = _get_google_certs()
        cert_pem = certs.get(kid)
        if not cert_pem:
            msg = f"Unknown kid: {kid}"
            raise pyjwt.InvalidTokenError(msg)

    # Google returns X.509 certificates; extract the public key for PyJWT
    cert = load_pem_x509_certificate(cert_pem.encode("utf-8"))
    public_key = cert.public_key()

    project_id = settings.FIREBASE_PROJECT_ID
    payload: dict[str, Any] = pyjwt.decode(
        id_token,
        public_key,  # type: ignore[arg-type]
        algorithms=["RS256"],
        audience=project_id,
        issuer=f"https://securetoken.google.com/{project_id}",
    )

    if not payload.get("sub"):
        raise pyjwt.InvalidTokenError("Token missing sub claim")

    return payload
