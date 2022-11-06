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

Use the bridge to build a rest sensor like below.

````yaml
# sma data manager config
sensor:
  - platform: rest
    name: sma_data_mgr
    json_attributes:
      - Measurement_Bat_ChaStt
      - Measurement_Operation_Health
    resource: http://sma-data-manager-bridge-addon:8080/api/live-data?component_ids=[%22Plant:1%22]&unique_channels_only=true
    value_template: "{{ value_json.Measurement_Operation_Health }}"
    scan_interval: 600
  - platform: template
    sensors:
      sma_measurement_bat_chastt:
        friendly_name: "Measurement_Bat_ChaStt"
        value_template: "{{ state_attr('sensor.sma_data_mgr', 'Measurement_Bat_ChaStt') }}"
        unit_of_measurement: "%"
```
