import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path'
import * as child_process from 'child_process'

export class ArduinoVS {

    constructor(private output: vscode.OutputChannel) {
    }

    _setting(name): string {
        let config = vscode.workspace.getConfiguration('arduino');
        return config.get<string>(name, null);
    }

    _checkSettings(...args) {
        let config = vscode.workspace.getConfiguration('arduino');

        return args.findIndex(x => config.get(x, null)) == -1;
    }

    get settings(): string {
        return path.join(vscode.workspace.rootPath, '.vscode/settings.json');
    }

    get basename(): string {
        return path.basename(vscode.window.activeTextEditor.document.fileName, '.ino')
    }

    get filename(): string {
        return path.basename(vscode.window.activeTextEditor.document.fileName);
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

    get hexPath(): string {
        return path.join(vscode.workspace.rootPath, `tmp/${this.basename}/${this.filename}.hex`);
    }

    get buildArgs(): string[] {
        let idePath = this._setting('idePath');
        let libPath = this._setting('libraryPath');
        let fqbn = this._setting('fqbn');
        let args = ["-compile",
            "-hardware",
            `${idePath}/hardware`,
            "-tools",
            `${idePath}/tools-builder`,
            "-tools",
            `${idePath}/hardware/tools/avr`,
            "-built-in-libraries",
            `${idePath}/libraries`,
            "-libraries",
            libPath,
            `-fqbn=${fqbn}`,
            "-ide-version=10800",
            "-build-path",
            this.tempPath,
            "-warnings=none",
            "-prefs=build.warn_data_percentage=75",
            `-prefs=runtime.tools.avr-gcc.path=${idePath}/hardware/tools/avr`,
            `-prefs=runtime.tools.avrdude.path=${idePath}/hardware/tools/avr`,
            `-prefs=runtime.tools.arduinoOTA.path=${idePath}/hardware/tools/avr`,
            vscode.window.activeTextEditor.document.fileName];

        return args.map(x => x.replace(/\//g, '\\'));
    }

    get uploadArgs(): string[] {
        let idePath = this._setting('idePath');
        let serialPort = this._setting('serialPort');
        let args = [`-C${idePath}/hardware/tools/avr/etc/avrdude.conf`,
            "-patmega328p",
            "-carduino",
        `-P${serialPort}`,
            "-b115200",
            "-D",
        `-Uflash:w:${this.hexPath}:i`];
        return args.map(x => x.replace(/\//g, '\\'));
    }

    get needRebuild(): boolean {
        if (vscode.window.activeTextEditor.document.isDirty)
            return true;

        if (!fs.existsSync(this.hexPath))
            return true;

        let hexStat = fs.lstatSync(this.hexPath);
        let sourceStat = fs.lstatSync(vscode.window.activeTextEditor.document.fileName);

        return sourceStat.mtime > hexStat.mtime;
    }

    ouputMessage(data: string) {
        this.output.append(data);
    }

    initialize() {
        if (this._checkSettings('idePath', 'libraryPath')) {
            vscode.window.showErrorMessage("Please set Arduino settings before build.");
            return;
        }

        let idePath = this._setting('idePath');
        let cppConfig = {
            "configurations": [
                {
                    "name": "Arduino",
                    "includePath": [
                        path.join(idePath, 'hardware\arduino\avr\cores\arduino'),
                        path.join(idePath, 'hardware\arduino\avr\libraries'),
                        path.join(idePath, 'hardware\arduino\avr\variants\standard'),
                        path.join(idePath, 'libraries')
                    ],
                    "browse": {
                        "limitSymbolsToIncludedHeaders": true,
                        "databaseFilename": ""
                    }
                }
            ]
        };

        let cppJsonFile = path.join(vscode.workspace.rootPath, '.vscode/c_cpp_properties.json');
        fs.writeFile(cppJsonFile, JSON.stringify(cppConfig, null, 4),
            () => vscode.window.showInformationMessage("Successfully updated C++ Intellisense settings."));
    }

    build() {
        let document = vscode.window.activeTextEditor.document;

        if (this._checkSettings('idePath', 'libraryPath', 'fqbn')) {
            vscode.window.showErrorMessage("Please set Arduino settings before build.");
            return;
        }

        if (document.isUntitled) {
            vscode.window.showInformationMessage('Please save the file first!');
        }

        if (document.isDirty) {
            document.save()
                .then((success) => console.log('save status:', success));
        }

        this.output.show(true);
        let spawn = child_process.spawn(path.join(this._setting('idePath'), 'arduino-builder.exe'), this.buildArgs);
        this.output.clear();
        spawn.stdout.on('data', data => this.output.append(String.fromCharCode.apply(null, data)));
        spawn.stderr.on('data', data => this.output.append(String.fromCharCode.apply(null, data)));
        spawn.on('close', (result) => this.output.append(`\nBuild ${result ? 'failed' : 'success'}.\n`))
    }

    deleteFolderRecursive(path) {
        var files = [];
        if (fs.existsSync(path)) {
            files = fs.readdirSync(path);
            files.forEach((file) => {
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                    this.deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });

            fs.rmdirSync(path);
        }
    };

    clean() {
        if (fs.existsSync(this.tempPath))
            this.deleteFolderRecursive(this.tempPath);
    }

    rebuild() {
        this.clean();
        this.build();
    }

    upload() {
        if (this.needRebuild) {
            vscode.window.showErrorMessage("Source file need to compile or rebuild first.");
            return;
        }

        let spawn = child_process.spawn(path.join(this._setting('idePath'), 'hardware/tools/avr/bin/avrdude.exe'), this.uploadArgs);

        this.output.clear();
        spawn.stdout.on('data', data => this.output.append(String.fromCharCode.apply(null, data)));
        spawn.stderr.on('data', data => this.output.append(String.fromCharCode.apply(null, data)));
        spawn.on('close', (result) => this.output.append(`\nUpload ${result ? 'failed' : 'success'}.\n`))
    }

    buildAndUpload() {
        this.build();
        this.upload();
    }

    rebuildAndUpload() {
        this.rebuild();
        this.upload();
    }
}