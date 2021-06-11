const { createSocket } = require('dgram')
const { ViscaDecoder } = require('./decoder')
const { PanasonicController } = require('./encoder')

const decoder = new ViscaDecoder()
decoder.on('log', (msg) => console.log(msg))

console.log('host', process.argv[2], 'port', process.argv[3] || 52381)

const encoder = new PanasonicController(process.argv[2])

decoder.on('panTiltOp', controls => {
    let {
        panOperation,
        panSpeed,
        tiltOperation,
        tiltSpeed,
    } = controls

    let pan = 50
    let tilt = 50

    // convert speed from 23...0 to 0...49
    const convert = (speed) => (speed / 23 - 1) * -1 * 49

    panSpeed = convert(panSpeed)
    tiltSpeed = convert(tiltSpeed)

    const panModifier = panOperation === 'left' ? -1 : panOperation === 'right' ? 1 : 0
    const tiltModifier = tiltOperation === 'up' ? -1 : tiltOperation === 'down' ? 1 : 0

    pan += panModifier * panSpeed
    tilt += tiltModifier * tiltSpeed

    encoder.setPanTilt(pan, tilt)
})
decoder.on('zoomOp', controls => {
    const { operation, speed } = controls
    const modifier = operation === 'in' ? 1 : operation === 'out' ? -1 : 0
    const zoom = 50 + modifier * 49 * (speed || 0.5)
    console.log(operation, speed, modifier, zoom)
    encoder.setZoom(zoom)
})
decoder.on('focusOp', controls => {
    const { operation, speed } = controls
    const modifier = operation === 'far' ? 1 : operation === 'near' ? -1 : 0
    const focus = 50 + modifier * 49 * (speed || 0.5)
    console.log(operation, speed, modifier, focus)
    encoder.setFocus(focus)
})

const receiveSocket = createSocket('udp4', (msg) => {
    console.log(msg)
    decoder.processBuffer(msg)
})
receiveSocket.bind(process.argv[3] || 52381)
