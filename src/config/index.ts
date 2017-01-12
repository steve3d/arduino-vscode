'use strict';

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';


export class ConfigUtil {
    private _convertSeprator = false;

    private get config(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('arduino');
    }

    get idePath(): string {
        let p = this.config.get<string>('idePath');

        if(p == null)
            return null;

        switch(os.type()) {
            case 'Windows_NT':
                if(fs.existsSync(path.join(p, 'arduino-builder.exe')))
                    return p;
            case 'Linux':
                return null;
            case 'Darwin':
                if(fs.existsSync(path.join(p, 'Contents/Java/arduino-builder')))
                    return path.join(p, 'Contents/Java');
        }

        return null;
    }

    get libraryPath(): string {
        return this.config.get<string>('libraryPath');
    }

    get serialPort(): string {
        return this.config.get<string>('serialPort', null);
    }

    get fqbn(): string {
        return this.config.get<string>('fqbn', 'arduino:avr:uno');
    }

    get warnPercentage(): number {
        return this.config.get<number>('warnPercentage', 75);
    }

    get partno(): string {
        return this.config.get<string>('partno', 'atmega328p');
    }

    get programmer(): string {
        return this.config.get<string>('programmer', 'arduino');
    }

    get baudrate(): number{
        return this.config.get<number>('baudrate', 115200);
    }
    get convertSeperator(): boolean {
        return os.type() == 'Windows_NT';
    }

    get compileOptions(): string[] {
        let o = this.config.get<string>('compileOptions', '-ide-version=10800').split(' ');

        return o.filter(x => x != '');
    }
    get uploadOptions(): string[] {
        console.log(this.config.get<string>('uploadOptions'))
        let o = this.config.get<string>('uploadOptions', '-D').split(' ');

        return o.filter(x => x != '');
    }

    constructor() {
        if(os.type() == 'Windows_NT')
            this._convertSeprator = true;
    }

    hasSettings(): boolean {
        return this.idePath != null && this.libraryPath != null && this.serialPort != null;
    }

    get basename(): string {
        return path.basename(vscode.window.activeTextEditor.document.fileName, '.ino')
    }

    get filename(): string {
        return path.basename(vscode.window.activeTextEditor.document.fileName);
    }

    get hexPath(): string {
        return path.join(vscode.workspace.rootPath, `tmp/${this.basename}/${this.filename}.hex`);
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
            path.join(this.idePath, 'hardware/arduino/avr/cores/arduino'),
            path.join(this.idePath, 'hardware/arduino/avr/libraries'),
            path.join(this.idePath, 'hardware/arduino/avr/variants/standard'),
            path.join(this.idePath, 'libraries')
        ];

        if(this.libraryPath)
            includes.push(this.libraryPath);

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
        let args = ['-compile',
            '-logger', 'machine',
            '-hardware', `${this.idePath}/hardware`,
            '-tools', `${this.idePath}/tools-builder`,
            '-tools', `${this.idePath}/hardware/tools/avr`,
            '-built-in-libraries', `${this.idePath}/libraries`,
            '-libraries', `${this.libraryPath}`,
            `-fqbn=${this.fqbn}`,
            '-build-path', this.tempPath,
            '-warnings=none',
            `-prefs=build.warn_data_percentage=${this.warnPercentage}`,
            `-prefs=runtime.tools.avr-gcc.path=${this.idePath}/hardware/tools/avr`,
            `-prefs=runtime.tools.avrdude.path=${this.idePath}/hardware/tools/avr`,
            `-prefs=runtime.tools.arduinoOTA.path=${this.idePath}/hardware/tools/avr`,
            vscode.window.activeTextEditor.document.fileName
        ].concat(this.compileOptions);

        return this._convertSeprator ? args.map(x => x.replace(/\//g, '\\')) : args;
    }

    get uploadArgs(): string[] {
        let args = [`-C${this.idePath}/hardware/tools/avr/etc/avrdude.conf`,
            `-p${this.partno}`,
            `-c${this.programmer}`,
            `-P${this.serialPort}`,
            `-b${this.baudrate}`,
            `-Uflash:w:${this.hexPath}:i`
        ].concat(this.uploadOptions);

        return this._convertSeprator ? args.map(x => x.replace(/\//g, '\\')) : args;
    }

    get builder(): string {
        let builder = path.join(this.idePath, 'arduino-builder');

        if(this._convertSeprator)
            builder = builder.replace(/\//g, '\\') + '.exe';

        return builder;
    }

    get avrdude(): string {
        let avrdude = path.join(this.idePath, 'hardware/tools/avr/bin/avrdude');

        if(this._convertSeprator)
            avrdude = avrdude.replace(/\\/g, '\\') + '.exe';

        return avrdude;
    }
}