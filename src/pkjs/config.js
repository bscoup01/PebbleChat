module.exports = [
  { "type": "heading", "defaultValue": "PebbleChat Settings" },
  {
    "type": "section",
    "items": [
      { "type": "heading", "defaultValue": "Units and Format" },
      {
        "type": "radiogroup",
        "messageKey": "CLOCK_FORMAT",
        "label": "Clock",
        "defaultValue": "12",
        "options": [
          { "label": "12 hour", "value": "12" },
          { "label": "24 hour", "value": "24" }
        ]
      },
      {
        "type": "radiogroup",
        "messageKey": "DISTANCE_UNIT",
        "label": "Distance",
        "defaultValue": "mi",
        "options": [
          { "label": "Miles", "value": "mi" },
          { "label": "Kilometers", "value": "km" }
        ]
      },
      {
        "type": "radiogroup",
        "messageKey": "TEMP_UNIT",
        "label": "Temperature",
        "defaultValue": "f",
        "options": [
          { "label": "Fahrenheit", "value": "f" },
          { "label": "Celsius", "value": "c" }
        ]
      }
    ]
  },
  { "type": "submit", "defaultValue": "Save Settings" }
];