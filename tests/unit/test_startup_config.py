"""Startup config validation (pre-deploy A4-S3-C / WS4 subset, Decision D2).

``app.config.check_startup_config`` is the single boot-critical config gate
and ``app.main.run_startup_checks`` is the lifespan wrapper that fails the
boot closed on its errors. The contract:

- WARN (never fatal) on a missing AI key, in EVERY env — the
  stub-served-as-real guard (A4-S3-C); an unset key silently falls back to
  the stub provider.
- Fail the boot CLOSED (error → ``RuntimeError`` at startup) on default
  ``change-me`` secrets or wildcard/localhost CORS when ``app_env`` is
  OUTSIDE the dev-set, while the stock ``app_env="development"`` (the
  default) + CI boot clean (the rev-3 regression guard).
"""

from __future__ import annotations

import pytest

from app.config import Settings, check_startup_config
from app.main import run_startup_checks


def _settings(**overrides: str) -> Settings:
    """Build Settings with real secrets + a prod-shaped CORS origin by
    default, so each test opts INTO the single condition it exercises. Init
    kwargs are pydantic-settings' highest priority, so they override any
    ambient env / .env."""
    base: dict[str, str] = {
        "app_env": "development",
        "app_secret_key": "a-real-secret",
        "jwt_secret": "a-real-jwt-secret",
        "cors_allowed_origins": "https://acumen.kbc.example",
        "anthropic_api_key": "sk-ant-real",
        "openai_api_key": "sk-openai-real",
    }
    base.update(overrides)
    return Settings(**base)


# --- AI-key warnings fire in every env, never fatal -------------------


def test_warns_on_missing_anthropic_key() -> None:
    warnings, errors = check_startup_config(_settings(anthropic_api_key=""))
    assert any("ANTHROPIC_API_KEY" in w for w in warnings)
    assert errors == []


def test_warns_on_missing_openai_key() -> None:
    warnings, errors = check_startup_config(_settings(openai_api_key=""))
    assert any("OPENAI_API_KEY" in w for w in warnings)
    assert errors == []


def test_no_ai_warning_when_both_keys_set() -> None:
    warnings, _ = check_startup_config(_settings())
    assert warnings == []


def test_missing_ai_key_is_warn_not_error_even_in_production() -> None:
    # A missing AI key is a WARN even in prod — it is not boot-fatal (the
    # stub still answers); only secrets/CORS fail the boot closed.
    warnings, errors = check_startup_config(
        _settings(app_env="production", anthropic_api_key="")
    )
    assert any("ANTHROPIC_API_KEY" in w for w in warnings)
    assert errors == []
    run_startup_checks(_settings(app_env="production", anthropic_api_key=""))


# --- dev-set boots clean on stock secrets (rev-3 regression guard) ----


def test_development_default_boots_clean_on_stock_secrets() -> None:
    stock = _settings(
        app_env="development",
        app_secret_key="change-me",
        jwt_secret="change-me",
        cors_allowed_origins="http://localhost:3000",
        anthropic_api_key="",
        openai_api_key="",
    )
    _, errors = check_startup_config(stock)
    assert errors == []  # stock dev + CI boot clean
    run_startup_checks(stock)  # the lifespan path must NOT raise in dev


@pytest.mark.parametrize("env", ["development", "dev", "local", "test"])
def test_every_dev_set_env_boots_clean_on_defaults(env: str) -> None:
    _, errors = check_startup_config(
        _settings(
            app_env=env,
            app_secret_key="change-me",
            jwt_secret="change-me",
            cors_allowed_origins="http://localhost:3000",
        )
    )
    assert errors == []


# --- non-dev env fails closed -----------------------------------------


def test_production_raises_on_default_app_secret() -> None:
    bad = _settings(app_env="production", app_secret_key="change-me")
    _, errors = check_startup_config(bad)
    assert any("APP_SECRET_KEY" in e for e in errors)
    with pytest.raises(RuntimeError):
        run_startup_checks(bad)


def test_production_errors_on_default_jwt_secret() -> None:
    _, errors = check_startup_config(
        _settings(app_env="production", jwt_secret="change-me")
    )
    assert any("JWT_SECRET" in e for e in errors)


def test_production_errors_on_wildcard_cors() -> None:
    _, errors = check_startup_config(
        _settings(app_env="production", cors_allowed_origins="*")
    )
    assert any("CORS_ALLOWED_ORIGINS" in e for e in errors)


def test_production_errors_on_localhost_cors() -> None:
    _, errors = check_startup_config(
        _settings(app_env="production", cors_allowed_origins="http://localhost:3000")
    )
    assert any("CORS_ALLOWED_ORIGINS" in e for e in errors)


def test_production_errors_on_ipv6_loopback_cors() -> None:
    # IPv6 loopback is still a loopback — must fail closed in prod.
    _, errors = check_startup_config(
        _settings(app_env="production", cors_allowed_origins="http://[::1]:3000")
    )
    assert any("CORS_ALLOWED_ORIGINS" in e for e in errors)


def test_production_clean_on_origin_merely_containing_localhost() -> None:
    # A legitimate public origin that only *contains* a loopback name as a
    # substring (no `://localhost`) must NOT be flagged — the anchored
    # marker match avoids that false positive (Gitar review on #74).
    _, errors = check_startup_config(
        _settings(
            app_env="production",
            cors_allowed_origins="https://notlocalhost.example.com",
        )
    )
    assert errors == []


def test_unknown_env_fails_closed_on_defaults() -> None:
    # "staging" is not in the dev-set → fail-closed on default secrets,
    # proving the gate fails closed rather than open for unrecognised envs.
    bad = _settings(app_env="staging", app_secret_key="change-me")
    _, errors = check_startup_config(bad)
    assert errors != []
    with pytest.raises(RuntimeError):
        run_startup_checks(bad)


def test_production_clean_when_fully_configured() -> None:
    good = _settings(app_env="production")
    warnings, errors = check_startup_config(good)
    assert errors == []
    assert warnings == []
    run_startup_checks(good)  # does not raise
