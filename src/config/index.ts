'use strict';

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';


export class ConfigUtil {

    private _convertSeprator = false;
    private _idePath: string;
    private _libraryPath: string;
    private _serialPort: string;
    private _fqbn: string;
    private _warnPercentage: number;
    private _partno: string;
    private _programmer: string;
    private _baudrate: number;
    private _compileOptions: string[];
    private _uploader: string = null;
    private _uploadOptions: string[];
    private _verbose: boolean;

    constructor() {
        if(os.type() == 'Windows_NT')
            this._convertSeprator = true;
        this._updateSettings();
        vscode.workspace.onDidChangeConfiguration((e) => this._updateSettings());
    }

    private _updateSettings() {
        let config = vscode.workspace.getConfiguration('arduino');
        this._fqbn = config.get<string>('fqbn');
        this._warnPercentage = config.get<number>('warnPercentage');
        this._partno = config.get<string>('partno');
        this._programmer = config.get<string>('programmer');
        this._baudrate = config.get<number>('baudrate');
        this._serialPort = config.get<string>('serialPort');
        this._verbose = config.get<boolean>('verbose');

        this._compileOptions = config.get<string>('compileOptions', '').split(' ').filter(x => x != '');

        this._uploader = config.get<string>('uploader');
        this._uploadOptions = config.get<string>('uploadOptions', '').split(' ').filter(x => x != '');

        this._updateIdePath(config);
        this._updateLibraryPath(config);
    }

    private _updateIdePath(config: vscode.WorkspaceConfiguration) {
        this._idePath = config.get<string>('idePath');

        switch(os.type()) {
            case 'Windows_NT':
                if(this._idePath == null)
                    this._idePath = 'C:\\Program Files (x86)\\Arduino';

                if(!fs.existsSync(path.join(this._idePath, 'arduino-builder.exe')))
                    this._idePath = null
                break;
            case 'Linux':
                if(!fs.existsSync(path.join(this._idePath, 'arduino-builder')))
                    this._idePath = null
                break;
            case 'Darwin':
                if(this._idePath == null)
                    this._idePath = '/Applications/Arduino.app'

                if(fs.existsSync(path.join(this._idePath, 'Contents/Java/arduino-builder')))
                    this._idePath = path.join(this._idePath, 'Contents/Java');
                else
                    this._idePath = null;

                break;
            default:
                this._idePath = null;
        }

        // custom uploader must also exists
        if(this._uploader && !fs.existsSync(this._uploader))
            this._uploader = null;
    }

    private _updateLibraryPath(config: vscode.WorkspaceConfiguration) {
        this._libraryPath = config.get<string>('libraryPath');

        if(this._libraryPath == null) {
            this._libraryPath = path.join(os.homedir(), 'Documents/Arduino/libraries');
            if(!fs.existsSync(this._libraryPath))
                this._libraryPath = os.homedir();
        }
    }

    get hasIdePath(): boolean {
        return this._idePath != null;
    }

    get hasSerialPort(): boolean {
        return this._serialPort != null;
    }

    get basename(): string {
        return path.basename(vscode.window.activeTextEditor.document.fileName, '.ino')
    }

    get filename(): string {
        return path.basename(vscode.window.activeTextEditor.document.fileName);
    }

    get hexPath(): string {
        return path.join(vscode.workspace.rootPath, `tmp/${this.basename}/${this.filename}`);
    }

    get tempPath(): string {
        let document = vscode.window.activeTextEditor.document;

        let tmpPath = path.join(vscode.workspace.rootPath, `tmp`);

        if (!fs.existsSync(tmpPath))
            fs.mkdirSync(tmpPath);

        tmpPath = path.join(tmpPath, this.basename);
        if (!fs.existsSync(tmpPath))
            fs.mkdirSync(tmpPath);

        return tmpPath;
    }

    get cppConfig(): any {
        let includes = [
            path.join(this._idePath, 'hardware/arduino/avr/cores/arduino'),
            path.join(this._idePath, 'hardware/arduino/avr/libraries'),
            path.join(this._idePath, 'hardware/arduino/avr/variants/standard'),
            path.join(this._idePath, 'libraries')
        ];

        if(this._libraryPath)
            includes.push(this._libraryPath);

        if(this._convertSeprator)
            includes = includes.map(x => x.replace(/\//g, '\\'));

        return {
            configurations: [
                {
                    name: 'Arduino',
                    includePath: includes,
                    browse: {
                        'limitSymbolsToIncludedHeaders': true,
                        'databaseFilename': ''
                    }
                }
            ]
        };
    }

    get buildArgs(): string[] {
        let args = [
            '-compile',
            '-logger', this._verbose ? 'human' : 'machine',
            '-hardware', `${this._idePath}/hardware`,
            '-tools', `${this._idePath}/tools-builder`,
            '-tools', `${this._idePath}/hardware/tools/avr`,
            '-built-in-libraries', `${this._idePath}/libraries`,
            '-libraries', `${this._libraryPath}`,
            `-fqbn=${this._fqbn}`,
            '-build-path', this.tempPath,
            '-warnings=none',
            `-prefs=build.warn_data_percentage=${this._warnPercentage}`,
            `-prefs=runtime.tools.avr-gcc.path=${this._idePath}/hardware/tools/avr`,
            `-prefs=runtime.tools.avrdude.path=${this._idePath}/hardware/tools/avr`,
            `-prefs=runtime.tools.arduinoOTA.path=${this._idePath}/hardware/tools/avr`,
        ].concat(this._compileOptions);

        if(this._verbose)
            args.push('-verbose');

        args.push(vscode.window.activeTextEditor.document.fileName);

        return this._convertSeprator ? args.map(x => x.replace(/\//g, '\\')) : args;
    }

    get uploadArgs(): string[] {
        let args: string[];
        if(this._uploader) {
            args = this._uploadOptions
                .map(x => x.replace(/\$(TARGET|BAUDRATE|SERIALPORT)/,
                    (match, p1) => {
                        switch(match) {
                            case '$TARGET':
                                return this.hexPath;
                            case '$BAUDRATE':
                                return this._baudrate.toString();
                            case '$SERIALPORT':
                                return this._serialPort;
                        }

                        return match;
                    } ));
        } else {
            args = [`-C${this._idePath}/hardware/tools/avr/etc/avrdude.conf`,
                `-p${this._partno}`,
                `-c${this._programmer}`,
                `-P${this._serialPort}`,
                `-b${this._baudrate}`,
            ].concat(this._uploadOptions,
                `-Uflash:w:${this.hexPath}.hex:i`);
        }

        return this._convertSeprator ? args.map(x => x.replace(/\//g, '\\')) : args;
    }

    get builder(): string {
        let builder = path.join(this._idePath, 'arduino-builder');

        if(this._convertSeprator)
            builder = builder.replace(/\//g, '\\') + '.exe';

        return builder;
    }

    get avrdude(): string {
        if(this._uploader)
            return this._uploader;

        let avrdude = path.join(this._idePath, 'hardware/tools/avr/bin/avrdude');

        if(this._convertSeprator)
            avrdude = avrdude.replace(/\\/g, '\\') + '.exe';

        return avrdude;
    }

    get verbose(): boolean {
        return this._verbose;
    }
}