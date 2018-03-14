# The Things Network collaborative sensor maps

![TTN Sensor Maps](public/screenshot.png)

Data gets a lot more exciting when you can visualize it. This project makes it easy to plot sensor data from LoRaWAN nodes connected to The Things Network on a map. Because everyone can add their sensors by just providing an API key, it's very useful for workshops or introductions to LoRaWAN. The maps work on desktop and mobile, and data is automatically synchronized between clients.

## How to run

1. Install Node.js.
1. Clone this repository:

    ```
    $ git clone https://github.com/janjongboom/ttn-sensor-maps
    ```

1. Install dependencies:

    ```
    $ npm install
    ```

1. Run the server:

    ```
    $ node server.js
    ```

1. Navigate to http://localhost:7270.

There is also a Dockerfile in this project if that's more your thing.

**Google Maps API Key**

Before deploying this application, you'll need your own Maps API key. Go to [this web page](https://developers.google.com/maps/documentation/javascript/get-api-key) and obtain one. Then open `server.js` and enter the API key in the `config` object.

## Adding data to the map

1. Go to your application in the The Things Network console and note down your application ID.
1. At the bottom of this page there is an 'application key'. Also note it down.
1. Switch back to the application and enter your application ID in the textbox in the right top corner.
1. When prompted enter your application key.
1. Data will now automatically show up on the map.

You can add many applications this way, which is great for workshops.

To remove an application again, look in `db.json` and remove the entry from there.

## Configuration

To configure what data is shown open `server.js`. In here you have the `config` object. This is where you specify what graphs need to be drawn and how the data needs to be mapped.

Objects are automatically placed close to the center of the map, and can be dragged to their actual location. To change the zoom level, look in `public/maps.js`. If a device has GPS you can override this behavior and use the actual coordinates by setting the `lat` and `lng` properties of a device in `server.js`. Make sure to emit a `location-change` event after so all clients can see the new location.

The graphs can be configured in the `config` object in `public/maps.js`. E.g. to allow for more graphs to be displayed you can disable the ticks on the x-axes and then lower the height of the map canvas. This project uses [Chart.js](http://www.chartjs.org/).

## Authors and license

This project was funded by Arm Mbed, The Things Network and Multi-Tech and originally created for SXSW 2018. It's maintained by Jan Jongboom and Johan Stokking.

This project is licensed under the Apache 2.0 license, and thus can be used freely.
