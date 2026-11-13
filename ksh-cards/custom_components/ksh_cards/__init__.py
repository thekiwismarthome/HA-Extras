"""KSH Cards (Kiwi Smart Home).

Serves the KSH Lovelace cards from this integration and loads them on every
dashboard, so there are no Lovelace resources to add or keep up to date.
Removing the integration stops the cards loading.
"""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import CARD_FILES, DOMAIN, URL_BASE, VERSION

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


def _urls() -> list[str]:
    return [f"{URL_BASE}/{name}?v={VERSION}" for name in CARD_FILES]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the integration (nothing to do before a config entry exists)."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Serve the card files and load them on every dashboard."""
    data = hass.data.setdefault(DOMAIN, {})
    # A static path can only be registered once per Home Assistant run.
    if not data.get("static_registered"):
        www = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(URL_BASE, str(www), cache_headers=True)]
        )
        data["static_registered"] = True

    for url in _urls():
        add_extra_js_url(hass, url)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Stop loading the cards (takes effect on the next page load)."""
    for url in _urls():
        remove_extra_js_url(hass, url)
    return True
