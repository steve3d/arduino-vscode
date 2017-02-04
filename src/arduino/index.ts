'use strict';

import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path'
import * as child_process from 'child_process'
import * as os from 'os';
import { EventEmitter } from "events";
import { ConfigUtil } from '../config'

export class ArduinoVS {
    private config: ConfigUtil;
    private updateSettings = `Please update workspace settings, Can't continue without Arduino IDE and the serial port.`;
    private builtEvent = new EventEmitter();
    private building = false;
    private uploading = false;
    private diagnostics: vscode.DiagnosticCollection;
    private errors: Object;

    constructor(private output: vscode.OutputChannel) {
        this.config = new ConfigUtil();

        this.diagnostics = vscode.languages.createDiagnosticCollection();
    }

    get needRebuild(): boolean {
        if (vscode.window.activeTextEditor.document.isDirty)
            return true;

        let hexPath = this.config.hexPath;
        if (!fs.existsSync(hexPath))
            return true;

        let hexStat = fs.lstatSync(hexPath);
        let sourceStat = fs.lstatSync(vscode.window.activeTextEditor.document.fileName);

        return sourceStat.mtime > hexStat.mtime;
    }

    ouputMessage(data: string) {
        this.output.append(data);
    }

    initialize() {
        if (!this.config.hasIdePath || !this.config.hasSerialPort) {
            vscode.window.showErrorMessage(this.updateSettings);
            return;
        }

        let cppJsonFile = path.join(vscode.workspace.rootPath, '.vscode/c_cpp_properties.json');
        fs.writeFile(cppJsonFile, JSON.stringify(this.config.cppConfig, null, 4),
            () => vscode.window.showInformationMessage("Successfully updated C++ Intellisense settings."));
    }

    showProgress(data: string, item: vscode.StatusBarItem, status: string) {
        let output = data.split('\n');
        output.forEach(line => {
            if(line == '')
                return;

            let parts = line.split(' ||| ');
            if(parts.length == 3) {
                let value = parts[2].substr(1, parts[2].length-2);
                if(line.includes('Progress'))
                    item.text = status + value + '%';
                else {
                    let values = value.split(' ');
                    if(values.length == 3)
                        this.output.append(`Sketch uses ${values[0]} bytes (${values[2]}%) of program storage space. Maximum is ${values[1]} bytes.\n`)
                    else if(values.length == 4)
                        this.output.append(`Global variables use ${values[0]} bytes (${values[2]}%) of dynamic memory, leaving ${values[3]} bytes for local variables. Maximum is ${values[1]} bytes.\n`)
                    else
                        this.output.append(line + '\n');
                }

            } else
                this.output.append(line + '\n');
        })
    }

    addDiagnostic(status: RegExpMatchArray) {
        if(status == null)
            return;

        if(!this.errors.hasOwnProperty(status[1]))
            this.errors[status[1]] = [];
        let line = parseInt(status[2], 10)-1;
        let column = parseInt(status[3], 10);
        let diag = new vscode.Diagnostic(
            new vscode.Range(line, column, line, column),
            status[5],
            status[4] == 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);

        this.errors[status[1]].push(diag);
    }

    build() {
        if(this.building) {
            vscode.window.showErrorMessage('Building in progress, please wait a moment.');
            return;
        }

        let document = vscode.window.activeTextEditor.document;

        if (!this.config.hasIdePath) {
            vscode.window.showErrorMessage('Can not build anything without Arduino IDE, please update settings.');
            return;
        }

        if (document.isUntitled) {
            vscode.window.showInformationMessage('Please save the file first!');
        }

        if (document.isDirty) {
            document.save()
                .then((success) => console.log('save status:', success));
        }

        this.errors = {};
        this.diagnostics.clear();
        this.output.clear();
        this.output.append('============== Begin to compile. ==============\n')
        if(this.config.verbose) {
            this.output.append(this.config.builder + ' ');
            this.output.append(this.config.buildArgs.join(' ') + '\n');
        }
        this.building = true;
        let spawn = child_process.spawn(this.config.builder, this.config.buildArgs);
        let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        let status = 'Compiling ';
        statusBarItem.text = status + '0%';
        statusBarItem.show();

        spawn.stdout.on('data', data => this.showProgress(String.fromCharCode.apply(null, data),
            statusBarItem,
            status));

        spawn.stderr.on('data', data => {
            let error:string = String.fromCharCode.apply(null, data);

            error.split('\n')
                .forEach(line => this.addDiagnostic(line.match(/(.*):(\d+):(\d+):\s+(warning|error):\s+(.*)/)));

            this.output.append(error);
        });

        spawn.on('close', (result) => this.onBuildFinished(result, statusBarItem))
    }

    onBuildFinished(result: number, statusBarItem: vscode.StatusBarItem) {
        this.builtEvent.emit('build', result);
        statusBarItem.dispose();
        this.building = false;
        if(result)
            this.output.show(true);

        let items = [];
        for (let key in this.errors) {
            if (this.errors.hasOwnProperty(key)) {
                items.push([vscode.Uri.file(key), this.errors[key]]);
            }
        }

        this.diagnostics.set(items);

        if(result)
            vscode.window.showErrorMessage('Build failed.');
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

    clean(info = true) {
        if (fs.existsSync(this.config.tempPath)) {
            this.deleteFolderRecursive(this.config.tempPath);
            if(info)
                vscode.window.showInformationMessage('Intermediate ouput folder cleaned.');
        } else if(info)
            vscode.window.showInformationMessage('Nothing need to clean.');
    }

    rebuild() {
        this.clean(false);
        this.build();
    }

    upload() {
        if(this.uploading || this.building) {
            vscode.window.showErrorMessage('Building or uploading in progress. Please wait');
            return;
        }

        if(!this.config.hasSerialPort) {
            vscode.window.showErrorMessage('Can not upload without serial port specified, please update settings.');
            return;
        }

        if (this.needRebuild) {
            this.build();
            this.builtEvent.on('build', result => {
                if(result == 0)
                    this._realUpload();
            })
        } else
            this._realUpload();
    }

    private _realUpload() {
        this.uploading = true;
        let spawn = child_process.spawn(this.config.avrdude, this.config.uploadArgs);

        this.output.append('\n============== Begin to upload. ==============\n');
        if(this.config.verbose) {
            this.output.append(this.config.avrdude + ' ');
            this.output.append(this.config.uploadArgs.join(' ') + '\n');
        }

        spawn.stdout.on('data', data => this.output.append(String.fromCharCode.apply(null, data)));
        spawn.stderr.on('data', data => this.output.append(String.fromCharCode.apply(null, data)));
        spawn.on('close', (result) => {
            this.uploading = false;
            this.output.append(`\nUpload ${result ? 'failed' : 'success'}.\n`);
            if(result)
                this.output.show(true);
        });

        this.builtEvent.removeAllListeners();
    }

    buildAndUpload() {
        this.build();

        this.builtEvent.on('build', result => {
            console.log('build result', result);
            if(!result)
                this.upload();
            else
                vscode.window.showErrorMessage('Build failed, Can not upload.');

        });
    }

    rebuildAndUpload() {
        this.rebuild();

        this.builtEvent.on('build', result => {
            if(!result)
                this.upload();
            else
                vscode.window.showErrorMessage('Build failed, Can not upload.');

        });
    }
}