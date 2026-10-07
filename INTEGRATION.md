# Using the guide inside another app

The guide is a static single-page app. Each product is a complete flow on its own, so a host app can send a customer straight to the right one.

## Deep links

| Link | What it opens |
|---|---|
| `#/term`, `#/health`, `#/motor` | The product's own flow, starting at **cover** |
| `#/<product>/addons` | Choose add-ons, with the cover and premium that result |
| `#/<product>/insurers` | Which insurers clear the bar |
| `#/faq`, `#/faq?open=<question id>` | The FAQ, or one question opened |
| `#/` , `#/need` | The full guide (need, then amount, add-ons, insurers) |

Within a product flow every "next" and "back" stays inside that product. A customer who asks about motor stays in motor.

## Embedded mode

Add `embed=1` (`?embed=1` or `#/motor?embed=1`) to hide the guide's own header and footer. It stays on for the browser session; `embed=0` turns it off. The page is responsive from 320 px up and honours the safe-area insets, so it works in a WebView or an iframe.

## Handing over what you already know

Pass values in the address and the guide starts from them. Each is clamped like typed input, and counts as the customer's own answer (not marked "Suggested").

```
#/health?age=34&spouse=1&kids=2&parents=2&parentAge=63&city=metro&hospital=standard
#/motor?vehicle=car&vehicleValue=900000&vehicleAge=2to3&ncb=35&loans=vehicle
#/term?age=32&gender=female&income=2400000&spouse=1&kids=1&loans=home
```

| Parameter | Values |
|---|---|
| `age` | 18–70 |
| `gender` | `male`, `female`, `other` |
| `smoker` | `1` or `0` |
| `income` | yearly, rupees |
| `monthlySpend`, `savings` | rupees |
| `spouse`, `spouseEarns` | `1` or `0` |
| `kids`, `childAge` | number, youngest child's age |
| `parents`, `parentAge` | `0`, `1`, `2`, and their age |
| `city` | `metro`, `tier2`, `other` |
| `hospital` | `top`, `standard`, `local` |
| `loans` | comma list of `home`, `vehicle`, `other` |
| `vehicle` | `car`, `bike` |
| `vehicleValue`, `vehicleAge`, `ncb` | rupees, `lt6m` `6m1y` `1to2` `2to3` `3to4` `4to5` `5plus`, `0` `20` `25` `35` `45` `50` |
| `ownHealth`, `ownTerm` | cover already held, rupees |

## Events from the guide to the host

Delivered to a React Native WebView (`ReactNativeWebView.postMessage`, as JSON), an iOS WKWebView handler named `kyfr`, or the parent window (to the origin that embedded it, from `document.referrer`).

```json
{ "source": "kyfr-insurance", "type": "step", "route": "health/addons", "product": "health" }
{ "source": "kyfr-insurance", "type": "outcome", "product": "health",
  "lines": [{ "label": "You and your family", "value": "₹30 lakh" }],
  "premium": { "low": 114400, "high": 171800 }, "addons": ["Super top-up"] }
```

Only the product, the step, and the cover and premium shown are sent. Premiums are indicative ranges, not quotes.
