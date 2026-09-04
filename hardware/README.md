# ⚡ Zervox Hardware Circuit-Breaker (RISC-V / ESP32-C3)

This module provides physical dual-key cryptographic authorization for destructive actions (such as node cordoning and eviction).

## Architecture
- **Microcontroller**: ESP32-C3 (32-bit RISC-V single-core processor)
- **Security Interface**: Physical GPIO 4 toggle key & UART serial communication
- **Role**: Hardware Air-Gap Barrier preventing rogue automated AI/SRE agents from taking destructive cluster-level actions without physical keyholder authorization.

## How to Flash
1. Install `esptool.py` or the Arduino IDE with ESP32 board support.
2. Connect your ESP32-C3 dev board via USB-C.
3. Wire a physical toggle switch between `GPIO 4` and `GND`.
4. Compile and flash `hardware/firmware/main.c`.
5. Pass `/dev/ttyUSB0` into `zervox-core` via `ZERVOX_SERIAL_PORT=/dev/ttyUSB0`.
