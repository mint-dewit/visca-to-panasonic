This is a very simple utility to convert PTZ and focus commands from the VISCA protocol to the Panasonic PTZ protocol.

Usage:
```
node ./index CAMERA_IP MODE VISCA_PORT
```
Note that MODE is one of udp or tcp and the visca port defaults to 52381

Acknowledgments:
 * VISCA decoder taken from https://github.com/RogerHardiman/node-ptz-decoder
