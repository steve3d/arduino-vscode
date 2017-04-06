
'use strict';

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
let splitargs = require('splitargs');

export class ConfigUtil {
    private _builder: string;
    private _idePath: string;
    private _sketchName: string;
    private _libraryPath: string;
    private _packagePath: string;
    private _serialPort: string;
    private _fqbn: string;
    private _warnMode: string;
    private _warnPercentage: number;
    private _partno: string;
    private _programmer: string;
    private _baudrate: number;
    private _compileOptions: string[];
    private _uploader: string = null;
    private _uploadOptions: string[];
    private _verbose: boolean;
    private _vconfig: vscode.WorkspaceConfiguration;
    private _osSuffix: string = null;
    private _exeSuffix: string = '';
    private _config: {};
    private _output: vscode.OutputChannel;

    constructor(output: vscode.OutputChannel) {
        this._updateSettings();
        this._output = output;
        vscode.workspace.onDidChangeConfiguration((e) => this._updateSettings());
    }

    private _updateLegacy() {
        let config = this._vconfig;
        this._warnMode = config.get<string>('warnMode');
        this._warnPercentage = config.get<number>('warnPercentage');
        this._partno = config.get<string>('partno');
        this._programmer = config.get<string>('programmer');
        this._baudrate = config.get<number>('baudrate');
        this._uploader = config.get<string>('uploader');
        this._serialPort = config.get<string>('serialPort');
        this._verbose = config.get<boolean>('verbose');
        this._sketchName = config.get<string>('sketch')
    }

    private _updateSettings() {
        this._vconfig = vscode.workspace.getConfiguration('arduino');
        this._config = {};
        this._fqbn = this._vconfig.has('fqbn') ? this._vconfig.get<string>('fqbn') : 'arduino:avr:uno';
        this._updateLegacy();
        this._config['upload.verbose'] = this._vconfig.get<boolean>('verbose') ? '-verbose' : '';
        this._config['serial.port'] = this._vconfig.get<string>('serialPort');
        this._updateOSDefaults();
        this._updateIdePath();
        this._updateLibraryPath();
        this._updatePackagePath();
        this._updateFromBuilder();
        this._config['build.path'] = this.buildPath;
        this._updateFromPlatform();
        this._validateSettings();
    }

    private _updateFromPlatform() {
        let uploader = this.rval('upload.tool');
        if (!uploader) return;

        let cl = this._unpackPattern('tools.'+ uploader + '.upload.pattern')

        this._config['arduino.platform.uploader'] = cl[0];

        cl = this._unpackPattern('recipe.size.pattern')
        this._config['arduino.platform.sizer'] = cl[0];

    }

    private _updateOSDefaults() {
        this._exeSuffix = ''
        switch(os.type()) {
            case 'Windows_NT':
                this._idePath = 'C:\\Program Files (x86)\\Arduino';
                this._packagePath = process.env.APPDATA
                this._exeSuffix = '.exe'
                this._osSuffix = '.windows'
                break;
            case 'Linux':
                this._osSuffix = '.linux'
                break;
            case 'Darwin':
                this._idePath = '/Applications/Arduino.app/Contents/Java'
                this._packagePath = path.join(os.homedir(),'Library/Arduino15');
                break;
        }
        this._builder = 'arduino-builder' + this._exeSuffix;
        this._libraryPath = path.join(os.homedir(), 'Documents/Arduino/libraries');
    }

    private _updateFromBuilder() {
        let builder = this.builder;
        if (!fs.existsSync(builder))
            builder = this._builder;
        if (!fs.existsSync(builder))
            return;
        let args = this.minBuildArgs;
        args.push('-dump-prefs');

        let spawn = child_process.spawnSync(builder, args);
        if (spawn.status != 0) {
            this._output.append(spawn.stderr.toString());
            return;
        }

        let prefs = spawn.stdout.toString().split('\n');
        for (var i = 0; i < prefs.length; ++i) {
            var kv = prefs[i].trim().split('=');
            if (kv.length == 2) {
                this._config[kv[0]] = kv[1];
            }
        }
    }

    private _evaluate(key:string, parent?:string) {
        if (!key) return '';
        // this needs to be a last second thing
        this._config['build.project_name']  = this.filename;
        if (!this._config.hasOwnProperty(key)) return '';
        let parts = key.split('.');
        //by inspection, there've not been any parentage more that two levels
        if (!parent && parts.length > 1) {
            parent = parts.slice(0,parts.length-1).join('.');
        }
        let gparent = null;
        if (parts.length > 2) {
            gparent = parts.slice(0,parts.length-2).join('.');
        }
        let v = this.rval(key);
        let s = v.indexOf('{');
        while (s >= 0) {
            let e = v.indexOf('}', s + 1);
            if (e == -1) break;
            let sk = v.substring(s + 1, e);
            let at = e + 1;
            if (this._config.hasOwnProperty(sk)) {
                // some things can be overridden as params
                let skp = sk.split('.');
                let vp = null;
                if (skp.length==2) {
                    if (skp[0] == parts[parts.length-2]) {
                        let pskp = parent + '.params.' + skp[1];
                        if (this._config.hasOwnProperty(pskp)) {
                            vp = this.oval(pskp);
                        }
                    }
                }
                if (!vp)
                    vp = this.oval(sk);
                v = v.substring(0, s) + vp + v.substring(e + 1);
                at = s;
            } else if (this._config.hasOwnProperty(parent + "." + sk)) {
                v = v.substring(0, s) + this.oval(parent + "." + sk) + v.substring(e + 1);
                at = s;
            } else if (this._config.hasOwnProperty(gparent + "." + sk)) {
                v = v.substring(0, s) + this.oval(gparent + "." + sk) + v.substring(e + 1);
                at = s;
            }
            s = v.indexOf('{', at);
        }
        return v;
    }

    private _validateSettings() {
        // builder must be accessible
        if (!fs.existsSync(this.builder))
            this._idePath = null;
        // custom uploader must also exists
        if (this.uploader && !(fs.existsSync(this.uploader)))
            this._uploader = null;

    }

    private _updateIdePath() {
        if (this._vconfig.has('idePath')) {
            this._idePath = this._vconfig.get<string>('idePath');
        }
        if (os.type() == 'Darwin')
            if (!this._idePath.endsWith('Contents/Java'))
                this._idePath = path.join(this._idePath, 'Contents/Java');
        if (!fs.existsSync(this._idePath))
            this._idePath = null;
    }

    private _updateLibraryPath() {
        if (this._vconfig.has('libraryPath'))
            this._libraryPath = this._vconfig.get<string>('libraryPath');
    }

    private _updatePackagePath() {
        if (this._vconfig.has('packagePath'))
            this._packagePath = this._vconfig.get<string>('packagePath');
        if (!this._packagePath.endsWith('packages'))
            this._packagePath = path.join(this._packagePath, 'packages');
    }

    get hasValidFilename(): boolean {
        return this.filename.endsWith(".ino") || this.filename.endsWith(".pde");
    }
    get hasIdePath(): boolean {
        return this._idePath != null;
    }

    get hasSerialPort(): boolean {
        return this._serialPort != null;
    }

    get basename(): string {
        return path.basename(this.filename,'.ino');
    }

    get filename(): string {
        if (this._sketchName) return this._sketchName
        return path.basename(vscode.window.activeTextEditor.document.fileName);
    }

    get sketchPath(): string {
        return path.join(vscode.workspace.rootPath, this.filename);
    }

    get hexPath(): string {
        return path.join(vscode.workspace.rootPath, `.build/${this.basename}/${this.filename}`);
    }

    get buildPath(): string {
        if (!this._config.hasOwnProperty('vscode.build.path')) {

            let buildPath = path.join(vscode.workspace.rootPath, `.build`);

            if (!fs.existsSync(buildPath))
                fs.mkdirSync(buildPath);

            buildPath = path.join(buildPath, this.filename);
            if (!fs.existsSync(buildPath))
                fs.mkdirSync(buildPath);

            this._config['build.path'] = buildPath;
            this._config['vscode.build.path'] = buildPath;
        }
        return this._config['vscode.build.path'];
    }
    private _updatePathsForOS(path:any): any {
        if (Array.isArray(path))
            return path.map(x=>this._updatePathsForOS(x))
        if (this._osSuffix === ".windows")
            return path.replace(/\//g, '\\');
        return path
    }
    get cppConfig(): any {
        let includes = [
            path.join(this._idePath, 'hardware/arduino/avr/cores/arduino'),
            path.join(this._idePath, 'hardware/arduino/avr/libraries'),
            path.join(this._idePath, 'hardware/arduino/avr/variants/standard'),
            path.join(this._idePath, 'libraries')
        ];

        if (this._libraryPath) {
            includes.push(this._libraryPath);
            // libs path
            fs.readdirSync(this._libraryPath)
                .map(item => path.join(this._libraryPath, item))
                .filter(item => fs.lstatSync(item).isDirectory())
                .forEach(item => includes.push(item));
        }

        includes = this._updatePathsForOS(includes);

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

    get minBuildArgs(): string[] {
        let args = [
            '-logger', this._verbose ? 'human' : 'machine',
            '-hardware', `${this._idePath}/hardware`,
            '-hardware', `${this._packagePath}`,
            '-tools', `${this._idePath}/tools-builder`,
            '-tools', `${this._idePath}/hardware/tools/avr`,
            '-tools', `${this._packagePath}`,
            '-built-in-libraries', `${this._idePath}/libraries`,
            '-libraries', `${this._libraryPath}`,
            `-fqbn=${this._fqbn}`,
        ];
        return args;
    }
    get buildArgs(): string[] {
        let args = this.minBuildArgs.concat(
            [
            '-compile',
            '-build-path', this.buildPath,
            `-warnings=${this._warnMode}`,
            `-prefs=build.warn_data_percentage=${this._warnPercentage}`
        ]);
        if (this._compileOptions)
            args.concat(this._compileOptions);

        if(this._verbose)
            args.push('-verbose');

        args.push(this.sketchPath);

        return this._updatePathsForOS(args);
    }
    private _unquote(a: string) {
        if (a.startsWith('"') && a.endsWith('"'))
            return a.substring(1, a.length - 1);
        return a;
    }
    private _unquoteArgs(args: string[]) {
        return args.map(a=>{
            return this._unquote(a);
        })
    }

    private _legacyUploadArgs() {
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
        return this._updatePathsForOS(args);
    }
    get builder(): string {
        return path.join(this._idePath, this._builder);
    }

    private hasval(key:string) : boolean {
        return this._config.hasOwnProperty(key);
    }

    private oval(key:string) {
        // this would be the canonical response
        if (this._osSuffix && this.hasval(key + this._osSuffix))
            return this.rval(key + this._osSuffix);
        else
        {
        // this is the heuristic response
            let suffix = ''
            if (key.endsWith('.cmd') || key.indexOf('.cmd.') > -1)
                return this.rval(key) + this._exeSuffix;
            else
            return this.rval(key);
        }
    }

    // raw value from config
    rval(key:string): any {
        if (this.hasval(key))
            return this._config[key];
        else
            return null;
    }

    // expanded value from config
    val(key:string): string {
        if (this._config.hasOwnProperty(key))
            return this._evaluate(key);
        else
            return null;
    }


    private _unpackPattern(key): string[] {
        let pattern = this.val(key);
        let parts = splitargs(pattern)
        return parts
    }

    // backwards compat
    get avrdude(): string { return this.uploader; }
    get uploader(): string {
    	return this._uploader ? this._uploader : this._config['arduino.platform.uploader'];
    }

    // backwards compat
    get uploadArgs(): string[] { return this.uploaderArgs; }
    get uploaderArgs(): string[] {
        if (this._uploader)
            return this._legacyUploadArgs();

        let uploader = this.rval('upload.tool');
        let cl = this._unpackPattern('tools.'+ uploader + '.upload.pattern')
        return cl.slice(1);
    }

    // backwards compat
    get avrsize(): string { return this.sizer; }
    get sizer(): string {
    	return this._config['arduino.platform.sizer'];
    }
    // backwards compat
    get sizeArgs(): string[] { return this.sizerArgs; }
    get sizerArgs(): string[] {
        let cl = this._unpackPattern('recipe.size.pattern')
        return cl.slice(1);
    }

    get verbose(): boolean {
    	return this._verbose;
    }
}