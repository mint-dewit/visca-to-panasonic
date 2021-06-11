const axios = require('axios')

class PanasonicController {
    constructor (ip) {
        this.ip = ip
        axios.defaults.baseURL = `http://${this.ip}/cgi-bin/aw_ptz`
    }

    toValidPanTiltVal (val) {
        return ('00' + Math.max(Math.min(Math.abs(Math.round(val)), 99), 1)).substr(-2)
    }

    setPanTilt (p, t) {
        console.log(`#PTS${this.toValidPanTiltVal(p)}${this.toValidPanTiltVal(t)}`)
        axios.get('', {
            params: {
                cmd: `#PTS${this.toValidPanTiltVal(p)}${this.toValidPanTiltVal(t)}`,
                res: 1
            }
        })
    }
    setZoom (z) {
        console.log(`#Z${this.toValidPanTiltVal(z)}`)
        axios.get('', {
            params: {
                cmd: `#Z${this.toValidPanTiltVal(z)}`,
                res: 1
            }
        })
    }
    setFocus (f) {
        console.log(`#F${this.toValidPanTiltVal(f)}`)
        axios.get('', {
            params: {
                cmd: `#F${this.toValidPanTiltVal(f)}`,
                res: 1
            }
        })
    }
}

module.exports = { PanasonicController }