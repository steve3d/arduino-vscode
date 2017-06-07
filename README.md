# Arduino Support for Visual Studio Code

The Arduino extension makes it easy to build and upload Arduino sketch from Visual Studio Code.

* C++ intellisense with cpptools
* Build/Compile sketch with VSCode
* Upload sketch
* Custom uploader support

## Features

Integrate the Arduino IDE for VSCode, with this extension, you can edit sketch with intellisense and use the VSCode to compile and upload to your board.

## Requirements

* Recent version of Arduino IDE (at least v1.8.x)
* ms-vscode.cpptools extension for C++ intellisense to work
* An Arduino compatiable board to develop. :)
* Manually associate the .ino file to C++ if needed.

## Extension Settings

This extension contributes the following settings:

* `arduino.idePath`: Specify where the Arduino IDE is (Note: Absolute path only).
* `arduino.libraryPath`: Specifies the serial port board are connected (Note: Absolute path only).
* `arduino.fqbn`: Specifies the board type to use (fully qualified board name).
* `arduino.serialPort`: Specifies the serial port borad are connected. (Windows: COMx, macOS: /dev/cu./dev/cu.usbmodemxxxx, Linux: /dev/ttyUSBxx)
* `arduino.warnPercentage`: set to `blah` to do something
* `arduino.compileOptions`: Additional options for compile the sketch
* `arduino.uploader`: Custom uploader for extra board types
* `arduino.uploadOptions`: Additional options for avrdude upload the compiled sketch
* `arduino.partno`: Specify AVR device (Upload only)
* `arduino.programmer`: Specify programmer type (Upload only)
* `arduino.baudrate`: Override RS-232 baud rate (Upload only)
* `arduino.verbose`: Use verbose output when build and upload.

Please note, every path here should be absolute path, relative path won't work.

## Custom uploader support

If you need to develop on a custom board like NodeMCU, you need to specify the uploader `esptool` to `arduino.uploader` option.
Once you set the uploader, the extension will use the `arduino.uploadOptions` with this uploader. And there are some replacement arguments for the `uploadOptions`:

- `$BAUDRATE` will be replaced to the baudrate option
- `$SERIALPORT` will be replaced to the serial port option
- `$TARGET` will be replaced to the compiled object, (Note, this option contains no `bin` or `hex` extension).

For example:

```
"arduino.fqbn": "esp8266:esp8266:nodemcu:CpuFrequency=80,UploadSpeed=115200,FlashSize=4M3M",
"arduino.uploader" : "/Users/steve/Library/Arduino15/packages/esp8266/tools/esptool/0.4.9/esptool",
"arduino.uploadOptions": "-vv -cd ck -cb $BAUDRATE -cp $SERIALPORT -ca 0x00000 -cf $TARGET.bin",
"arduino.compileOptions": "-hardware /Users/steve/Library/Arduino15/packages -tools /Users/steve/Library/Arduino15/packages -prefs=runtime.tools.esptool.path=/Users/steve/Library/Arduino15/packages/esp8266/tools/esptool/0.4.9 -prefs=runtime.tools.xtensa-lx106-elf-gcc.path=/Users/steve/Library/Arduino15/packages/esp8266/tools/xtensa-lx106-elf-gcc/1.20.0-26-gb404fb9-2 -prefs=runtime.tools.mkspiffs.path=/Users/steve/Library/Arduino15/packages/esp8266/tools/mkspiffs/0.1.2"
```

You can get these options by enabling verbose output when you compile/upload in Arduino IDE.

## Known Issues

Linux support not tested, but it should work.
Custom uploader not tested, because I don't have a board that requires or implements a custom uploader to test.

## Change log

Please see [CHANGELOG](CHANGELOG.md) for more information on what has changed recently.

-----------------------------------------------------------------------------------------------------------

**Enjoy!**
