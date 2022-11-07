# Home Assistant Add-on: SMA Data Manager Bridge

## Prerequisites

This addon will act as a bridge between Home Assistant and your SMA Data Manager M. 
To actually use this add-on, you'll need the following:
- a SMA Data Manager M that is accessible from your local network


## Installation

Follow these setps to get the add-on installed on your system:
1. Add this repository to your Home Assistant by clicking the button in the README in the root of this repo
2. Navigate in your Home Assistant frontend to __Settings -> Add-Ons -> Add-On Store__
3. Find the `SMA Data Manager Bridge` and click it
4. Click on the `INSTALL` button


## How to Use

You can use the bridge to build sensors from the component and channel data.
Example (add to configuration.yaml):

```yaml
# sma data manager config
sensor:
  - platform: rest
    name: sma_data_mgr
    resource: http://<id>-sma-data-manager-bridge-addon:8080/bridge
    method: POST
    headers:
      Content-Type: application/json
    payload: >-
      {
        "host": "<SMA Data Manager hostname>",
        "username": "...",
        "password": "...",
        "query": [
          {
            "component": "SD2P:0172-3014277358",
            "channel": "Measurement.Bat.ChaStt",
            "alias": "Bat_ChargeLevel"
          },
          {
            "component": "SD2P:0172-3014277358",
            "channel": "Measurement.Bat.TmpVal",
            "alias": "Bat_Temperature"
          }
        ]
      }
    value_template: "{{ value_json.bridge_status }}"
    json_attributes:
      - bridge_status
      - Bat_ChargeLevel
      - Bat_Temperature
    scan_interval: 600
  - platform: template
    sensors:
      # SMA Batterie
      sma_bat_chargelevel:
        friendly_name: "Aktueller Batterieladestand"
        value_template: "{{ state_attr('sensor.sma_data_mgr', 'Bat_ChargeLevel') }}"
        unit_of_measurement: "%"
      sma_bat_temperature:
        friendly_name: "Batterietemperatur"
        value_template: "{{ state_attr('sensor.sma_data_mgr', 'Bat_Temperature') }}"
        unit_of_measurement: "°C"
```

> Note: Component and Channel ids are equal to those displayed in the SMA Data Manager Webportal (live data view)

> Note: the 'bridge_status' field contains information about the request status, like errors or warnings

> Note: when receiving a bridge_status of 'invalid request body', you may set the 'debug_requests' option of the add-on to 'TRUE' to see what data is received by the bridge

> Note: The bridge endpoint is rate limited to one request every 60 seconds to reduce load on the data manager. this limit may be changed using the 'cooldown' option of the add-on
