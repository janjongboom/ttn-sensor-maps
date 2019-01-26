const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const hbs = require('hbs');
const ttn = require('ttn');
const fs = require('fs');
const Path = require('path');

// improved database
const dbFile = Path.join(__dirname, 'db.json');

// Some options for express (node.js web app library)
hbs.registerPartials(__dirname + '/views/partials');
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.engine('html', hbs.__express);

// Store some state about all applications
let applications = {};

// Store some state about all devices
let devices = {};

// Note here what data you're interested in, and how it can be obtained from a payload message
const config = {
    // Replace this with your own key
    mapsApiKey: 'AIzaSyBVHcLKC3ja-ZCsyWQLe0eBB3q28F7V6X0',

    title: 'Temperature monitor',
    dataMapping: {
        temperature: {
            graphTitle: 'Temperature',
            yAxisLabel: 'Temperature (°C)',
            minY: 0, // suggested numbers, if numbers out of this range are received the graph will adjust
            maxY: 50,
            numberOfEvents: 30, // no. of events we send to the client
            data: payload => payload.payload_fields.temperature_1
        },
        // want more properties? just add more objects here
    },
    mapCenter: {
        lat: 30.2672,
        lng: -97.7341
    }
};

const dataMapping = config.dataMapping;
const mapCenter = config.mapCenter;

if (fs.existsSync(dbFile)) {
    console.time('LoadingDB');
    let db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    devices = db.devices;
    for (appId in db.applications) {
        if (db.applications.hasOwnProperty(appId)) {
            connectApplication(appId, db.applications[appId]).catch(err => console.error(err));
        }
    }
    console.timeEnd('LoadingDB');
}

// And handle requests
app.get('/', function (req, res, next) {
    let d = Object.keys(devices).map(k => {

        let keys = k.split(/\:/g);
        let o = {
            appId: keys[0],
            devId: keys[1],
            eui: devices[k].eui,
            lat: devices[k].lat,
            lng: devices[k].lng,
        };

        for (let mapKey of Object.keys(dataMapping)) {
            devices[k][mapKey] = devices[k][mapKey] || [];

            // grab last X events from the device
            o[mapKey] = devices[k][mapKey].slice(Math.max(devices[k][mapKey].length - (dataMapping[mapKey].numberOfEvents || 30), 1));
        }

        return o;
    })
    // Render index view, with the devices based on mapToView function
    res.render('index', {
        devices: JSON.stringify(d),
        config: JSON.stringify(config),
        title: config.title,
        mapsApiKey: config.mapsApiKey
    });
});

io.on('connection', socket => {
    socket.on('connect-application', (appId, accessKey) => {
        console.log('Connecting to application', appId, accessKey);
        connectApplication(appId, accessKey)
            .then(() => socket.emit('connected', appId))
            .catch(err => socket.emit('connect-failed', JSON.stringify(err)));
    });

    socket.on('location-change', (appId, devId, lat, lng) => {
        let key = appId + ':' + devId;
        if (!devices[key]) {
            console.error('Device not found', appId, devId);
            return;
        }

        console.log('Location changed', appId, devId, lat, lng);

        let d = devices[key];
        d.lat = lat;
        d.lng = lng;

        io.emit('location-change', {
            appId: appId,
            devId: devId,
            eui: d.eui,
            lat: d.lat,
            lng: d.lng
        }, lat, lng);
    });
});

server.listen(process.env.PORT || 7270, process.env.HOST || '0.0.0.0', function () {
    console.log('Web server listening on port %s!', process.env.PORT || 7270);
});

function connectApplication(appId, accessKey) {
    if (applications[appId]) {
        if (!applications[appId].client) {
            throw 'Already connecting to app ' + appId;
        }
        applications[appId].client.close();
        delete applications[appId];
    }

    applications[appId] = {
        accessKey: accessKey
    }

    console.log('[%s] Connecting to TTN', appId);
    return new Promise((resolve, reject) => {

        return ttn.data(appId, accessKey).then(client => {
            applications[appId].client = client;

            client.on('error', (err) => {
                if (err.message === 'Connection refused: Not authorized') {
                    console.error('[%s] Key is not correct', appId);
                    client.close();
                    delete applications[appId];
                }
                reject(err);
            });

            client.on('connect', () => {
                console.log('[%s] Connected over MQTT', appId);
                resolve();
            });

            client.on('uplink', (devId, payload) => {
                // on device side we did /100, so *100 here to normalize
                if (typeof payload.payload_fields.analog_in_1 !== 'undefined') {
                    payload.payload_fields.analog_in_1 *= 100;
                }

                console.log('[%s] Received uplink', appId, devId, payload.payload_fields);

                let key = appId + ':' + devId;
                let d = devices[key] = devices[key] || {};
                d.eui = payload.hardware_serial;

                for (let mapKey of Object.keys(dataMapping)) {
                    d[mapKey] = d[mapKey] || [];
                }

                if (!d.lat) {
                    d.lat = mapCenter.lat + (Math.random() / 10 - 0.05);
                }
                if (!d.lng) {
                    d.lng = mapCenter.lng + (Math.random() / 10 - 0.05);
                }

                for (let mapKey of Object.keys(dataMapping)) {
                    let v;
                    try {
                        v = dataMapping[mapKey].data(payload);
                    }
                    catch (ex) {
                        console.error('dataMapping[' + mapKey + '].data() threw an error', ex);
                        throw ex;
                    }
			console.log(v, typeof v);

                    if (typeof v !== 'undefined') {
                        d[mapKey].push({
                            ts: new Date(payload.metadata.time),
                            value: v
                        });

                        io.emit('value-change', mapKey, {
                            appId: appId,
                            devId: devId,
                            eui: d.eui,
                            lat: d.lat,
                            lng: d.lng
                        }, payload.metadata.time, v);
                    }
                }
            });

            console.log('[%s] Acquired MQTT client, connecting...', appId);
        }).catch(err => {
            console.error('[%s] Could not connect to The Things Network', appId, err);
            delete applications[appId];
            reject(err);
        });
    });
}

function exitHandler(options, err) {
    if (err) {
        console.error('Application exiting...', err);
    }

    let db = {
        devices: devices,
        applications: {}
    }
    for (appId in applications) {
        if (applications.hasOwnProperty(appId)) {
            db.applications[appId] = applications[appId].accessKey;
        }
    }
    fs.writeFileSync(dbFile, JSON.stringify(db), 'utf-8');

    if (options.exit) {
        process.exit();
    }
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
