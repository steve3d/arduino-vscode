'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ArduinoVS } from './arduino'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('ArduinoVS actived!');

    let output = vscode.window.createOutputChannel('Arduino');

    let arduino = new ArduinoVS(output);

    context.subscriptions.push(vscode.commands.registerTextEditorCommand('extension.build', () => arduino.build()));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('extension.rebuild', () => arduino.rebuild()));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('extension.clean', () => arduino.clean()));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('extension.upload', () => arduino.upload()));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('extension.buildAndUpload', () => arduino.buildAndUpload()));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('extension.rebuildAndUpload', () => arduino.rebuildAndUpload()));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('extension.initialize', () => arduino.initialize()));
}

// this method is called when your extension is deactivated
export function deactivate() {
}