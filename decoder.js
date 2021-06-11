/**
 * Copied from https://github.com/RogerHardiman/node-ptz-decoder, licensed under MIT
 */

const { EventEmitter } = require('events')

class ViscaDecoder extends EventEmitter {
    constructor () {
        super()
        this.visca_command_buffer = new Buffer(128)
        this.visca_command_index = 0
    }
    
    // new_data_buffer can be a NodeJS Buffer or a Javascript array
    // as the only methods called are .length and the array index '[]' operator
    processBuffer(new_data_buffer) {
        for (var i = 0; i < new_data_buffer.length; i++) {
            // Get the next new byte
            var new_byte = new_data_buffer[i];

            // Collect VISCA data
            // Starts with MSBit = 1
            // Ends with 0xFF
            if ((new_byte & 0x80) && (new_byte != 0xFF)) {
                // MSB is set to 1. This marks the start of a the command so reset buffer counter
                this.visca_command_buffer[0] = new_byte;
                this.visca_command_index = 1;
            } else if (this.visca_command_index < this.visca_command_buffer.length) {
                // Add the new_byte to the end of the command_buffer
                this.visca_command_buffer[this.visca_command_index] = new_byte;
                this.visca_command_index++;
            }

            // Check for valid command
            if ((this.visca_command_index >= 3) // at least 3 bytes
                && (this.visca_command_buffer[0] & 0x80) // first byte has MSB set to 1
                && (this.visca_command_buffer[this.visca_command_index - 1] == 0xFF) // last byte is 0xFF
            ) {
                // Looks like a VISCA command. Process it
                this.decode_visca(this.visca_command_buffer, this.visca_command_index);
                this.visca_command_index = 0;
            }
        }
    }

    decode_visca(buffer, length) {

        var msg_string = "";

        msg_string += "VISCA ";

        // Get Sender and Receiver (or Broadcast) address details
        var sender_id = (buffer[0] >> 4) & 0x07;
        var broadcast_bit = (buffer[0] >> 3) & 0x01;
        var receiver_id = (buffer[0]) & 0x07;

        if (buffer[0] == 0x88) msg_string += 'From ' + sender_id + ' To All ';
        else if (broadcast_bit == 0) msg_string += 'From ' + sender_id + ' To ' + receiver_id + ' ';
        else {
            // does not look like a VISCA command. broatcast bit is '1' but byte is not 0x88
            return;
        }

        // buffer[1] is 0x01 for Command messages
        //              0x09 for Inquiry messages
        //              0x2x for Cancel messages
        //              0x30 for Broadcast messages
        //              0x4x for reply ACK messages
        //              0x5x for reply Completion Command messages
        //              0x6x for reply Error messages
        var process = false;
        if (buffer[1] == 0x01) process = true;
        if (buffer[1] == 0x09) process = true;
        if ((buffer[1] & 0xF0) == 0x20) process = true;
        if (buffer[1] == 0x30) process = true;
        if ((buffer[1] & 0xF0) == 0x40) process = true;
        if ((buffer[1] & 0xF0) == 0x50) process = true;
        if ((buffer[1] & 0xF0) == 0x60) process = true;

        if (process == false) return;


        if (length == 9 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x01) {
            // Pan/Tilt command
            let panOperation = 'stop'
            const panDirection = buffer[6];
            const panSpeed = buffer[4];

            let tiltOperation = 'stop'
            const tiltDirection = buffer[7];
            const tiltSpeed = buffer[5];

            if (panDirection == 0x01) panOperation = 'left' // msg_string += '[Pan Left(' + pan_speed + ')]';
            else if (panDirection == 0x02) panOperation = 'right' // msg_string += '[Pan Right(' + pan_speed + ')]';
            else if (panDirection == 0x03) panOperation = 'stop' // msg_string += '[Pan Stop]';
            // else msg_string += '[Pan ????]';

            if (tiltDirection == 0x01) tiltOperation = 'up' // msg_string += '[Tilt Up(' + tilt_speed + ')]';
            else if (tiltDirection == 0x02) tiltOperation = 'down' // msg_string += '[Tilt Down(' + tilt_speed + ')]';
            else if (tiltDirection == 0x03) tiltOperation = 'stop' // msg_string += '[Tilt Stop]';
            // else msg_string += '[Tilt ????]';

            this.emit('panTiltOp', {
                panOperation,
                panSpeed,
                tiltOperation,
                tiltSpeed,
            })
        // } else if (length == 15 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x02) {
        //     // Pan/Tilt command (15 byte version. There is a 16 byte version too)
        //     var pan_speed = buffer[4];
        //     var tilt_speed = buffer[5];
        //     var pan_pos = (((buffer[6] & 0x0F) << 24)
        //         + ((buffer[7] & 0x0F) << 16)
        //         + ((buffer[8] & 0x0F) << 8)
        //         + ((buffer[9] & 0x0F) << 0));
        //     var tilt_pos = (((buffer[10] & 0x0F) << 24)
        //         + ((buffer[11] & 0x0F) << 16)
        //         + ((buffer[12] & 0x0F) << 8)
        //         + ((buffer[13] & 0x0F) << 0));

        //     msg_string += 'Absolute Move. PanSpeed=' + pan_speed + ' TiltSpeed=' + tilt_speed + ' PanPos=' + pan_pos + ' TiltPos=' + tilt_pos;
        // } else if (length == 5 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x04) {
        //     msg_string += 'Home';
        // } else if (length == 6 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x06 && buffer[4] == 0x02) {
        //     msg_string += 'OSD Menu on';
        // } else if (length == 6 && buffer[1] == 0x01 && buffer[2] == 0x06 && buffer[3] == 0x06 && buffer[4] == 0x03) {
        //     msg_string += 'OSD Menu off';
        } else if (length == 6 && buffer[1] == 0x01 && buffer[2] == 0x04) {
            var b3 = buffer[3];
            var b4 = buffer[4];

            if (b3 === 0x07) { // zoom
                const op = {}

                if (b4 == 0x00) {
                    op.operation = 'stop'
                } else if (b4 === 0x02 || (b4 & 0xF0) == 0x20) {
                    op.operation = 'in'
                } else if (b4 === 0x03 || (b4 & 0xF0) == 0x30) {
                    op.operation = 'out'
                }

                if ((b4 & 0xF0) == 0x20) {
                    op.speed = b4 & 0x0F
                } else if ((b4 & 0xF0) == 0x30) {
                    op.speed = b4 & 0x0F
                }

                this.emit('zoomOp', op)
            } else if (b3 === 0x08) { // focus
                const op = {}

                if (b4 == 0x00) {
                    op.operation = 'stop'
                } else if (b4 === 0x02 || (b4 & 0xF0) == 0x20) {
                    op.operation = 'far'
                } else if (b4 === 0x03 || (b4 & 0xF0) == 0x30) {
                    op.operation = 'near'
                }

                if ((b4 & 0xF0) == 0x20) {
                    op.speed = b4 & 0x0F
                } else if ((b4 & 0xF0) == 0x30) {
                    op.speed = b4 & 0x0F
                }

                this.emit('focusOp', op)
            }
            // // Power
            // if (b3 == 0x00 && b4 == 0x02) msg_string += 'Power On';
            // else if (b3 == 0x00 && b4 == 0x03) msg_string += 'Power Off';
            // // Zoom
            // else if (b3 == 0x07 && b4 == 0x00) msg_string += '[Zoom Stop]';
            // else if (b3 == 0x07 && b4 == 0x02) msg_string += '[Zoom In]';
            // else if (b3 == 0x07 && b4 == 0x03) msg_string += '[Zoom Out]';
            // else if (b3 == 0x07 && ((b4 & 0xF0) == 0x20)) msg_string += '[Zoom In(' + (b4 & 0x0F) + ')]';
            // else if (b3 == 0x07 && ((b4 & 0xF0) == 0x30)) msg_string += '[Zoom Out(' + (b4 & 0x0F) + ')]';
            // // Focus
            // else if (b3 == 0x08 && b4 == 0x00) msg_string += '[Focus Stop]';
            // else if (b3 == 0x08 && b4 == 0x02) msg_string += '[Focus Far]';
            // else if (b3 == 0x08 && b4 == 0x03) msg_string += '[Focus Near]';
            // else if (b3 == 0x08 && ((b4 & 0xF0) == 0x20)) msg_string += '[Focus Far(' + (b4 & 0x0F) + ')]';
            // else if (b3 == 0x08 && ((b4 & 0xF0) == 0x30)) msg_string += '[Focus Near(' + (b4 & 0x0F) + ')]';
            // else if (b3 == 0x38 && b4 == 0x02) msg_string += '[Auto Focus]';
            // else if (b3 == 0x38 && b4 == 0x03) msg_string += '[Manual Focus]';
            // else if (b3 == 0x38 && b4 == 0x10) msg_string += '[Auto/Manual Focus]';
            // else if (b3 == 0x18 && b4 == 0x01) msg_string += '[One Push Trigger Focus]';
            // else if (b3 == 0x18 && b4 == 0x02) msg_string += '[Infinity Focus]';
            // // Automatic Exposure (AE)
            // else if (b3 == 0x39 && b4 == 0x00) msg_string += '[Full Auto Exposure]';
            // else if (b3 == 0x39 && b4 == 0x03) msg_string += '[Manual Exposire]';
            // else if (b3 == 0x39 && b4 == 0x0A) msg_string += '[Shutter Prioirty Exposure]';
            // else if (b3 == 0x39 && b4 == 0x0B) msg_string += '[Iris Priority Exposure]';
            // else if (b3 == 0x39 && b4 == 0x0D) msg_string += '[Bright Exposure]';
            // // Iris
            // else if (b3 == 0x0B && b4 == 0x00) msg_string += '[Iris Reset]';
            // else if (b3 == 0x0B && b4 == 0x02) msg_string += '[Iris Up]';
            // else if (b3 == 0x0B && b4 == 0x03) msg_string += '[Iris Down]';
            // else msg_string += 'Other VISCA command';
        }
        // } else if (length == 7 && buffer[1] == 0x01 && buffer[2] == 0x04) {
        //     var b3 = buffer[3];
        //     var b4 = buffer[4];
        //     var b5 = buffer[5]; // range starts at zero
        //     if (b3 == 0x3f && b4 == 0x00) msg_string += '[Reset Preset ' + (b5) + ']';
        //     else if (b3 == 0x3f && b4 == 0x01) msg_string += '[Set Preset ' + (b5) + ']';
        //     else if (b3 == 0x3f && b4 == 0x02) msg_string += '[Goto Preset ' + (b5) + ']';
        //     else msg_string += 'Other VISCA command';
        // } else if (length == 9 && buffer[1] == 0x01 && buffer[2] == 0x04) {
        //     var b3 = buffer[3];
        //     var time = (((buffer[4] & 0x0F) << 24)
        //         + ((buffer[5] & 0x0F) << 16)
        //         + ((buffer[6] & 0x0F) << 8)
        //         + ((buffer[7] & 0x0F) << 0));
        //     if (b3 == 0x40) msg_string += 'Auto PowerOff ' + time + ' seconds'; //D100
        //     else msg_string += 'Other VISCA command';
        // } else if (length == 4 && buffer[1] == 0x30 && buffer[2] == 0x01) {
        //     msg_string += 'Address Set Command';
        // } else if (length == 5 && buffer[1] == 0x01 && buffer[2] == 0x00 && buffer[3] == 0x01) {
        //     msg_string += 'IF_Clear Command';
        // } else {
        //     msg_string += 'Other VISCA command';
        // }

        this.emit("log", msg_string);

        return;
    }
}

module.exports = { ViscaDecoder }
