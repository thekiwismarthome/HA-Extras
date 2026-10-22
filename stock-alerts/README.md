# Stock Threshold Alerts

Add "**alert me when `<TICKER>` goes above/below `<PRICE>`**" rules straight from
a Lovelace card using dropdowns — add and remove them whenever you like, **no
YAML editing at runtime**.

> On the "alert timer card" idea: there isn't a standard card that does stock
> thresholds out of the box. This is a small purpose-built combo that gives you
> exactly that add/remove-from-the-UI experience, using only built-in HA pieces
> (a To-do list helper + input helpers + one automation).

| File | What it is |
|------|------------|
| [`package-stock-alerts.yaml`](package-stock-alerts.yaml) | The whole backend — helpers, add/clear scripts, and the monitoring automation. Drop it in `config/packages/`. |
| [`dashboard-card.yaml`](dashboard-card.yaml) | The Lovelace card (native version + optional Mushroom version). |

## How it works

- Your alerts live in a **native To-do list** (`todo.stock_alerts`). Each item is
  one rule, e.g. `AAPL below 150.00`.
- The **dropdown form** on the card feeds `script.stock_alert_add`, which turns
  the three dropdowns into a to-do item.
- **Removing** an alert = deleting its to-do item on the card. **Pausing** one =
  ticking it off (the automation skips completed items).
- One **automation** runs every minute, compares each active rule against the
  live price, and notifies you when the threshold is crossed.
- A **per-alert cooldown** (stored in each item's description) stops it spamming
  you, and it **re-arms automatically** once the price moves back the other way.

## Setup (one time)

1. **Create the To-do list**
   Settings → Devices & Services → Helpers → **+ Create Helper → To-do list**,
   name it **Stock Alerts** so it becomes `todo.stock_alerts`.

2. **Enable packages** in `configuration.yaml` (skip if you already do this):
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
   Then copy `package-stock-alerts.yaml` to `config/packages/stock_alerts.yaml`.

3. **Edit the two CONFIG blocks** in the package:
   - `ticker_map` — map each ticker to the sensor that holds its live price.
     Works with any source (yahoofinance, Alpha Vantage, a REST sensor, crypto…).
     Keep the keys in sync with the `input_select.stock_alert_ticker` options.
   - `notify_target` — defaults to `notify.mobile_app_brents_phone`. Change it
     if you notify somewhere else.
   - Optional: `cooldown_seconds` (default `3600` = at most once an hour while a
     rule stays true).

4. **Restart** (or Developer Tools → YAML → reload Scripts / Automations /
   Input helpers).

5. **Add the card** — Edit dashboard → **+ Add card → Manual**, paste the native
   version from `dashboard-card.yaml`.

## Using it

- Pick a **Ticker**, choose **above/below**, type a **threshold**, tap **Add alert**.
- The new rule appears in **Active stock alerts**.
- Delete a rule to stop it; tick it off to pause it.
- When a price crosses a threshold you get a phone notification (and a
  persistent notification in HA).

## Adding a new stock later

1. Add the ticker to the `input_select.stock_alert_ticker` options
   (Settings → Helpers → *Stock alert ticker* → edit — no restart needed).
2. Add the matching `ticker -> sensor` line to `ticker_map` in the automation
   and reload automations.

## Notes / tweaks

- **Check frequency:** the automation triggers on `time_pattern: minutes: "/1"`.
  Change to `"/5"` if once a minute is more than you need — most stock
  integrations only refresh every few minutes anyway.
- **No custom cards needed** for the native version. The Mushroom version in
  `dashboard-card.yaml` is optional eye-candy (needs Mushroom from HACS).
- **Percent / other conditions:** the model is deliberately simple (`above` /
  `below` a fixed price). You could extend the summary format and the parser in
  the automation to support `% change` or trailing stops later.
