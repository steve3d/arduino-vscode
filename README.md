# Arduino Support for Visual Studio Code

The Arduino extension makes it easy to build and upload Arduino sketch from Visual Studio Code.

* C++ intellisense with cpptools
* Build/Compile sketch with VSCode
* Upload sketch

## Features

Integrate the Arduino IDE for VSCode, with this extension, you can edit sketch with intellisense and use the VSCode to compile and upload to your board.

## Requirements

* Recent version of Arduino IDE (at least v1.8.x)
* ms-vscode.cpptools extension for C++ intellisense to work
* A Arduino compatiable board to develop. :)

## Extension Settings


This extension contributes the following settings:

* `arduino.idePath`: Specify where the Arduino IDE is (Note: Absolute path only).
* `arduino.libraryPath`: Sprcifies the serial port borad are connected (Note: Absolute path only).
* `arduino.fqbn`: Specifies the borad type to use (fully qualified board name).
* `arduino.serialPort`: Specifies the serial port borad are connected. (Windows: COMx, macOS: /dev/cu./dev/cu.usbmodemxxxx, Linux: /dev/ttyUSBxx)
* `arduino.warnPercentage`: set to `blah` to do something
* `arduino.compileOptions`: Additional options for compile the sketch
* `arduino.uploadOptions`: Additional options for avrdude upload the compiled sketch
* `arduino.partno`: Specify AVR device (Upload only)
* `arduino.programmer`: Specify programmer type (Upload only)
* `arduino.baudrate`: Override RS-232 baud rate (Upload only)
* `arduino.verbose`: Use verbose output when build and upload.

## Known Issues

Linux support not tested, but it should work.

## Change log

Please see [CHANGELOG](CHANGELOG.md) for more information on what has changed recently.

-----------------------------------------------------------------------------------------------------------

**Enjoy!**